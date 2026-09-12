import { type ReactNode, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFocusRing } from '@/components/ui/useFocusRing';
import { components, layout, space, type } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
    /** 按鈕文字（繁體中文） */
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    /** md = 48 高（一般）；lg = 56 高（主要 CTA） */
    size?: ButtonSize;
    /** 載入中：顯示 ActivityIndicator、自動 disabled、accessibilityState.busy */
    loading?: boolean;
    disabled?: boolean;
    /** 左側 icon（可選）；顏色由呼叫端以 `semantic.icon.*` 指定 */
    icon?: ReactNode;
    /** 佔滿父層寬度（默認 true，單手操作情境幾乎都是全寬） */
    fullWidth?: boolean;
    /** 無障礙標籤；未提供時退回 label */
    accessibilityLabel?: string;
    accessibilityHint?: string;
    testID?: string;
}

/** 按壓動畫時長；短到不影響連點（§3.1 動畫實作要點） */
const PRESS_ANIMATION_DURATION = 90;
const PRESS_SCALE = 0.98;

/**
 * 共用按鈕（5 variant × 2 size）
 * - 高度由 `layout.buttonHeight`（48）/ `layout.ctaHeight`（56）保證觸控目標
 * - disabled 不再只降 opacity，改用中性灰底 + `text.disabled`（4.83 ✅）
 * - 只動 `transform: scale`，`useNativeDriver: true` + `isInteraction: false`（§8.3 T4/T5）
 */
export function Button({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    fullWidth = true,
    accessibilityLabel,
    accessibilityHint,
    testID,
}: ButtonProps) {
    const { focused, focusRingProps, focusRingResetStyle } = useFocusRing();
    const scale = useRef(new Animated.Value(1)).current;

    const isInactive = disabled || loading;
    /** 幾何（radius / padding）恆取自 variant；色彩在 inactive 時改走 disabled token */
    const variantToken = components.button[variant];
    const colorToken = isInactive ? components.button.disabled : variantToken;
    const minHeight = size === 'lg' ? layout.ctaHeight : layout.buttonHeight;

    const animateScale = (toValue: number) => {
        Animated.timing(scale, {
            toValue,
            duration: PRESS_ANIMATION_DURATION,
            useNativeDriver: true,
            isInteraction: false,
        }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={isInactive}
            onPressIn={() => animateScale(PRESS_SCALE)}
            onPressOut={() => animateScale(1)}
            {...focusRingProps}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: isInactive, busy: loading }}
            /**
             * H1（C12）：RNW 0.21 **完全不映射** `accessibilityState` 物件（只認單數
             * `accessibilityBusy` 與 `aria-*`），因此 web 上原本沒有任何 disabled /
             * busy 語意。同時輸出 `aria-*`（純增量、零視覺變更）。
             */
            aria-disabled={isInactive}
            aria-busy={loading}
            testID={testID}
            /**
             * M-5：聚焦環仍由下方 `components.focusRing` 的邊框承擔；
             * `focusRingResetStyle` 只把 Chromium 的 UA 橘框歸零，避免雙框。
             */
            style={
                fullWidth
                    ? [styles.pressableFull, focusRingResetStyle]
                    : [styles.pressableHug, focusRingResetStyle]
            }
        >
            {({ pressed }) => (
                <Animated.View
                    style={[
                        styles.container,
                        {
                            minHeight,
                            borderRadius: variantToken.radius,
                            paddingHorizontal: variantToken.paddingHorizontal,
                            backgroundColor:
                                pressed && !isInactive ? variantToken.bgPressed : colorToken.bg,
                            borderColor: focused
                                ? components.focusRing.color
                                : colorToken.borderColor,
                            borderWidth: focused
                                ? components.focusRing.width
                                : colorToken.borderWidth,
                            transform: [{ scale }],
                        },
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator
                            style={styles.leading}
                            size="small"
                            color={colorToken.label}
                        />
                    ) : icon ? (
                        <View style={styles.leading}>{icon}</View>
                    ) : null}
                    <Text
                        style={[styles.label, { color: colorToken.label }]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={layout.maxFontScaleFixed}
                    >
                        {label}
                    </Text>
                </Animated.View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pressableFull: { alignSelf: 'stretch' },
    pressableHug: { alignSelf: 'flex-start' },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    /** icon / spinner 與文字之間；兩者寬度相近（24 / ~20）以減少文字位移 */
    leading: { marginRight: space[2] },
    /** 按鈕標籤：bodyLg 字級（16），字重提升至 semibold；§3.1 未另立 label token */
    label: { ...type.bodyLg, fontWeight: '600' },
});
