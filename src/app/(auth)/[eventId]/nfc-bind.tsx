import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { DEFAULT_BADGE_TYPE } from "@/constants/nfc";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { nfcService } from "@/services/nfc.service";
import { registrationService } from "@/services/registration.service";
import { resolveAttendee, type AttendeeContext } from "@/utils/desk-handoff";
import {
  classifyNfcBindError,
  type NfcBindFailureKind,
} from "@/utils/nfc-bind-errors";
import {
  chooseCardPayloadUrl,
  isNfcSupported,
  previewCardPayloadUrl,
  startNfc,
  writeUriToCard,
} from "@/utils/nfc-utils";

type BadgeType = "WRISTBAND" | "CARD" | "QR_ONLY";

type FlowState =
  | { phase: "lookup" }
  | { phase: "lookup-loading" }
  | ({ phase: "confirm" } & AttendeeContext)
  | ({ phase: "writing"; mode: "write" | "bind" } & AttendeeContext)
  | ({
      phase: "error";
      kind: NfcBindFailureKind;
      tagUid?: string;
      payloadUrl: string;
    } & AttendeeContext)
  | ({ phase: "done"; tagUid: string; payloadUrl: string } & AttendeeContext);

const BADGE_TYPES: { key: BadgeType; label: string; icon: IconName }[] = [
  { key: "CARD", label: copy.nfc.badgeTypeCard, icon: "check" },
  { key: "WRISTBAND", label: copy.nfc.badgeTypeWristband, icon: "check" },
  { key: "QR_ONLY", label: copy.nfc.badgeTypeQr, icon: "qr-code" },
];

const FAILURE_COPY: Record<NfcBindFailureKind, string> = {
  unsupported:
    Platform.OS === "ios"
      ? copy.nfc.iosWriteNotSupported
      : copy.nfc.webNotSupported,
  "invalid-uid": copy.nfc.invalidTagUid,
  duplicate: copy.nfc.duplicateBind,
  "bound-other": copy.nfc.boundOther,
  "write-failed": copy.nfc.writeFailed,
  "uri-mismatch": copy.nfc.uriMismatch,
  timeout: copy.nfc.writeTimeout,
  cancelled: copy.nfc.writeCancelled,
  "bind-failed": copy.nfc.bindFailed,
};

function writeBlockedMessage(): string | null {
  if (Platform.OS === "web") return copy.nfc.webNotSupported;
  if (Platform.OS === "ios") return copy.nfc.iosWriteNotSupported;
  return null;
}

/**
 * 查詢 + 整形（含錯誤文案）的純邏輯已抽到 `@/utils/desk-handoff`：AdminApp 沒有
 * 元件層測試，留在畫面檔裡的邏輯只能被「掃原始碼字串」驗到（Loop AB · Batch A
 * 驗收 `M-03`）。
 */

function BlockedCardActions() {
  return (
    <Card
      padding={space[3]}
      style={styles.blockedCard}
      testID="nfc-replace-blocked"
    >
      <Text
        style={styles.blockedTitle}
        maxFontSizeMultiplier={layout.maxFontScaleFixed}
      >
        {copy.nfc.replaceTitle}
      </Text>
      <InlineBanner compact tone="warning" message={copy.nfc.replaceBlocked} />
      <View style={styles.blockedActions}>
        <View style={styles.blockedActionItem}>
          <Button
            label={copy.nfc.replaceCard}
            variant="secondary"
            size="md"
            disabled
            onPress={() => undefined}
          />
        </View>
        <View style={styles.blockedActionItem}>
          <Button
            label={copy.nfc.reissueCard}
            variant="secondary"
            size="md"
            disabled
            onPress={() => undefined}
          />
        </View>
        <View style={styles.blockedActionItem}>
          <Button
            label={copy.nfc.returnCard}
            variant="secondary"
            size="md"
            disabled
            onPress={() => undefined}
          />
        </View>
      </View>
    </Card>
  );
}

export default function NfcBindScreen() {
  const insets = useSafeAreaInsets();
  const { eventId, code: codeParam } = useLocalSearchParams<{
    eventId: string;
    code?: string;
  }>();
  /**
   * `11` `WP-18`：報到成功卡會帶著報名碼過來（`?code=`），現場不必再手輸一次。
   * 它只當**初值**與一次性自動查詢；查詢過後欄位完全由操作者控制，**不自動送出**。
   */
  const prefilledCode = (codeParam ?? "").trim().toUpperCase();
  const [code, setCode] = useState(prefilledCode);
  /** X-27 裁定（2026-09-30）：維持 `CARD`，且預設值只存在於 `@/constants/nfc` 一處。 */
  const [badgeType, setBadgeType] = useState<BadgeType>(DEFAULT_BADGE_TYPE);
  /**
   * 有帶碼就直接進「查詢中」——loading 態是**推導出來的初值**，不是 effect 裡的
   * 同步 setState（後者會被 `react-hooks/set-state-in-effect` 擋下，且確實會多一輪 render）。
   */
  const [state, setState] = useState<FlowState>(() =>
    prefilledCode ? { phase: "lookup-loading" } : { phase: "lookup" },
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  /** 進行中的寫卡控制器；寫入中有「取消」可 abort 它（CRA-V1-009）。 */
  const writeAbortRef = useRef<AbortController | null>(null);
  const blocked = writeBlockedMessage();

  const lookup = useCallback(async () => {
    if (!eventId || !code.trim()) return;
    const rawCode = code.trim();
    setState({ phase: "lookup-loading" });
    setLookupError(null);
    const result = await resolveAttendee(
      eventId,
      rawCode,
      registrationService.getByCode,
    );
    if (result.ok) {
      setState(result.ctx);
      return;
    }
    setLookupError(result.reason);
    setState({ phase: "lookup" });
  }, [eventId, code]);

  /**
   * 來自報到卡的一次性自動查詢。
   *
   * 工作者就地宣告（同 `check-in.tsx` 的 `loadCounter`）：狀態更新全在 `await`
   * 之後，effect 本體不會同步 setState。`prefilledLookupDone` 是「已經自動查過」
   * 的名額——不能只靠 deps 控制，否則操作者每打一個字就會重查一次。
   *
   * L-05（Loop AB · Batch A 驗收）：守衛存的是**已消費的那個 `code`**，不是單純的
   * `true`。存 `true` 的話，同一個畫面實例若再收到新的 `?code=`（Expo Router
   * 以同層 `replace` 重用實例的情形），自動查詢與欄位值都會停在舊的那一筆，
   * 形成「畫面顯示的報名碼」與「實際查詢對象」不一致的視窗。
   */
  const prefilledLookupDone = useRef<string | null>(null);
  useEffect(() => {
    if (!eventId || !prefilledCode) return;
    if (prefilledLookupDone.current === prefilledCode) return;
    prefilledLookupDone.current = prefilledCode;
    let active = true;

    async function loadPrefilledAttendee() {
      const result = await resolveAttendee(
        eventId,
        prefilledCode,
        registrationService.getByCode,
      );
      if (!active) return;
      // 欄位對齊「剛剛查的那一個 code」；在 `await` 之後才 setState，
      // 所以 effect 本體依然沒有同步 setState。
      setCode(prefilledCode);
      if (result.ok) {
        setState(result.ctx);
        return;
      }
      setLookupError(result.reason);
      setState({ phase: "lookup" });
    }

    void loadPrefilledAttendee();

    return () => {
      active = false;
    };
  }, [eventId, prefilledCode]);

  const fail = useCallback(
    (
      ctx: AttendeeContext,
      error: unknown,
      payloadUrl: string,
      tagUid?: string,
    ) => {
      const kind = classifyNfcBindError(error);
      setState({
        phase: "error",
        kind,
        payloadUrl,
        tagUid,
        ...ctx,
      });
    },
    [],
  );

  const bindOnly = useCallback(
    async (ctx: AttendeeContext, tagUid: string, payloadUrl: string) => {
      if (!eventId) return;
      setState({ phase: "writing", mode: "bind", ...ctx });
      try {
        await nfcService.bind(eventId, ctx.registrationId, tagUid, {
          badgeType,
        });
        setState({ phase: "done", tagUid, payloadUrl, ...ctx });
      } catch (error) {
        fail(ctx, error, payloadUrl, tagUid);
      }
    },
    [badgeType, eventId, fail],
  );

  const writeAndBind = useCallback(
    async (ctx: AttendeeContext) => {
      if (!eventId) return;
      if (blocked) {
        setState({
          phase: "error",
          kind: "unsupported",
          payloadUrl: "",
          ...ctx,
        });
        return;
      }

      setState({ phase: "writing", mode: "write", ...ctx });
      const controller = new AbortController();
      writeAbortRef.current = controller;
      try {
        const supported = await isNfcSupported();
        if (!supported) {
          setState({
            phase: "error",
            kind: "unsupported",
            payloadUrl: "",
            ...ctx,
          });
          return;
        }
        await startNfc();
        // 卡面 URL 由 `chooseCardPayloadUrl` 決定（名片優先、解析器保底）：
        // 有公開名片 ⇒ 只寫 `/p/{slug}`，**一個參數都不帶**（2026-10-30 二次定案：
        // 實體卡無法遠端修改，所以它只能依賴「只由這個人是誰」決定的位置；帶
        // `?e={eventId}` 會讓「卡片能不能開」多出一個與訪客無關的失敗原因）。
        // 沒有才退回 `/t/{eventId}/{tagUid}`，由 FE 動態解析。
        const { tagUid, writtenUri } = await writeUriToCard(
          (uid) =>
            chooseCardPayloadUrl({
              eventId,
              tagUid: uid,
              profileUrl: ctx.profileUrl,
            }).url,
          { signal: controller.signal },
        );
        await bindOnly(ctx, tagUid, writtenUri);
      } catch (error) {
        if (classifyNfcBindError(error) === "cancelled") {
          // 使用者主動取消：回確認畫面即可，不該給一張看起來像失敗的卡。
          setState({ phase: "confirm", ...ctx });
          return;
        }
        fail(ctx, error, "");
      } finally {
        writeAbortRef.current = null;
      }
    },
    [bindOnly, blocked, eventId, fail],
  );

  const cancelWrite = useCallback(() => {
    writeAbortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setCode("");
    setLookupError(null);
    setState({ phase: "lookup" });
  }, []);

  const backToConfirm = useCallback((ctx: AttendeeContext) => {
    setState({ phase: "confirm", ...ctx });
  }, []);

  if (!eventId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={copy.nfc.writeTitle}
          leading="back"
          backFallbackPath="/(auth)/home"
        />
        <View style={styles.emptyBody}>
          <EmptyState
            kind="no-results"
            headingLevel={2}
            title={copy.event.unavailableTitle}
            description={copy.event.unavailableHint}
            testID="nfc-bind-empty"
          />
        </View>
      </View>
    );
  }

  const errorMessage =
    state.phase === "error"
      ? state.kind === "bind-failed" && state.tagUid
        ? copy.nfc.bindFailedAfterWrite
        : FAILURE_COPY[state.kind]
      : null;
  const canRetryBind =
    state.phase === "error" && state.kind === "bind-failed" && !!state.tagUid;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.nfc.writeTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {blocked || lookupError ? (
          <View style={styles.alerts}>
            {blocked ? (
              <InlineBanner
                compact
                tone="warning"
                message={blocked}
                testID="nfc-unsupported"
              />
            ) : null}
            {lookupError ? (
              <InlineBanner compact tone="danger" message={lookupError} />
            ) : null}
          </View>
        ) : null}

        {state.phase === "lookup" || state.phase === "lookup-loading" ? (
          <>
            <View style={styles.formBlock}>
              <Text
                style={styles.stepHint}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.nfc.stepLookupHint}
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder={copy.checkIn.codePlaceholder}
                placeholderTextColor={semantic.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                accessibilityLabel={copy.checkIn.codePlaceholder}
              />
              <Button
                label={copy.checkIn.submit}
                onPress={() => void lookup()}
                loading={state.phase === "lookup-loading"}
                disabled={!code.trim()}
              />
            </View>
            <BlockedCardActions />
          </>
        ) : null}

        {state.phase === "confirm" ? (
          <>
            <View style={styles.formBlock}>
              <Text
                style={styles.stepHint}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.nfc.stepChooseTypeHint}
              </Text>
              <Text
                style={type.h3}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {state.displayName}
              </Text>
              <Text
                style={styles.stepHint}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.nfc.payloadPreview}
              </Text>
              {/* 有公開名片 ⇒ 這一刻就知道完整網址（不需要 UID），直接把實際要寫
                  的字給操作員看；沒有名片 ⇒ 退回解析器，tagUid 段要感應當下才讀得到，
                  確認畫面只能顯示模板。 */}
              <Text style={styles.url} selectable>
                {previewCardPayloadUrl({
                  eventId: String(eventId ?? ""),
                  profileUrl: state.profileUrl,
                })}
              </Text>
              <Text
                style={styles.stepHint}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.nfc.payloadTagUidHint}
              </Text>
              <View style={styles.badgeTypeRow}>
                {BADGE_TYPES.map((b) => (
                  <Pressable
                    key={b.key}
                    onPress={() => setBadgeType(b.key)}
                    style={[
                      styles.badgeType,
                      badgeType === b.key && styles.badgeTypeActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: badgeType === b.key }}
                    accessibilityLabel={b.label}
                  >
                    <Icon
                      name={b.icon}
                      size="sm"
                      color={
                        badgeType === b.key
                          ? semantic.icon.brand
                          : semantic.icon.muted
                      }
                    />
                    <Text
                      style={[
                        type.label,
                        {
                          color:
                            badgeType === b.key
                              ? semantic.text.primary
                              : semantic.text.muted,
                        },
                      ]}
                    >
                      {b.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                label={copy.nfc.startWrite}
                onPress={() => void writeAndBind(state)}
                disabled={blocked != null}
              />
              <Button label={copy.nfc.retype} variant="ghost" onPress={reset} />
            </View>
            <BlockedCardActions />
          </>
        ) : null}

        {state.phase === "writing" ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={semantic.icon.brand} />
            <Text style={[type.body, styles.loadingText]}>
              {state.mode === "bind" ? copy.nfc.binding : copy.nfc.writing}
            </Text>
            {/* 只有寫卡階段可能無限等待；bind 走 axios，本身有 15s 逾時。 */}
            {state.mode === "write" ? (
              <Button
                label={copy.nfc.cancelWrite}
                variant="ghost"
                onPress={cancelWrite}
              />
            ) : null}
          </View>
        ) : null}

        {state.phase === "error" && errorMessage ? (
          <View
            style={[styles.doneCard, styles.doneFail]}
            testID="nfc-bind-error"
          >
            <Icon name="x-circle" size="xl" color={semantic.status.danger.fg} />
            <Text style={[type.h3, styles.doneTitle]}>{errorMessage}</Text>
            {state.tagUid && state.kind !== "bind-failed" ? (
              <Text style={[type.body, styles.doneTitle]}>
                {copy.nfc.bindFailedAfterWrite}
              </Text>
            ) : null}
            {canRetryBind ? (
              <Button
                label={copy.nfc.retryBind}
                onPress={() =>
                  void bindOnly(state, state.tagUid as string, state.payloadUrl)
                }
              />
            ) : state.kind === "bound-other" ? (
              <Button
                label={copy.nfc.retype}
                onPress={() => backToConfirm(state)}
              />
            ) : (
              <Button
                label={copy.nfc.retryWrite}
                onPress={() => void writeAndBind(state)}
                disabled={blocked != null}
              />
            )}
            <Button label={copy.nfc.retype} variant="ghost" onPress={reset} />
            {state.kind === "bound-other" ? <BlockedCardActions /> : null}
          </View>
        ) : null}

        {state.phase === "done" ? (
          <View
            style={[styles.doneCard, styles.doneOk]}
            testID="nfc-bind-success"
          >
            <Icon
              name="check-circle"
              size="xl"
              color={semantic.status.success.fg}
            />
            <Text style={[type.h3, styles.doneTitle]}>
              {copy.nfc.bindSuccess}
            </Text>
            <Text style={[type.caption, styles.stepHint]}>
              {copy.nfc.writtenUid}
            </Text>
            <Text style={styles.url}>{state.tagUid}</Text>
            <Text style={styles.url} selectable>
              {state.payloadUrl}
            </Text>
            <Button label={copy.nfc.continueNext} onPress={reset} />
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
  alerts: {
    gap: space[2],
  },
  formBlock: {
    gap: space[3],
  },
  stepHint: {
    ...type.caption,
    color: semantic.text.muted,
  },
  url: {
    ...type.mono,
    color: semantic.text.primary,
  },
  input: {
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: 12,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontSize: type.mono.fontSize,
    fontFamily: type.mono.fontFamily,
    color: semantic.text.primary,
    minHeight: layout.buttonHeight,
  },
  badgeTypeRow: {
    flexDirection: "row",
    gap: space[2],
  },
  badgeType: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  badgeTypeActive: {
    backgroundColor: semantic.bg.brandSoft,
    borderColor: semantic.border.interactiveSelected,
  },
  centerBox: {
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[6],
  },
  loadingText: { color: semantic.text.muted },
  doneCard: {
    alignItems: "center",
    gap: space[3],
    borderRadius: 16,
    padding: space[4],
    borderWidth: 1,
  },
  doneOk: {
    backgroundColor: semantic.status.success.bg,
    borderColor: semantic.status.success.border,
  },
  doneFail: {
    backgroundColor: semantic.status.danger.bg,
    borderColor: semantic.status.danger.border,
  },
  doneTitle: { textAlign: "center" },
  blockedCard: {
    gap: space[3],
  },
  blockedTitle: {
    ...type.h3,
    color: semantic.text.primary,
  },
  blockedActions: {
    flexDirection: "row",
    gap: space[2],
  },
  blockedActionItem: {
    flex: 1,
    minWidth: 0,
  },
});
