import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { copy } from "@/constants/copy.zh-TW";
import { spacing, semantic, type } from "@/constants/theme";

/**
 * `F-07`：非開發建置缺少 `EXPO_PUBLIC_API_URL` 時的啟動畫面。
 *
 * 設計取捨（與 Promoter App `W-24` 對齊）：
 * - **不 throw**。module-load throw 會白屏，現場人員與維運都拿不到任何線索。
 * - **不 fallback 到 production**。報到、walk-in、NFC 綁卡都是寫入操作；
 *   一個漏設變數的 preview／staging build 會污染 production 資料。
 * - **在此停住**。`api.ts` 的 request interceptor 也會拒絕請求（第二道防線），
 *   但畫面必須先說清楚發生什麼事，否則錯誤會偽裝成「登入一直失敗」。
 *
 * 純展示元件：不讀 store、不發請求、不吞錯誤。
 */
export function AppConfigErrorScreen({ reason }: { reason: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + spacing.screen }]}
      testID="app-config-error"
    >
      <Text style={[type.h2, styles.title]} accessibilityRole="header">
        {copy.appConfig.title}
      </Text>
      <Text style={[type.body, styles.message]}>{copy.appConfig.message}</Text>
      <Text style={[type.micro, styles.reason]}>
        {`${copy.appConfig.reasonLabel}: ${reason}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: semantic.bg.canvas,
    paddingHorizontal: spacing.screen,
    justifyContent: "center",
    gap: spacing.gap,
  },
  title: {
    color: semantic.text.primary,
  },
  message: {
    color: semantic.text.secondary,
  },
  reason: {
    color: semantic.text.muted,
  },
});
