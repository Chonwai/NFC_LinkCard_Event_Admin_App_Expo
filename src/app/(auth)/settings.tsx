import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { semantic, spacing, type } from "@/constants/theme";
import { useAuthStore } from "@/stores/auth.store";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuthStore();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title={copy.settings.title} />
      <View style={styles.body}>
        {user?.email ? (
          <Text style={[type.caption, styles.email]}>{user.email}</Text>
        ) : null}
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
  version: {
    textAlign: "center",
    color: semantic.text.muted,
    marginBottom: spacing.gap,
  },
});
