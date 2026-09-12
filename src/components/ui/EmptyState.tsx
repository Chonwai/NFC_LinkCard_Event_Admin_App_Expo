import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { layout, semantic, space, type } from '@/constants/theme';

/** 空狀態的三種語氣分流（凍結要求，§3.6） */
export type EmptyKind =
    | 'first-use' // 資料從未存在 → 引導 + 主要 CTA
    | 'no-results' // 搜尋無結果 → 中立 + 清除搜尋
    | 'filtered'; // 篩選後為空 → 明確指出是篩選造成 + 清除篩選

export interface EmptyStateProps {
    kind?: EmptyKind;
    title: string;
    description?: string;
    /** 主要動作 */
    actionLabel?: string;
    onAction?: () => void;
    /** 次要動作（如「清除篩選」） */
    secondaryLabel?: string;
    onSecondary?: () => void;
    /** 插圖（預設依 kind 決定） */
    icon?: IconName;
    /** 縮小版（用於卡片內子清單） */
    compact?: boolean;
    /**
     * 標題階層。
     *
     * `ScreenHeader`（頁面標題）本身已是 `<h1>`（`accessibilityRole="header"` 在
     * RNW 0.21 會渲染成 `h1`），因此**頁面已有 `ScreenHeader` 時必須傳 2**，
     * 否則同一畫面會出現兩個 `<h1>`（`WriteStateScreen` 的 docblock 記載了同一問題）。
     * 預設 1 保留給「以 EmptyState 取代整頁標題」的用法（write / scan 的狀態畫面）。
     */
    headingLevel?: 1 | 2;
    testID?: string;
}

/**
 * RNW 專屬的 `aria-level` 不在 RN 的核心型別內（`aria-busy` / `aria-modal` 才有），
 * 但 RNW 0.21 確實支援它（同 `(auth)/_layout.tsx` 的 `TabButtonProps` 對 `aria-selected`
 * 的處理）。未指定時不輸出，維持與既有畫面逐字相同的渲染結果。
 */
type WebHeadingLevel = { 'aria-level'?: number };

const KIND_ICONS: Record<EmptyKind, IconName> = {
    'first-use': 'empty-card',
    'no-results': 'search',
    filtered: 'filter',
};

/** 說明文字最大寬度：控制繁中行長在 30–40 字（§3.6） */
const DESCRIPTION_MAX_WIDTH = 280;

/**
 * 空狀態（D1 結案）
 *
 * 現況有 3 處各寫一行灰字（且使用 §1.2 已禁用的淺灰）。本元件把三種語意分流
 * 為 `kind`，並保證：
 * - **載入中不使用 EmptyState**（凍結規則：載入一律用 `Skeleton`）
 * - `first-use` 才給主要 CTA；`no-results` / `filtered` 走 `secondary`，語氣中立
 * - 插圖為非文字元素，使用 `semantic.icon.disabled`（4.83 ✅）
 */
export function EmptyState({
    kind = 'first-use',
    title,
    description,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
    icon,
    compact = false,
    headingLevel = 1,
    testID,
}: EmptyStateProps) {
    const isFirstUse = kind === 'first-use';
    const headingLevelProps: WebHeadingLevel = headingLevel === 2 ? { 'aria-level': 2 } : {};
    const hasPrimaryAction = actionLabel != null && onAction != null;
    const hasSecondaryAction = secondaryLabel != null && onSecondary != null;

    return (
        <View
            style={[styles.container, compact && styles.containerCompact]}
            testID={testID}
            accessible={false}
        >
            <Icon
                name={icon ?? KIND_ICONS[kind]}
                size={compact ? 'xl' : 'hero'}
                color={semantic.icon.disabled}
            />

            <View style={styles.textGroup}>
                <Text
                    style={compact ? styles.titleCompact : styles.title}
                    accessibilityRole="header"
                    {...headingLevelProps}
                    maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                    {title}
                </Text>
                {description != null ? (
                    <Text
                        style={styles.description}
                        maxFontSizeMultiplier={layout.maxFontScaleBody}
                    >
                        {description}
                    </Text>
                ) : null}
            </View>

            {/**
             * 動作區：主要與次要動作**各自獨立**判斷。
             *
             * ⚠️ C9 修正：原本次要動作被包在「主要動作存在」的分支內，導致
             * `filtered` 這種只用 `secondaryLabel` / `onSecondary` 的用法（計畫 §3.6
             * 明確指定的「清除篩選」）**完全不會渲染**，使用者被卡在無結果的篩選裡
             * 而沒有任何復原入口——正是本計畫要消滅的死路型態。
             */}
            {hasPrimaryAction || hasSecondaryAction ? (
                <View style={styles.actions}>
                    {hasPrimaryAction ? (
                        <Button
                            label={actionLabel}
                            onPress={onAction}
                            variant={isFirstUse ? 'primary' : 'secondary'}
                        />
                    ) : null}
                    {hasSecondaryAction ? (
                        <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" />
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        alignSelf: 'stretch',
        justifyContent: 'center',
        paddingVertical: space[6],
        gap: space[4],
    },
    containerCompact: { paddingVertical: space[4], gap: space[3] },
    textGroup: { alignItems: 'center', gap: space[2] },
    title: { ...type.h3, color: semantic.text.primary, textAlign: 'center' },
    titleCompact: {
        ...type.bodyLg,
        fontWeight: '600',
        color: semantic.text.primary,
        textAlign: 'center',
    },
    description: {
        ...type.body,
        color: semantic.text.muted,
        textAlign: 'center',
        maxWidth: DESCRIPTION_MAX_WIDTH,
    },
    actions: { alignSelf: 'stretch', gap: space[2] },
});
