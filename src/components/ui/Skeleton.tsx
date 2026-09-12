import { useEffect, useState } from 'react';
import { Animated, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { components, layout, space } from '@/constants/theme';

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

export interface SkeletonListProps {
    /** 列數（預設 `layout.skeletonRows` = 3） */
    rows?: number;
    /** 每列高度（預設 72，對齊 inventory 批次列） */
    rowHeight?: number;
    /** 列間距（預設 `space[3]`） */
    gap?: number;
    testID?: string;
}

/** shimmer 的最低不透明度（只動 opacity 才能 `useNativeDriver`，§8.3 T5） */
const PULSE_MIN_OPACITY = 0.55;
const PULSE_DURATION = 700;
const DEFAULT_ROW_HEIGHT = 72;

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
 * 本元件對讀屏**完全隱藏**（無語意內容）；載入狀態的告知由 `SkeletonList`
 * 或呼叫端的 `accessibilityState={{ busy: true }}` 承擔。
 */
export function Skeleton({
    width = '100%',
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
            ])
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

/**
 * 多列 skeleton 區塊（載入區塊的**外層容器**）
 *
 * 對照 §3.9 的「父層提供 `accessibilityState={{ busy: true }}`」：因內部
 * skeleton 對讀屏隱藏，故由本容器統一向讀屏告知「載入中」。
 */
export function SkeletonList({
    rows = layout.skeletonRows,
    rowHeight = DEFAULT_ROW_HEIGHT,
    gap = space[3],
    testID,
}: SkeletonListProps) {
    return (
        <View
            style={[styles.list, { gap }]}
            testID={testID}
            accessible
            accessibilityLabel="載入中"
            accessibilityState={{ busy: true }}
        >
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={`skeleton-${index}`} height={rowHeight} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    block: { alignSelf: 'flex-start' },
    list: { alignSelf: 'stretch' },
});
