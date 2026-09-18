import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router } from "expo-router";

import { Icon } from "@/components/ui/Icon";
import { useFocusRing } from "@/components/ui/useFocusRing";
import {
  hairline,
  layout,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";

/**
 * 可作為「無歷史時返回」fallback 的 App 內路徑。
 *
 * F-4 收斂：原本為 `Href`，會允許傳入任意（含動態）路由字串，導致呼叫端可能寫出
 * 無法解析的路徑而不被編譯器攔下。這裡改為明確的內部字面路徑 union。
 */
export type BackFallbackPath =
  | "/"
  | "/(auth)/home"
  | "/(auth)/settings"
  | "/(auth)/[eventId]/overview"
  | "/(auth)/[eventId]/check-in"
  | "/(auth)/[eventId]/nfc-bind"
  | "/(auth)/[eventId]/badges";

export interface ScreenHeaderProps {
  title: string;
  /** 副標題（一句話說明本頁目的，提升現場可用性） */
  subtitle?: string;
  /** 左側：'none' | 'back'（自動 `router.back()`，無歷史時 fallback replace） */
  leading?: "none" | "back";
  /** 無歷史時的 fallback 路徑（避免 F2 的死路）。僅接受 App 內字面路徑（F-4 收斂） */
  backFallbackPath?: BackFallbackPath;
  /** 右側動作（如「+ 新增批次」） */
  right?: ReactNode;
  /** 顯示「重新整理」icon 按鈕（取代 pull-to-refresh，D-7 的補償機制） */
  onRefresh?: () => void;
  /** 重新整理中（icon 按鈕 disabled + busy） */
  isRefreshing?: boolean;
  testID?: string;
}

/**
 * 頁面標題列（B1 雙重標題結案）
 *
 * 在 tab group 內本元件是**唯一的頁面標題來源**（Tabs 的 `headerShown` 於 C5 關閉），
 * 並同時承擔「取代 pull-to-refresh 的手動重整入口」（D-7 / R6 的補償）。
 *
 * - `paddingTop: insets.top` 修正 B5（瀏海遮擋）
 * - 返回鈕與重整鈕皆為 48×48，`hitSlop` 再放大（觸控目標 ≥ 48）
 * - `leading="back"` 在無歷史時 fallback replace，避免 F2 的「按了沒反應」
 */
export function ScreenHeader({
  title,
  subtitle,
  leading = "none",
  backFallbackPath,
  right,
  onRefresh,
  isRefreshing = false,
  testID,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  /**
   * **M-5 結案**：這兩個 icon 鈕原本是裸 `Pressable`，實測聚焦後
   * `outline 1.5px none` / `border 0px` / 背景不變 → **零聚焦指示**。
   *
   * 它們是 App 內最常被鍵盤與切換控制使用的按鈕（每一頁的返回與重新整理），
   * 因此改走既有的 `useFocusRing()`（品牌紫 `#7C3AED`、`outlineWidth: 2`、
   * `outlineOffset: 2`——用 outline 而非邊框，不動 48×48 的觸控目標與版面）。
   * 兩個鈕各自持有聚焦狀態（同一時間只會有一個被聚焦）。
   */
  const backRing = useFocusRing();
  const refreshRing = useFocusRing();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backFallbackPath ?? "/");
  };

  return (
    <View
      style={[styles.container, { paddingTop: insets.top }]}
      testID={testID}
    >
      <View style={styles.row}>
        {leading === "back" ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="返回"
            hitSlop={space[2]}
            style={[styles.iconButton, backRing.focusRingStyle]}
            {...backRing.focusRingProps}
          >
            <Icon name="arrow-left" size="lg" color={semantic.icon.default} />
          </Pressable>
        ) : null}

        <View style={styles.titles}>
          <Text
            style={styles.title}
            accessibilityRole="header"
            numberOfLines={1}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {title}
          </Text>
          {subtitle != null ? (
            <Text
              style={styles.subtitle}
              numberOfLines={1}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {onRefresh != null ? (
            <Pressable
              onPress={onRefresh}
              disabled={isRefreshing}
              accessibilityRole="button"
              accessibilityLabel={isRefreshing ? "重新整理中" : "重新整理"}
              accessibilityState={{
                busy: isRefreshing,
                disabled: isRefreshing,
              }}
              hitSlop={space[2]}
              /** M-5：與返回鈕同一套聚焦環（不新增樣式、不動 48×48 觸控目標） */
              style={[styles.iconButton, refreshRing.focusRingStyle]}
              {...refreshRing.focusRingProps}
            >
              {isRefreshing ? (
                <ActivityIndicator color={semantic.action.primary} />
              ) : (
                <Icon name="refresh" size="lg" color={semantic.icon.default} />
              )}
            </Pressable>
          ) : null}
          {right}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    backgroundColor: semantic.bg.canvas,
    borderBottomWidth: hairline,
    borderBottomColor: semantic.border.decorative,
  },
  row: {
    minHeight: layout.headerHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: spacing.screen,
  },
  /** 48×48 觸控目標，`hitSlop` 再放大至 ≥ 56 */
  iconButton: {
    width: layout.touchMin,
    height: layout.touchMin,
    alignItems: "center",
    justifyContent: "center",
  },
  /** `minWidth: 0` 讓 `numberOfLines={1}` 在長標題時能真正截斷 */
  titles: { flex: 1, minWidth: 0, justifyContent: "center" },
  title: { ...type.h1, color: semantic.text.primary },
  subtitle: {
    ...type.caption,
    color: semantic.text.muted,
    marginTop: space[1],
  },
  actions: { flexDirection: "row", alignItems: "center", gap: space[3] },
});
