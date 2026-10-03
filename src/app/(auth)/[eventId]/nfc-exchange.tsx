import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { nfcService } from "@/services/nfc.service";
import {
  classifyExchangeError,
  decideCapture,
  decideSubmit,
  exchangePairKey,
  type ExchangeFailureKind,
} from "@/utils/nfc-exchange";
import { isNfcSupported, readTagUid, startNfc } from "@/utils/nfc-utils";

/**
 * 交換名片（Loop AB · WP-20，`93-plan-desk-nfc-pack.md` §2.3）——last mile 的 Android 解。
 *
 * 流程：感應 A 卡 → 感應 B 卡 → `POST /nfc/exchange` → 顯示雙方姓名。
 * 讀卡**重用既有原子**（`@/utils/nfc-utils` 的 `startNfc()` ＋ `readTagUid()`，`N-6`），
 * 不新寫驅動層；規則（自換／重送／錯誤分類）全部在 `@/utils/nfc-exchange`，
 * 這裡只把它接上 UI（AdminApp 無元件層測試 ⇒ 邏輯留在 .tsx 就驗不到，見 `M-03`）。
 *
 * 註：`getTag().id` 在 iOS 是否可得仍未證（`R-DK-03`）⇒ 讀不到時以
 * `copy.exchange.iosReadUnavailable` 給可行動的替代指示，不顯示技術錯誤（AC-20-7）。
 */

interface Holder {
  uid: string;
  displayName: string;
}

type ScreenState =
  | { phase: "read-initiator" }
  | { phase: "read-receiver"; initiator: Holder }
  | { phase: "submitting"; initiator: Holder; receiver: Holder }
  | {
      phase: "done";
      initiator: Holder;
      receiver: Holder;
      alreadyExchanged: boolean;
    }
  | { phase: "error"; kind: ExchangeFailureKind };

/** 讀卡層的 web 阻擋（與 `nfc-read.tsx:39-42` 同語意）。 */
function readBlockedMessage(): string | null {
  if (Platform.OS === "web") return copy.exchange.webNotSupported;
  return null;
}

const FAILURE_COPY: Record<ExchangeFailureKind, string> = {
  unsupported:
    Platform.OS === "ios"
      ? copy.exchange.iosReadUnavailable
      : copy.exchange.webNotSupported,
  "invalid-uid": copy.exchange.invalidUid,
  "same-badge": copy.exchange.sameCard,
  "card-not-bound": copy.exchange.cardNotBound,
  "initiator-not-bound": copy.exchange.initiatorNotBound,
  "receiver-not-bound": copy.exchange.receiverNotBound,
  deactivated: copy.exchange.deactivated,
  "identifier-missing": copy.exchange.identifierMissing,
  rejected: copy.exchange.rejected,
  unauthorized: copy.exchange.unauthorized,
  network: copy.exchange.network,
  server: copy.exchange.server,
  failed: copy.exchange.readFailed,
};

export default function NfcExchangeScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const blocked = readBlockedMessage();

  const [state, setState] = useState<ScreenState>({ phase: "read-initiator" });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 同一次感應期間的互斥鎖：`busy` state 是給畫面用，這個才是真正的守門。 */
  const busyRef = useRef(false);
  /**
   * 已成功送出的配對（無序鍵）。後端本身冪等，這裡只是**少打一次出網**，
   * 也避免操作者看到兩次「已交換」（`AC-20-4` 的前端半）。
   */
  const lastPairRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setNotice(null);
    setState({ phase: "read-initiator" });
  }, []);

  const submit = useCallback(
    async (initiator: Holder, receiver: Holder) => {
      if (!eventId) return;
      const decision = decideSubmit(
        initiator.uid,
        receiver.uid,
        lastPairRef.current,
      );
      if (decision.action === "duplicate") {
        setState({
          phase: "done",
          initiator,
          receiver,
          alreadyExchanged: true,
        });
        return;
      }
      if (decision.action === "reject-same-badge") {
        setNotice(copy.exchange.sameCard);
        setState({ phase: "read-receiver", initiator });
        return;
      }
      if (decision.action !== "submit") {
        setState({ phase: "error", kind: "identifier-missing" });
        return;
      }

      setState({ phase: "submitting", initiator, receiver });
      try {
        const result = await nfcService.recordExchange(eventId, {
          initiatorUid: decision.initiatorUid,
          receiverUid: decision.receiverUid,
          exchangeType: "PEER_TO_PEER",
        });
        lastPairRef.current = exchangePairKey(
          decision.initiatorUid,
          decision.receiverUid,
        );
        setState({
          phase: "done",
          initiator,
          receiver,
          alreadyExchanged: result.alreadyExchanged,
        });
      } catch (error) {
        setState({ phase: "error", kind: classifyExchangeError(error) });
      }
    },
    [eventId],
  );

  const scan = useCallback(async () => {
    if (!eventId || busyRef.current) return;
    if (blocked) {
      setState({ phase: "error", kind: "unsupported" });
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setNotice(null);

    // 第一張卡由目前 state 決定是否存在；第二張卡讀取失敗時它必須原樣保留。
    const existingInitiator =
      state.phase === "read-receiver" ? state.initiator : null;

    try {
      const supported = await isNfcSupported();
      if (!supported) {
        setState({ phase: "error", kind: "unsupported" });
        return;
      }
      await startNfc();
      const uid = await readTagUid();

      const decision = decideCapture(
        { initiatorUid: existingInitiator?.uid ?? null },
        uid,
      );
      if (decision.action === "reject-same-badge") {
        // AC-20-5：不消耗第一張卡狀態，停在原地等對方那張。
        setNotice(copy.exchange.sameCard);
        return;
      }

      // 公開 lookup（`nfcService.lookup`）：拿姓名，並把「這張卡還沒寫卡」提早擋在
      // 第一動——不必等交換 API 回 404 才知道。
      const holder = await nfcService.lookup(eventId, { uid });
      const scanned: Holder = { uid, displayName: holder.displayName };

      if (decision.action === "set-initiator") {
        setState({ phase: "read-receiver", initiator: scanned });
        return;
      }
      await submit(existingInitiator as Holder, scanned);
    } catch (error) {
      setState({ phase: "error", kind: classifyExchangeError(error) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [blocked, eventId, state, submit]);

  if (!eventId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={copy.exchange.title}
          leading="back"
          backFallbackPath="/(auth)/home"
        />
        <View style={styles.emptyBody}>
          <EmptyState
            kind="no-results"
            headingLevel={2}
            title={copy.event.unavailableTitle}
            description={copy.event.unavailableHint}
            testID="nfc-exchange-empty"
          />
        </View>
      </View>
    );
  }

  const errorMessage =
    state.phase === "error" ? FAILURE_COPY[state.kind] : null;
  /** 第二張卡是「第一張卡已就位」之後才可能出現的狀態。 */
  const awaitingSecond = state.phase === "read-receiver";
  const busyLabel =
    state.phase === "submitting" ? copy.exchange.submitting : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.exchange.title}
        subtitle={copy.exchange.subtitle}
        leading="back"
        backFallbackPath="/(auth)/[eventId]/nfc-exchange"
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {blocked ? (
          <InlineBanner
            compact
            tone="warning"
            message={blocked}
            testID="nfc-exchange-unsupported"
          />
        ) : null}

        {notice ? (
          <InlineBanner compact tone="warning" message={notice} />
        ) : null}

        {errorMessage ? (
          <View
            style={[styles.doneCard, styles.doneFail]}
            testID="nfc-exchange-error"
          >
            <Icon name="x-circle" size="xl" color={semantic.status.danger.fg} />
            <Text style={[type.h3, styles.doneTitle]}>{errorMessage}</Text>
            <Button
              label={copy.exchange.retry}
              onPress={() => void scan()}
              disabled={blocked != null}
            />
            <Button
              label={copy.exchange.cancel}
              variant="ghost"
              onPress={reset}
            />
          </View>
        ) : null}

        {state.phase === "read-initiator" || awaitingSecond ? (
          <View style={styles.formBlock} testID="nfc-exchange-step">
            <Text
              style={styles.stepHint}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {awaitingSecond
                ? copy.exchange.waitingSecond
                : copy.exchange.introHint}
            </Text>

            {awaitingSecond ? (
              <View style={styles.holderCard} testID="nfc-exchange-initiator">
                <Text
                  style={styles.holderLabel}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.exchange.firstCardLabel}
                </Text>
                <Text
                  style={type.h3}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {state.initiator.displayName}
                </Text>
                <Text style={styles.uid} selectable>
                  {state.initiator.uid}
                </Text>
              </View>
            ) : null}

            <Button
              label={
                awaitingSecond
                  ? copy.exchange.stepReadReceiver
                  : copy.exchange.stepReadInitiator
              }
              onPress={() => void scan()}
              loading={busy}
              disabled={blocked != null}
              testID="nfc-exchange-scan"
            />
            <Button
              label={copy.exchange.cancel}
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        ) : null}

        {state.phase === "submitting" ? (
          <View style={styles.centerBox} testID="nfc-exchange-submitting">
            <ActivityIndicator size="large" color={semantic.icon.brand} />
            <Text style={[type.body, styles.loadingText]}>{busyLabel}</Text>
          </View>
        ) : null}

        {state.phase === "done" ? (
          <View
            style={[styles.doneCard, styles.doneOk]}
            testID="nfc-exchange-success"
          >
            <Icon
              name="check-circle"
              size="xl"
              color={semantic.status.success.fg}
            />
            <Text style={[type.h3, styles.doneTitle]}>
              {state.alreadyExchanged
                ? copy.exchange.alreadyTitle
                : copy.exchange.successTitle}
            </Text>
            <Text style={[type.caption, styles.stepHint]}>
              {state.alreadyExchanged
                ? copy.exchange.alreadyHint
                : copy.exchange.successHint}
            </Text>

            <View style={styles.pairRow} testID="nfc-exchange-pair">
              <View style={styles.pairItem}>
                <Text style={styles.holderLabel}>
                  {copy.exchange.firstCardLabel}
                </Text>
                <Text style={type.body}>{state.initiator.displayName}</Text>
                <Text style={styles.uid} selectable>
                  {state.initiator.uid}
                </Text>
              </View>
              <View style={styles.pairItem}>
                <Text style={styles.holderLabel}>
                  {copy.exchange.secondCardLabel}
                </Text>
                <Text style={type.body}>{state.receiver.displayName}</Text>
                <Text style={styles.uid} selectable>
                  {state.receiver.uid}
                </Text>
              </View>
            </View>

            <Button label={copy.exchange.exchangeAgain} onPress={reset} />
            <Button
              label={copy.settings.backToEvents}
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[4],
    gap: space[4],
  },
  emptyBody: {
    flex: 1,
    padding: spacing.screen,
    justifyContent: "center",
  },
  formBlock: {
    gap: space[3],
  },
  stepHint: {
    color: semantic.text.muted,
  },
  holderCard: {
    gap: space[1],
    padding: spacing.card,
    borderRadius: 12,
    backgroundColor: semantic.bg.surfaceSunken,
  },
  holderLabel: {
    color: semantic.text.muted,
  },
  uid: {
    color: semantic.text.muted,
    fontVariant: ["tabular-nums"],
  },
  centerBox: {
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[6],
  },
  loadingText: {
    color: semantic.text.muted,
  },
  doneCard: {
    alignItems: "center",
    gap: space[2],
    padding: spacing.card,
    borderRadius: 16,
  },
  doneOk: { backgroundColor: semantic.status.success.bg },
  doneFail: { backgroundColor: semantic.status.danger.bg },
  doneTitle: { textAlign: "center" },
  pairRow: {
    flexDirection: "row",
    gap: space[4],
    alignSelf: "stretch",
  },
  pairItem: { flex: 1, gap: space[1] },
});
