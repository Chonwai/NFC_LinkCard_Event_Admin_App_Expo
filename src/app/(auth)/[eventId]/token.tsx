import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { semantic, spacing } from "@/constants/theme";

/**
 * WP-A8：Token 入口 placeholder。
 *
 * ⚠️ 2026-10-22 修正（parity §S-8）：原本的次要動作會開啟
 * `LinkCard_Frontend` 的「主辦方錢包」頁——但那個路由**不存在**
 * （已用 `test -d` 驗證，且 `next.config.js` / `middleware.ts` 沒有對應 rewrite），
 * 按下去就是 404。Web 唯一的錢包頁是**參加者**視角，不是主辦方櫃台。
 *
 * 真正存在的資料在 App 自己身上：每位參加者的詳情頁已經有 Token 流水。
 * 所以出口改成「去名單找人」，而不是指向一個不存在的網頁。
 */
export default function TokenPlaceholderScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.event.tokenTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <View style={styles.body}>
        <EmptyState
          kind="first-use"
          headingLevel={2}
          title={copy.event.modulePlaceholderTitle}
          description={copy.event.tokenPlaceholderHint}
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
          secondaryLabel={eventId ? copy.event.tokenOpenRoster : undefined}
          onSecondary={
            eventId
              ? () => {
                  router.replace({
                    pathname: "/(auth)/[eventId]/registrations" as never,
                    params: { eventId },
                  });
                }
              : undefined
          }
          testID="token-placeholder"
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
