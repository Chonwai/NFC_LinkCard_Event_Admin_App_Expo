import { copy } from '@/constants/copy.zh-TW';
import { semantic } from '@/constants/theme';

/**
 * 活動狀態（`EventStatus`）→ 顯示文字。
 *
 * 鍵集合 = 後端 `EventStatus` enum（`DRAFT` / `PUBLISHED` / `ONGOING` /
 * `COMPLETED` / `CANCELLED` / `ARCHIVED`）。文案集中在 `copy.eventStatus`。
 *
 * 抽為共用模組的原因：`home`（活動列表）與 `overview`（活動首頁）都要顯示
 * 同一個狀態，先前只有 `home` 有映射，導致 `overview` 直接渲染原始 enum
 * （例：`ARCHIVED` 顯示英文）。
 */
export const EVENT_STATUS_LABEL: Record<string, string> = {
    DRAFT: copy.eventStatus.draft,
    PUBLISHED: copy.eventStatus.published,
    ONGOING: copy.eventStatus.ongoing,
    COMPLETED: copy.eventStatus.completed,
    CANCELLED: copy.eventStatus.cancelled,
    ARCHIVED: copy.eventStatus.archived,
};

/** 活動狀態 → 徽章色（對應 `semantic.status` tokens）。 */
export const EVENT_STATUS_TONE: Record<string, keyof typeof semantic.status> = {
    DRAFT: 'neutral',
    PUBLISHED: 'available',
    ONGOING: 'success',
    COMPLETED: 'neutral',
    CANCELLED: 'warning',
    ARCHIVED: 'neutral',
};

/**
 * 取活動狀態的顯示文字；未知狀態回退為原始值（不吞掉資訊）。
 *
 * L2：用 `||` 而非 `??`——`status` 型別為 `EventStatus | string`（非 nullable），
 * `??` 的右側永遠不可達；改用 `||` 後空字串也會落到 fallback，
 * 與 `home.tsx` 的 inline 表達式行為一致。
 */
export function getEventStatusLabel(status: string | null | undefined): string {
    if (!status) return '';
    return EVENT_STATUS_LABEL[status] || status;
}
