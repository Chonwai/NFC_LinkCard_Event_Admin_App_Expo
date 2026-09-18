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
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
import { registrationService } from "@/services/registration.service";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/api-error";

type CheckInState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; ok: boolean; message: string; code: string };

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_CHECKED_IN: copy.checkIn.alreadyCheckedIn,
  REGISTRATION_NOT_CONFIRMED: copy.checkIn.notConfirmed,
  REGISTRATION_NOT_FOUND: copy.checkIn.registrationNotFound,
  INSUFFICIENT_PERMISSION: copy.checkIn.notEnoughPermission,
};

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [scanning, setScanning] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [state, setState] = useState<CheckInState>({ phase: "idle" });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const clearResetTimer = () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  };

  const doCheckIn = useCallback(
    async (code: string) => {
      if (!eventId || !code.trim()) return;
      setState({ phase: "loading" });
      setScanning(false);
      clearResetTimer();

      try {
        await registrationService.checkIn(eventId, code.trim());
        setState({
          phase: "result",
          ok: true,
          message: copy.checkIn.checkedIn,
          code: code.trim(),
        });
      } catch (err) {
        const codeKey = getApiErrorCode(err);
        const message =
          (codeKey != null && ERROR_MESSAGES[codeKey]) ||
          getApiErrorMessage(err, copy.checkIn.registrationNotFound);
        setState({ phase: "result", ok: false, message, code: code.trim() });
      }

      // 3s auto-reset（現場快速連續操作）
      resetTimer.current = setTimeout(() => {
        setState({ phase: "idle" });
        setScanning(true);
      }, 3000);
    },
    [eventId],
  );

  useEffect(() => clearResetTimer, []);

  const onBarcodeScanned = useCallback(
    (data: { data: string }) => {
      if (state.phase !== "idle") return; // 已處理中忽略重複掃描
      void doCheckIn(data.data);
    },
    [state.phase, doCheckIn],
  );

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

      {/* 模式切換 */}
      <View style={styles.modeSwitch}>
        <Pressable
          onPress={() => {
            setMode("scan");
            setState({ phase: "idle" });
            setScanning(true);
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
                  mode === "scan" ? semantic.text.primary : semantic.text.muted,
              },
            ]}
          >
            {copy.checkIn.scanMode}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode("manual");
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
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder={copy.checkIn.codePlaceholder}
              placeholderTextColor={semantic.text.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel={copy.checkIn.codePlaceholder}
            />
            <Button
              label={copy.checkIn.submit}
              onPress={() => void doCheckIn(manualCode)}
              loading={false}
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

        {state.phase === "result" ? (
          <View
            style={[
              styles.resultCard,
              state.ok ? styles.resultOk : styles.resultFail,
            ]}
          >
            <Icon
              name={state.ok ? "check-circle" : "x-circle"}
              size="xl"
              color={
                state.ok
                  ? semantic.status.success.fg
                  : semantic.status.danger.fg
              }
            />
            <Text style={[type.h3, styles.resultTitle]}>{state.message}</Text>
            <Text style={[type.mono, styles.resultCode]}>{state.code}</Text>
            <Text style={[type.caption, styles.resetHint]}>
              {copy.checkIn.autoResetIn}…
            </Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  modeSwitch: {
    flexDirection: "row",
    gap: spacing.gap,
    paddingHorizontal: spacing.screen,
    marginTop: spacing.gap,
  },
  modeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  modeTabActive: {
    backgroundColor: semantic.bg.brandSoft,
    borderColor: semantic.border.interactiveSelected,
  },
  body: { flex: 1, padding: spacing.screen, gap: spacing.section },
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
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.gap,
  },
  loadingText: { color: semantic.text.muted },
  resultCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.gap,
    borderRadius: 16,
    padding: spacing.group,
    borderWidth: 1,
  },
  resultOk: {
    backgroundColor: semantic.status.success.bg,
    borderColor: semantic.status.success.border,
  },
  resultFail: {
    backgroundColor: semantic.status.danger.bg,
    borderColor: semantic.status.danger.border,
  },
  resultTitle: { textAlign: "center" },
  resultCode: { color: semantic.text.secondary },
  resetHint: { color: semantic.text.muted },
});
