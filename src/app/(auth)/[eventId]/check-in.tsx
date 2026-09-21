import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraView } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
import { eventService } from "@/services/event.service";
import { registrationService } from "@/services/registration.service";
import type { CheckInUiState } from "@/types/check-in.types";
import type { Registration } from "@/types/api.types";
import { getApiErrorCode } from "@/utils/api-error";
import { resolveCheckInErrorMessage } from "@/utils/check-in-errors";
import { playCheckInFeedback } from "@/utils/check-in-feedback";
import {
  getRegistrationCheckedInAt,
  getRegistrationCode,
  getRegistrationCompany,
  getRegistrationDisplayName,
  getRegistrationEmail,
  getRegistrationTicketType,
  getRegistrationTokenBalance,
  isAlreadyCheckedIn,
  isRegistrationNotCheckInEligible,
} from "@/utils/registration-display";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return copy.checkIn.dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** 資訊列：左標籤右數值，單行緊湊（現場一屏看完） */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [scanning, setScanning] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [state, setState] = useState<CheckInUiState>({ phase: "idle" });
  const [cameraError, setCameraError] = useState(false);
  const [checkedInTotal, setCheckedInTotal] = useState<number | null>(null);
  const [counterError, setCounterError] = useState(false);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideBanner, setOverrideBanner] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  };

  const refreshCounter = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await eventService.getRegistrations(eventId, {
        limit: 1,
        status: "CHECKED_IN",
      });
      setCheckedInTotal(res.pagination?.total ?? 0);
      setCounterError(false);
    } catch {
      setCounterError(true);
    }
  }, [eventId]);

  useEffect(() => {
    let active = true;

    async function loadCounter() {
      if (!eventId) return;
      try {
        const res = await eventService.getRegistrations(eventId, {
          limit: 1,
          status: "CHECKED_IN",
        });
        if (!active) return;
        setCheckedInTotal(res.pagination?.total ?? 0);
        setCounterError(false);
      } catch {
        if (!active) return;
        setCounterError(true);
      }
    }

    void loadCounter();

    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => clearResetTimer, []);

  const resetToIdle = useCallback(() => {
    clearResetTimer();
    setOverrideBanner(null);
    setState({ phase: "idle" });
    setScanning(true);
  }, []);

  const showOutcome = useCallback(
    async (next: Extract<CheckInUiState, { phase: "outcome" }>) => {
      setState(next);
      await playCheckInFeedback(next.kind);
      // 僅成功態自動重置；重複／無效需人工確認（覆核／補報）
      if (next.kind === "valid") {
        clearResetTimer();
        resetTimer.current = setTimeout(() => {
          resetToIdle();
        }, 3000);
      }
    },
    [resetToIdle],
  );

  const doLookupThenCheckIn = useCallback(
    async (rawCode: string) => {
      if (!eventId || !rawCode.trim()) return;
      const code = rawCode.trim();
      setState({ phase: "loading" });
      setScanning(false);
      setOverrideBanner(null);
      clearResetTimer();

      let registration: Registration | undefined;

      try {
        const lookedUp = await registrationService.getByCode(eventId, code);
        registration = lookedUp.registration;
      } catch (err) {
        await showOutcome({
          phase: "outcome",
          kind: "invalid",
          code,
          message: resolveCheckInErrorMessage(err),
        });
        return;
      }

      if (isAlreadyCheckedIn(registration)) {
        await showOutcome({
          phase: "outcome",
          kind: "duplicate",
          code,
          message: copy.checkIn.alreadyCheckedIn,
          registration,
          checkedInAt: getRegistrationCheckedInAt(registration),
        });
        return;
      }

      if (isRegistrationNotCheckInEligible(registration)) {
        await showOutcome({
          phase: "outcome",
          kind: "invalid",
          code,
          message: copy.checkIn.notConfirmed,
          registration,
        });
        return;
      }

      try {
        const checked = await registrationService.checkIn(eventId, code);
        const reg = checked.registration ?? registration;
        await showOutcome({
          phase: "outcome",
          kind: "valid",
          code,
          message: copy.checkIn.checkedIn,
          registration: reg,
          checkedInAt:
            checked.checkedInAt ??
            getRegistrationCheckedInAt(reg) ??
            new Date().toISOString(),
        });
        void refreshCounter();
      } catch (err) {
        const codeKey = getApiErrorCode(err);
        if (codeKey === "ALREADY_CHECKED_IN") {
          await showOutcome({
            phase: "outcome",
            kind: "duplicate",
            code,
            message: copy.checkIn.alreadyCheckedIn,
            registration,
            checkedInAt: getRegistrationCheckedInAt(registration),
          });
          return;
        }
        await showOutcome({
          phase: "outcome",
          kind: "invalid",
          code,
          message: resolveCheckInErrorMessage(err),
          registration,
        });
      }
    },
    [eventId, refreshCounter, showOutcome],
  );

  const onBarcodeScanned = useCallback(
    (data: { data: string }) => {
      if (state.phase !== "idle") return;
      void doLookupThenCheckIn(data.data);
    },
    [state.phase, doLookupThenCheckIn],
  );

  const onRequestOverride = async () => {
    if (!eventId || state.phase !== "outcome" || state.kind !== "duplicate") {
      return;
    }
    setOverrideBusy(true);
    setOverrideBanner(copy.checkIn.overrideBlockedBanner);
    try {
      await registrationService.checkInOverride(eventId, state.code);
      // 若後端已就緒：視為成功
      await showOutcome({
        phase: "outcome",
        kind: "valid",
        code: state.code,
        message: copy.checkIn.checkedIn,
        registration: state.registration,
        checkedInAt: new Date().toISOString(),
      });
      void refreshCounter();
    } catch {
      // B-2 未就緒：保持重複態 + BLOCKED banner（階段完成裁決）
      setOverrideBanner(copy.checkIn.overrideBlockedBanner);
    } finally {
      setOverrideBusy(false);
    }
  };

  const outcome = state.phase === "outcome" ? state : null;
  const outcomeColors =
    outcome?.kind === "valid"
      ? {
          bg: semantic.status.success.bg,
          border: semantic.status.success.border,
          fg: semantic.status.success.fg,
          icon: "check-circle" as const,
          headline: copy.checkIn.validHeadline,
        }
      : outcome?.kind === "duplicate"
        ? {
            bg: semantic.status.warning.bg,
            border: semantic.status.warning.border,
            fg: semantic.status.warning.fg,
            icon: "alert-triangle" as const,
            headline: copy.checkIn.duplicateHeadline,
          }
        : {
            bg: semantic.status.danger.bg,
            border: semantic.status.danger.border,
            fg: semantic.status.danger.fg,
            icon: "x-circle" as const,
            headline: copy.checkIn.invalidHeadline,
          };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader
        title={copy.event.checkInTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />

      <View style={styles.counterBar}>
        <Text style={[type.label, styles.counterLabel]}>
          {copy.checkIn.totalCheckedIn}
          <Text style={type.caption}>{copy.checkIn.counterFallbackHint}</Text>
        </Text>
        <Text style={[type.h3, styles.counterValue]}>
          {counterError
            ? copy.checkIn.dash
            : checkedInTotal == null
              ? "…"
              : String(checkedInTotal)}
        </Text>
      </View>

      {/* 結果態隱藏模式切換，省出一屏空間 */}
      {state.phase === "idle" || state.phase === "loading" ? (
        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => {
              setMode("scan");
              resetToIdle();
            }}
            style={[styles.modeTab, mode === "scan" && styles.modeTabActive]}
          >
            <Icon
              name="qr-code"
              size="sm"
              color={mode === "scan" ? semantic.icon.brand : semantic.icon.muted}
            />
            <Text
              style={[
                type.label,
                {
                  color:
                    mode === "scan"
                      ? semantic.text.primary
                      : semantic.text.muted,
                },
              ]}
            >
              {copy.checkIn.scanMode}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("manual");
              clearResetTimer();
              setOverrideBanner(null);
              setState({ phase: "idle" });
              setScanning(false);
            }}
            style={[styles.modeTab, mode === "manual" && styles.modeTabActive]}
          >
            <Icon
              name="pencil"
              size="sm"
              color={
                mode === "manual" ? semantic.icon.brand : semantic.icon.muted
              }
            />
            <Text
              style={[
                type.label,
                {
                  color:
                    mode === "manual"
                      ? semantic.text.primary
                      : semantic.text.muted,
                },
              ]}
            >
              {copy.checkIn.manualMode}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        {mode === "scan" && state.phase === "idle" ? (
          <View style={styles.cameraContainer}>
            {cameraError ? (
              <View style={styles.cameraFallback}>
                <Icon name="camera" size="xl" color={semantic.icon.muted} />
                <Text style={[type.body, styles.cameraFallbackText]}>
                  {copy.checkIn.cameraUnavailable}
                </Text>
                <Button
                  label={copy.checkIn.switchToManual}
                  variant="secondary"
                  onPress={() => setMode("manual")}
                />
              </View>
            ) : (
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
                onMountError={() => setCameraError(true)}
              />
            )}
            <Text style={[type.caption, styles.scanHint]}>
              {copy.checkIn.scanHint}
            </Text>
          </View>
        ) : null}

        {mode === "manual" && state.phase === "idle" ? (
          <View style={styles.manualBox}>
            <View style={styles.inputWrap}>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder={copy.checkIn.codePlaceholder}
                placeholderTextColor={semantic.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="search"
                enterKeyHint="search"
                clearButtonMode="while-editing"
                enablesReturnKeyAutomatically
                onSubmitEditing={() => {
                  if (manualCode.trim()) {
                    void doLookupThenCheckIn(manualCode);
                  }
                }}
                style={styles.input}
                accessibilityLabel={copy.checkIn.codePlaceholder}
                accessibilityRole="search"
                // Web：原生 type=search（自帶清除）；iOS 用 clearButtonMode
                {...(Platform.OS === "web"
                  ? ({ type: "search" } as object)
                  : null)}
              />
              {/* Android 無原生清除鈕，保留右側清除 */}
              {Platform.OS === "android" && manualCode.length > 0 ? (
                <Pressable
                  onPress={() => setManualCode("")}
                  style={styles.clearButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={copy.checkIn.clearCode}
                >
                  <Icon name="close" size="sm" color={semantic.icon.muted} />
                </Pressable>
              ) : null}
            </View>
            <Button
              label={copy.checkIn.submit}
              size="lg"
              onPress={() => void doLookupThenCheckIn(manualCode)}
              disabled={!manualCode.trim()}
            />
          </View>
        ) : null}

        {state.phase === "loading" ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={semantic.icon.brand} />
            <Text style={[type.body, styles.loadingText]}>
              {copy.checkIn.checking}
            </Text>
          </View>
        ) : null}

        {outcome ? (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: outcomeColors.bg,
                borderColor: outcomeColors.border,
                paddingBottom: Math.max(insets.bottom, space[3]),
              },
            ]}
          >
            <View style={styles.resultHeader}>
              <Icon
                name={outcomeColors.icon}
                size="lg"
                color={outcomeColors.fg}
              />
              <Text
                style={[styles.resultHeadline, { color: outcomeColors.fg }]}
                accessibilityRole="header"
              >
                {outcomeColors.headline}
              </Text>
            </View>

            {outcome.registration ? (
              <>
                <Text style={styles.identityName} numberOfLines={1}>
                  {getRegistrationDisplayName(outcome.registration)}
                </Text>
                <Text style={styles.identityCode} numberOfLines={1}>
                  {getRegistrationCode(outcome.registration)}
                </Text>

                <View style={styles.infoPanel}>
                  <InfoRow
                    label={copy.checkIn.attendeeEmail}
                    value={getRegistrationEmail(outcome.registration)}
                  />
                  <InfoRow
                    label={copy.checkIn.attendeeCompany}
                    value={getRegistrationCompany(outcome.registration)}
                  />
                  <InfoRow
                    label={copy.checkIn.attendeeTicket}
                    value={getRegistrationTicketType(outcome.registration)}
                  />
                  <InfoRow
                    label={copy.checkIn.checkedInAt}
                    value={formatDateTime(
                      outcome.checkedInAt ??
                        getRegistrationCheckedInAt(outcome.registration),
                    )}
                  />
                  {getRegistrationTokenBalance(outcome.registration) !=
                  null ? (
                    <InfoRow
                      label={copy.checkIn.attendeeTokenBalance}
                      value={String(
                        getRegistrationTokenBalance(outcome.registration),
                      )}
                    />
                  ) : null}
                </View>
                <Button
                  label={copy.roster.viewDetail}
                  variant="secondary"
                  onPress={() => {
                    const id = outcome.registration?.id;
                    if (!id || !eventId) return;
                    router.push({
                      pathname:
                        "/(auth)/[eventId]/registrant/[registrationId]" as never,
                      params: {
                        eventId,
                        registrationId: id,
                        code: outcome.registration?.registrationCode ?? outcome.code,
                      },
                    });
                  }}
                />
              </>
            ) : (
              <Text style={styles.identityCode}>{outcome.code}</Text>
            )}

            {outcome.kind === "duplicate" ? (
              <View style={styles.actions}>
                <InlineBanner
                  tone="warning"
                  message={
                    overrideBanner ?? copy.checkIn.overrideBlockedBanner
                  }
                />
                <Button
                  label={copy.checkIn.requestOverride}
                  loading={overrideBusy}
                  onPress={() => void onRequestOverride()}
                />
                <Button
                  label={copy.checkIn.continueScan}
                  variant="secondary"
                  onPress={resetToIdle}
                />
              </View>
            ) : null}

            {outcome.kind === "invalid" ? (
              <View style={styles.actions}>
                <Button
                  label={copy.checkIn.walkInEntry}
                  onPress={() => {
                    router.push({
                      pathname: "/(auth)/[eventId]/walk-in" as never,
                      params: { eventId: eventId ?? "" },
                    });
                  }}
                />
                <Button
                  label={copy.checkIn.continueScan}
                  variant="secondary"
                  onPress={resetToIdle}
                />
              </View>
            ) : null}

            {outcome.kind === "valid" ? (
              <Text style={styles.resetHint}>{copy.checkIn.autoResetIn}…</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  counterBar: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    paddingVertical: space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.border.decorative,
  },
  counterLabel: { color: semantic.text.secondary },
  counterValue: { color: semantic.text.primary },
  modeSwitch: {
    flexDirection: "row",
    gap: spacing.gap,
    paddingHorizontal: spacing.screen,
    marginTop: space[2],
  },
  modeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    minHeight: 40,
  },
  modeTabActive: {
    backgroundColor: semantic.bg.brandSoft,
    borderColor: semantic.border.interactiveSelected,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: space[2],
    paddingBottom: spacing.screen,
    gap: space[2],
  },
  cameraContainer: { flex: 1, gap: spacing.gap },
  camera: { flex: 1, borderRadius: 16, overflow: "hidden" },
  cameraFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.gap,
  },
  cameraFallbackText: { color: semantic.text.muted, textAlign: "center" },
  scanHint: { color: semantic.text.muted, textAlign: "center" },
  manualBox: { gap: spacing.gap, justifyContent: "center", flex: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: 12,
    minHeight: layout.buttonHeight,
    paddingLeft: space[4],
    paddingRight: Platform.OS === "android" ? space[1] : space[4],
  },
  input: {
    flex: 1,
    paddingVertical: space[3],
    paddingRight: space[2],
    fontSize: type.mono.fontSize,
    fontFamily: type.mono.fontFamily,
    color: semantic.text.primary,
    minHeight: layout.buttonHeight,
    // Web search input 避免瀏覽器預設樣式撐破
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none" } as object)
      : null),
  },
  clearButton: {
    width: layout.buttonHeight,
    height: layout.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.gap,
  },
  loadingText: { color: semantic.text.muted },
  resultCard: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: space[2],
    borderRadius: 12,
    paddingHorizontal: space[3],
    paddingTop: space[3],
    borderWidth: 2,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
  },
  resultHeadline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  identityName: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: semantic.text.primary,
    textAlign: "center",
  },
  identityCode: {
    ...type.mono,
    fontSize: 13,
    color: semantic.text.secondary,
    textAlign: "center",
  },
  infoPanel: {
    backgroundColor: semantic.bg.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    minHeight: 32,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.border.decorative,
  },
  infoLabel: {
    ...type.caption,
    color: semantic.text.muted,
    flexShrink: 0,
    width: 64,
  },
  infoValue: {
    ...type.body,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: semantic.text.primary,
    flex: 1,
    textAlign: "right",
  },
  actions: {
    gap: space[2],
    marginTop: space[1],
  },
  resetHint: {
    ...type.caption,
    color: semantic.text.muted,
    textAlign: "center",
    marginTop: space[2],
  },
});
