import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { semantic, spacing, type } from "@/constants/theme";
import { useAuthStore } from "@/stores/auth.store";
import { isNfcSupported } from "@/utils/nfc-utils";

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

  const nfcLabel =
    nfcOk == null
      ? copy.checkIn.dash
      : nfcOk
        ? copy.settings.nfcSupported
        : copy.settings.nfcNotSupported;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title={copy.settings.title} />
      <View style={styles.body}>
        {user?.email ? (
          <Text style={[type.caption, styles.email]}>{user.email}</Text>
        ) : null}
        <Text style={[type.body, styles.nfcStatus]} testID="settings-nfc-status">
          {copy.settings.nfcStatus}：{nfcLabel}
        </Text>
        <Text style={[type.caption, styles.version]}>
          {copy.app.name} · {copy.app.version}
        </Text>
        <Button
          label={copy.settings.logout}
          variant="danger"
          onPress={() => {
            void logout();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    flex: 1,
    padding: spacing.screen,
    gap: spacing.section,
    justifyContent: "center",
  },
  email: { textAlign: "center", color: semantic.text.secondary },
  nfcStatus: { textAlign: "center", color: semantic.text.primary },
  version: {
    textAlign: "center",
    color: semantic.text.muted,
    marginBottom: spacing.gap,
  },
});
