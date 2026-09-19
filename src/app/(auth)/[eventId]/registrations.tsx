import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { semantic, spacing } from "@/constants/theme";

/**
 * WP-A8：名單入口 placeholder（完整列表待 WP-A5）。
 * 從概覽點入不白屏。
 */
export default function RegistrationsPlaceholderScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.event.registrationsTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <View style={styles.body}>
        <EmptyState
          kind="first-use"
          headingLevel={2}
          title={copy.event.modulePlaceholderTitle}
          description={copy.event.registrationsPlaceholderHint}
          actionLabel={copy.event.backToOverview}
          onAction={() => {
            if (eventId) {
              router.replace({
                pathname: "/(auth)/[eventId]/overview",
                params: { eventId },
              });
            } else {
              router.replace("/(auth)/home");
            }
          }}
          testID="registrations-placeholder"
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
    justifyContent: "center",
  },
});
