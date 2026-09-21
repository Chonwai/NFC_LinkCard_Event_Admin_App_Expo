import { copy } from "@/constants/copy.zh-TW";
import type { semantic } from "@/constants/theme";

/**
 * 活動狀態（`EventStatus`）→ 顯示文字。
 *
 * 文案集中在 `copy.eventStatus`；鍵集合見該處註解（repo 內兩個宣告的聯集）。
 *
 * 抽為共用模組的原因：`home`（活動列表）與 `overview`（活動首頁）都要顯示
 * 同一個狀態。`overview` 先接了這支模組，`home` 卻一直留著自己的一份映射
 * ——`NEW-D2-04` 掃描時發現那份映射的六個中文標籤全都沒走 `copy`，兩份也已經
 * 對不起來（`home` 有 `REGISTRATION_OPEN`、這裡沒有）。現在只剩這裡一份。
 */
export const EVENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: copy.eventStatus.draft,
  PUBLISHED: copy.eventStatus.published,
  REGISTRATION_OPEN: copy.eventStatus.registrationOpen,
  ONGOING: copy.eventStatus.ongoing,
  COMPLETED: copy.eventStatus.completed,
  CANCELLED: copy.eventStatus.cancelled,
  ARCHIVED: copy.eventStatus.archived,
};

/**
 * 活動狀態 → 徽章色（對應 `semantic.status` tokens）。
 *
 * `REGISTRATION_OPEN` 為 `"success"`：活動列表原本就是這樣顯示的，收斂時
 * 必須原樣保留，否則「報名中」的活動徽章會從綠色掉成灰色。
 *
 * `semantic` 只用來取 `keyof`，因此是 **type-only import**：這支模組於是不再
 * 需要 `react-native`（`theme.ts` 在模組頂層呼叫 `StyleSheet.hairlineWidth`），
 * 純 Node 就載得起來，映射本身因此可以被測試直接斷言。
 */
export const EVENT_STATUS_TONE: Record<string, keyof typeof semantic.status> = {
  DRAFT: "neutral",
  PUBLISHED: "available",
  REGISTRATION_OPEN: "success",
  ONGOING: "success",
  COMPLETED: "neutral",
  CANCELLED: "warning",
  ARCHIVED: "neutral",
};

/**
 * 取活動狀態的顯示文字；未知狀態回退為原始值（不吞掉資訊）。
 *
 * 用 `||` 而非 `??`——`status` 型別為 `EventStatus | string`（非 nullable），
 * `??` 的右側永遠不可達；改用 `||` 後空字串也會落到 fallback，讓呼叫端
 * （`home.tsx`）能再接手 `copy.event.unknownStatus`。
 */
export function getEventStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return EVENT_STATUS_LABEL[status] || status;
}
