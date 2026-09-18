import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { semantic, spacing } from "@/constants/theme";

/**
 * WP-A7：現場補報名入口 placeholder（完整表單待 WP-A5 / Phase 6）。
 * 保證從無效簽到態點入不白屏。
 */
export default function WalkInPlaceholderScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.checkIn.walkInTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <View style={styles.body}>
        <EmptyState
          kind="no-results"
          headingLevel={2}
          title={copy.checkIn.walkInPlaceholderTitle}
          description={copy.checkIn.walkInPlaceholderHint}
          actionLabel={copy.checkIn.continueScan}
          onAction={() => {
            if (eventId) {
              router.replace({
                pathname: "/(auth)/[eventId]/check-in",
                params: { eventId },
              });
            } else {
              router.replace("/(auth)/home");
            }
          }}
          testID="walk-in-placeholder"
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
