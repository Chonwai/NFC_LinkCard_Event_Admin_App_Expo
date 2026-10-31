import type { Registration } from "@/types/api.types";

/**
 * 「最近一次載入的名單」的**記憶體快取**。
 *
 * ## 為什麼需要它（不是為了省一次請求）
 * 後端**沒有**「用 id 取完整詳情」的端點——`registrations.routes.ts` 只有
 * `GET /`（名單）、`GET /by-code/:code`（公開，欄位窄）、`GET /desk-lookup`
 * （欄位窄）。而詳情頁走的正是 `by-code`，它的 `select` 沒有
 * `isHidden / archivedAt / depositRefunded* / emailStatus / checkedInBy`
 * → 詳情頁渲染這些欄位只會得到永遠的「—」（`approvedBy` 已經犯過這個錯）。
 *
 * 能取到那些欄位的**唯一**已存在來源，就是名單端點，而名單端點已經在上一頁
 * 載入過了。所以在名單載入時把那一頁記下來，詳情頁直接取用——
 * **不新增端點、不猜欄位、不把 by-code 沒有的東西畫成破折號**。
 *
 * ## 誠實邊界
 * - **只在記憶體**：App 重啟即失效。
 * - **只覆蓋「從名單點進來」**：深連結／冷啟動時查不到，詳情頁會退回 `by-code`
 *   並**明說**擴充欄位不可用（不假裝有）。
 * - **以 `eventId` 隔離**：id 全域唯一，但快取仍綁活動，避免跨活動誤命中。
 * - 這是一個 per-process 的唯讀 UI 快取，不是業務狀態；寫入是整批取代，
 *   讀取只按 id 取單筆，不存在跨請求的累積性汙染。
 */
interface ListSnapshot {
  eventId: string;
  rows: Map<string, Registration>;
}

let snapshot: ListSnapshot | null = null;

/** 記住某一活動最近一次載入的名單（整批取代，不做增量合併）。 */
export function rememberRegistrationList(
  eventId: string,
  rows: Registration[],
): void {
  const next = new Map<string, Registration>();
  for (const row of rows) {
    if (row?.id) next.set(row.id, row);
  }
  snapshot = { eventId, rows: next };
}

/**
 * 取回某一筆名單資料。**活動不符或沒載入過就回 `null`**——
 * 呼叫端必須自己處理「沒有」的情況，不能假設一定有。
 */
export function findRememberedRegistration(
  eventId: string | undefined,
  registrationId: string | undefined,
): Registration | null {
  if (!snapshot || !eventId || !registrationId) return null;
  if (snapshot.eventId !== eventId) return null;
  return snapshot.rows.get(registrationId) ?? null;
}

/** 清空快取（測試用；目前沒有登出流程需要呼叫它）。 */
export function clearRegistrationListCache(): void {
  snapshot = null;
}
