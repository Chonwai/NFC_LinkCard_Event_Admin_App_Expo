import { useCallback, useRef, useState } from "react";
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
import {
  classifyNfcBindError,
  type NfcBindFailureKind,
} from "@/utils/nfc-bind-errors";
import {
  buildRegistrationProfileUrl,
  isNfcSupported,
  startNfc,
  writeUriToCard,
} from "@/utils/nfc-utils";
import { getRegistrationDisplayName } from "@/utils/registration-display";

type BadgeType = "WRISTBAND" | "CARD" | "QR_ONLY";

interface AttendeeContext {
  registrationId: string;
  code: string;
  displayName: string;
}

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
  { key: "WRISTBAND", label: copy.nfc.badgeTypeWristband, icon: "check" },
  { key: "CARD", label: copy.nfc.badgeTypeCard, icon: "check" },
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
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [code, setCode] = useState("");
  const [badgeType, setBadgeType] = useState<BadgeType>("WRISTBAND");
  const [state, setState] = useState<FlowState>({ phase: "lookup" });
  const [lookupError, setLookupError] = useState<string | null>(null);
  /** 進行中的寫卡控制器；寫入中有「取消」可 abort 它（CRA-V1-009）。 */
  const writeAbortRef = useRef<AbortController | null>(null);
  const blocked = writeBlockedMessage();

  const lookup = useCallback(async () => {
    if (!eventId || !code.trim()) return;
    setState({ phase: "lookup-loading" });
    setLookupError(null);
    try {
      const { registration } = await registrationService.getByCode(
        eventId,
        code.trim(),
      );
      if (!registration.id) {
        setLookupError(copy.nfc.bindFailed);
        setState({ phase: "lookup" });
        return;
      }
      setState({
        phase: "confirm",
        registrationId: registration.id,
        code: code.trim(),
        displayName: getRegistrationDisplayName(registration),
      });
    } catch {
      setLookupError(copy.checkIn.registrationNotFound);
      setState({ phase: "lookup" });
    }
  }, [eventId, code]);

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
      const payloadUrl = buildRegistrationProfileUrl(ctx.registrationId);
      const controller = new AbortController();
      writeAbortRef.current = controller;
      try {
        const supported = await isNfcSupported();
        if (!supported) {
          setState({
            phase: "error",
            kind: "unsupported",
            payloadUrl,
            ...ctx,
          });
          return;
        }
        await startNfc();
        const { tagUid } = await writeUriToCard(payloadUrl, {
          signal: controller.signal,
        });
        await bindOnly(ctx, tagUid, payloadUrl);
      } catch (error) {
        if (classifyNfcBindError(error) === "cancelled") {
          // 使用者主動取消：回確認畫面即可，不該給一張看起來像失敗的卡。
          setState({ phase: "confirm", ...ctx });
          return;
        }
        fail(ctx, error, payloadUrl);
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

  const attendee =
    state.phase === "lookup" || state.phase === "lookup-loading" ? null : state;
  const payloadPreview = attendee
    ? buildRegistrationProfileUrl(attendee.registrationId)
    : null;
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

        {state.phase === "confirm" && payloadPreview ? (
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
              <Text style={styles.url} selectable>
                {payloadPreview}
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
