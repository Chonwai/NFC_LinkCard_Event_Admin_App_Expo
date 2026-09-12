import { type ReactNode } from 'react';
import {
    type AccessibilityState,
    Pressable,
    type StyleProp,
    StyleSheet,
    View,
    type ViewProps,
    type ViewStyle,
} from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useFocusRing } from '@/components/ui/useFocusRing';
import { components, semantic, space } from '@/constants/theme';

interface CardCommonProps {
    children: ReactNode;
    /** default = 白底 + 1px 裝飾邊框；sunken = 灰底（用於展開的子清單） */
    tone?: 'default' | 'sunken';
    /** 內距；未提供時採 tone 對應 token（default 16 / sunken 12） */
    padding?: number;
    /** 是否顯示 chevron（僅在 onPress 存在時有意義） */
    showChevron?: boolean;
    /**
     * 可及性狀態（如展開中的清單項 `{ expanded: true }`）。
     *
     * RNW 0.21 **不**把 `accessibilityState` 映射到 DOM 屬性（C6 H1 發現），
     * 因此本元件會同時輸出對應的 `aria-*`，讓 web 的讀屏與自動化都能讀到。
     */
    accessibilityState?: AccessibilityState;
    /**
     * 版面量測。
     *
     * 需要「把這個區塊捲進可視區」的頁面會用到（如 `claim/[token].tsx` 的
     * 就地欄位級錯誤，**C-5**）；回報的座標是**相對於父容器**，呼叫端可直接當成
     * 捲動容器的 `scrollTo` 目標。未傳時行為與原本完全不變。
     */
    onLayout?: ViewProps['onLayout'];
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessibilityHint?: string;
}

/** `onPress` 存在時 `accessibilityLabel` 為必填（§3.2 a11y），以聯合型別在編譯期強制 */
export type CardProps = CardCommonProps &
    (
        | { onPress: () => void; accessibilityLabel: string }
        | { onPress?: undefined; accessibilityLabel?: string }
    );

/**
 * 共用卡片容器（**凍結 D-3：白底 + 細邊框，不用陰影**）
 * - 非互動時 `accessible={false}`：容器不搶焦點，讓內部文字各自可讀
 * - 互動時改用 `Pressable` 並提供 button role 與必填 label
 */
export function Card({
    children,
    tone = 'default',
    padding,
    onPress,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    showChevron = false,
    onLayout,
    style,
    testID,
}: CardProps) {
    const { focused, focusRingProps, focusRingResetStyle } = useFocusRing();
    const toneToken = tone === 'sunken' ? components.cardSunken : components.card;

    const cardStyle = (pressed: boolean): StyleProp<ViewStyle> => [
        styles.base,
        showChevron && styles.row,
        {
            backgroundColor: pressed ? semantic.bg.brandSoft : toneToken.bg,
            borderColor: focused ? components.focusRing.color : toneToken.borderColor,
            borderWidth: focused ? components.focusRing.width : toneToken.borderWidth,
            borderRadius: toneToken.radius,
            padding: padding ?? toneToken.padding,
        },
        toneToken.elevation,
        style,
    ];

    const content = showChevron ? (
        <>
            <View style={styles.grow}>{children}</View>
            <Icon
                name="chevron-right"
                size="md"
                color={semantic.icon.default}
                style={styles.chevron}
            />
        </>
    ) : (
        children
    );

    if (!onPress) {
        return (
            <View style={cardStyle(false)} onLayout={onLayout} testID={testID} accessible={false}>
                {content}
            </View>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            {...focusRingProps}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityState={accessibilityState}
            /** RNW 0.21 不映射 `accessibilityState` → 手動補 `aria-expanded`（C6 H1） */
            aria-expanded={accessibilityState?.expanded}
            testID={testID}
            /** M-5：只歸零 UA 橘框；聚焦環仍由 `components.focusRing` 的邊框承擔 */
            style={focusRingResetStyle}
        >
            {({ pressed }) => (
                <View style={cardStyle(pressed)} onLayout={onLayout}>
                    {content}
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: { alignSelf: 'stretch' },
    row: { flexDirection: 'row', alignItems: 'center' },
    grow: { flex: 1 },
    chevron: { marginLeft: space[2] },
});
