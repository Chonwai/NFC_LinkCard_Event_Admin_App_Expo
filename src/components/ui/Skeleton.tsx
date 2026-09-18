import { useEffect, useState } from "react";
import {
  Animated,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";

import { components } from "@/constants/theme";

export interface SkeletonProps {
  /** 寬度；預設撐滿父層 */
  width?: number | `${number}%`;
  height: number;
  /** 圓角（預設 `components.skeleton.radius`） */
  radius?: number;
  /** true = 跑 shimmer（只動 opacity）；false = 靜態灰塊 */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** shimmer 的最低不透明度（只動 opacity 才能 `useNativeDriver`，§8.3 T5） */
const PULSE_MIN_OPACITY = 0.55;
const PULSE_DURATION = 700;

/**
 * 載入佔位塊（shimmer）
 *
 * **兩條硬規則**（§3.9，違反會造成 runtime 缺陷）：
 * 1. `Animated.loop` 的子動畫一律 `isInteraction: false`，否則 `FlatList`
 *    的 `onEndReached` 不再觸發（§8.3 T4）。
 * 2. Skeleton 只能作為**內容的兄弟節點**，**不可包在可點擊項內**；清單項的
 *    loading 一律使用 `animated={false}`。RN 新架構下，可點擊項上的持續動畫
 *    會讓 `onPress` 失效（RN Issue #51621，§8.3 T3）。
 *
 * 本元件對讀屏**完全隱藏**（無語意內容）；載入狀態的告知由呼叫端的
 * `accessibilityState={{ busy: true }}` 承擔（W-13 已移除未使用的 `SkeletonList`）。
 */
export function Skeleton({
  width = "100%",
  height,
  radius: radiusOverride,
  animated = true,
  style,
}: SkeletonProps) {
  /** 以 `useState` 建立：跨 render 穩定，且必須在 render 被讀取（見 BottomSheet 同註解） */
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!animated) {
      opacity.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN_OPACITY,
          duration: PULSE_DURATION,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_DURATION,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [animated, opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radiusOverride ?? components.skeleton.radius,
          backgroundColor: components.skeleton.base,
          opacity,
        },
        style,
      ]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: "flex-start" },
});
