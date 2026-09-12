import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { layout, semantic, space, type } from '@/constants/theme';

export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
    /** sm 24 / md 40 / lg 64 */
    size?: LogoSize;
    /** 是否顯示「LinkCard Event Admin」文字 */
    withWordmark?: boolean;
    /** 品牌文字（預設「LinkCard Event Admin」） */
    wordmark?: string;
    /** 文字方向 */
    direction?: 'row' | 'column';
    /** 無障礙標籤；預設「LinkCard Event Admin」 */
    accessibilityLabel?: string;
    testID?: string;
}

const TILE_SIZES: Record<LogoSize, number> = {
    sm: layout.icon.lg,
    /** 40 無對應 token，明示為具名常數（§3.12 md = 40） */
    md: 40,
    lg: layout.icon.hero,
};

/**
 * 圓角比例：1:1 對齊 LinkCard_Frontend favicon 的
 * `<rect width="24" height="24" rx="6">`（6 / 24 = 0.25）。
 * 因此 sm(24) → 6、md(40) → 10、lg(64) → 16（§3.12）。
 */
const TILE_RADIUS_RATIO = 0.25;

/**
 * 品牌標誌（A4 結案：登入頁原本只有純文字，無 logo mark）
 *
 * **1:1 複刻 Frontend mark 的構圖**：
 * - 圓角方底：`<rect width=24 height=24 rx=6>` + 品牌紫填色
 *   → 以 RN `View` 的 `borderRadius` + `backgroundColor: semantic.action.primary` 實作，
 *   **完全不使用 SVG `fillRule`**（§8.3 T12：`fillRule` 在部分 Android 版本渲染不一致）
 * - 閃電：`<Icon name="logo-mark">`，尺寸與底板 1:1（同一條 path，24 viewBox 座標系），
 *   因此不需額外縮放或內距。**描邊**而非填色——與 `assets/brand/logo-mark.svg`
 *   的 `fill="none" stroke="#FFFFFF" stroke-width="2"` 四方對齊
 *   （`logo-mark.svg` / `icon.png` / `splash-icon.png` / 執行期 DOM，**H-9 結案**）
 * - 白閃電 on `semantic.action.primary` = 5.70 ✅（非文字 3:1 亦遠超）
 *
 * **禁滿版紫底**：此處紫底僅限 `size × size` 的方塊，非全螢幕（§0.4 第 7 條）。
 */
export function Logo({
    size = 'md',
    withWordmark = true,
    wordmark = 'LinkCard Event Admin',
    direction = 'row',
    accessibilityLabel,
    testID,
}: LogoProps) {
    const tileSize = TILE_SIZES[size];
    const isColumn = direction === 'column';

    return (
        <View
            style={[styles.container, isColumn ? styles.column : styles.row]}
            testID={testID}
            accessible
            accessibilityRole="image"
            accessibilityLabel={accessibilityLabel ?? 'LinkCard Event Admin'}
        >
            <View
                style={{
                    width: tileSize,
                    height: tileSize,
                    borderRadius: tileSize * TILE_RADIUS_RATIO,
                    backgroundColor: semantic.action.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
            >
                <Icon name="logo-mark" size={tileSize} color={semantic.text.onPrimary} />
            </View>

            {withWordmark ? (
                <Text
                    style={isColumn ? styles.wordmarkColumn : styles.wordmarkRow}
                    numberOfLines={1}
                    maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                    {wordmark}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignSelf: 'flex-start' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    column: { alignItems: 'center', gap: space[2] },
    wordmarkRow: { ...type.h3, color: semantic.text.primary },
    wordmarkColumn: { ...type.h2, color: semantic.text.primary },
});
