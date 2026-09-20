import { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Constants from "expo-constants";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { useAuthStore } from "@/stores/auth.store";
import { isNfcSupported } from "@/utils/nfc-utils";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={styles.infoLabel}
        maxFontSizeMultiplier={layout.maxFontScaleBody}
      >
        {label}
      </Text>
      <Text
        style={styles.infoValue}
        numberOfLines={1}
        ellipsizeMode="middle"
        maxFontSizeMultiplier={layout.maxFontScaleBody}
      >
        {value}
      </Text>
    </View>
  );
}

/** NFC 狀態色標：支援綠 / 不支援紅 / 偵測中灰 */
function NfcStatusBadge({
  status,
}: {
  status: "checking" | "supported" | "unsupported";
}) {
  const tone =
    status === "supported"
      ? semantic.status.success
      : status === "unsupported"
        ? semantic.status.danger
        : semantic.status.neutral;

  const label =
    status === "supported"
      ? copy.settings.nfcSupported
      : status === "unsupported"
        ? copy.settings.nfcNotSupported
        : copy.settings.nfcChecking;

  return (
    <View
      style={[
        styles.nfcBadge,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${copy.settings.nfcStatus}：${label}`}
      testID="settings-nfc-status"
    >
      <View style={[styles.nfcDot, { backgroundColor: tone.fg }]} />
      <Text
        style={[type.badge, { color: tone.fg }]}
        maxFontSizeMultiplier={layout.maxFontScaleFixed}
      >
        {label}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuthStore();
  const [nfcOk, setNfcOk] = useState<boolean | null>(
    Platform.OS === "web" ? false : null,
  );

  useEffect(() => {
    let active = true;
    void isNfcSupported().then((ok) => {
      if (active) setNfcOk(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const appVersion =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    copy.app.version;

  const displayName = user?.display_name?.trim() || null;
  const email = user?.email?.trim() || null;
  const username = user?.username?.trim() || null;
  /** 與 email / 顯示名稱重複時不另列一欄 */
  const showUsername =
    username != null &&
    username !== email &&
    username !== displayName;

  const nfcStatus: "checking" | "supported" | "unsupported" =
    nfcOk == null ? "checking" : nfcOk ? "supported" : "unsupported";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title={copy.settings.title} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <Text
            style={styles.sectionTitle}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {copy.settings.accountSection}
          </Text>

          {user == null ? (
            <Text
              style={styles.accountUnavailable}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.settings.accountUnavailable}
            </Text>
          ) : (
            <View style={styles.accountRows}>
              {displayName != null ? (
                <InfoRow
                  label={copy.settings.displayNameLabel}
                  value={displayName}
                />
              ) : null}
              {email != null ? (
                <InfoRow label={copy.settings.emailLabel} value={email} />
              ) : null}
              {showUsername ? (
                <InfoRow
                  label={copy.settings.usernameLabel}
                  value={username}
                />
              ) : null}
              {displayName == null && email == null && !showUsername ? (
                <Text
                  style={styles.accountUnavailable}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.settings.accountUnavailable}
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <Text
            style={styles.sectionTitle}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {copy.settings.deviceSection}
          </Text>
          <InfoRow label={copy.settings.appVersion} value={appVersion} />
          <View style={styles.nfcRow}>
            <Text
              style={styles.infoLabel}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.settings.nfcStatus}
            </Text>
            <NfcStatusBadge status={nfcStatus} />
          </View>
        </Card>

        <Button
          label={copy.settings.logout}
          variant="danger"
          onPress={() => {
            void logout();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  scroll: { flex: 1 },
  content: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: space[8],
  },
  card: { alignSelf: "stretch" },
  sectionTitle: {
    ...type.label,
    color: semantic.text.secondary,
    marginBottom: space[3],
  },
  accountRows: { gap: space[3] },
  accountUnavailable: {
    ...type.body,
    color: semantic.text.muted,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    minHeight: layout.touchMin / 2,
  },
  infoLabel: {
    ...type.caption,
    color: semantic.text.muted,
    flexShrink: 0,
  },
  infoValue: {
    ...type.body,
    color: semantic.text.primary,
    flex: 1,
    textAlign: "right",
  },
  nfcRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    marginTop: space[3],
  },
  nfcBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  nfcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
