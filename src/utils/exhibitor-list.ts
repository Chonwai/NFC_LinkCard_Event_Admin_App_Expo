import type { Exhibitor, ExhibitorStatus } from "@/types/exhibitor.types";

/**
 * 展商列表的**純規則**（不碰畫面、不碰網路）。
 *
 * ## 為什麼需要這一層（而不是照 Web 打一次列表）
 *
 * Web 的展商管理頁打的是「不帶 `limit`、也不帶 `status`」的列表請求，然後用
 * `statusFilter` 在**同一份結果**上切分頁。那在後端有兩個後果，兩個都會
 * 無聲地少資料：
 *
 * 1. `limit` 預設 20（`ExhibitorService.ts:225`）⇒ 第 21 家之後不存在。
 * 2. `status` 缺席時被**強制**成 `ACTIVE`（`ExhibitorService.ts:219-222`）
 *    ⇒ 「全部」分頁只看得到已啟用的廠商，待審批的一筆都不會出現。
 *
 * 所以 App 不模仿那個查詢：它對**四個狀態各打一次**（每次都帶滿
 * `EXHIBITOR_LIST_MAX_LIMIT`），再在這裡合併。這不是「比 Web 多做」——
 * 是讓 Web 上那個叫「全部」的分頁真的等於全部。
 *
 * ## 誠實邊界
 *
 * `counts` 用的是後端的 `pagination.total`，不是本地陣列長度。兩者會不同的
 * 唯一情況是某個狀態超過 100 筆——那時 `truncated` 為 `true`，畫面要說出來，
 * 而不是假裝畫面上的就是全部。**不自動翻頁**：這是列表頁，不是匯出。
 */

/** 分頁籤。`ALL` 是本地的合併檢視，不是後端的一個 `status` 值。 */
export type ExhibitorTab = "ALL" | ExhibitorStatus;

/**
 * 分頁籤順序。**與 Web 的 `STATUS_TABS` 同序**（`exhibitors/page.tsx:18-23`），
 * 不是字母序也不是 enum 序——操作員的動線是「先看全部，再看待審批」。
 */
export const EXHIBITOR_TABS: readonly ExhibitorTab[] = [
  "ALL",
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "COMPLETED",
];

/** 後端真的存在的四個狀態（不含本地的 `ALL`）。 */
export const EXHIBITOR_STATUSES: readonly ExhibitorStatus[] = [
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "COMPLETED",
];

/** 一個狀態的查詢結果。`total` 是後端 `pagination.total`。 */
export interface ExhibitorBucket {
  status: ExhibitorStatus;
  exhibitors: Exhibitor[];
  total: number;
}

/** 四個狀態合併後的檢視。 */
export interface MergedExhibitors {
  /** 依 `EXHIBITOR_STATUSES` 順序串接的完整清單（`ALL` 分頁用）。 */
  all: Exhibitor[];
  /** 各狀態自己的清單（單一狀態分頁用）。 */
  byStatus: Record<ExhibitorStatus, Exhibitor[]>;
  /** 各狀態的後端總筆數。 */
  counts: Record<ExhibitorStatus, number>;
  /** 四個狀態的總筆數（＝「全部」分頁該顯示的數字）。 */
  total: number;
  /** 任一狀態被單頁上限截斷（`total` 大於已載入筆數）。 */
  truncated: boolean;
}

/** 全空的檢視（首次載入前的初值，避免 `undefined` 分支散在畫面裡）。 */
export function emptyMergedExhibitors(): MergedExhibitors {
  return {
    all: [],
    byStatus: {
      PENDING_APPROVAL: [],
      ACTIVE: [],
      SUSPENDED: [],
      COMPLETED: [],
    },
    counts: { PENDING_APPROVAL: 0, ACTIVE: 0, SUSPENDED: 0, COMPLETED: 0 },
    total: 0,
    truncated: false,
  };
}

/**
 * 把四個狀態的查詢結果合併成一份檢視。
 *
 * 缺的狀態視為「空」而不是「失敗」：呼叫端只有在**全部**請求都失敗時才會
 * 走到錯誤分支，單一狀態沒有回傳代表那個狀態真的 0 筆。
 */
export function mergeExhibitorBuckets(
  buckets: readonly ExhibitorBucket[],
): MergedExhibitors {
  const merged = emptyMergedExhibitors();
  const byStatus = new Map(buckets.map((bucket) => [bucket.status, bucket]));

  for (const status of EXHIBITOR_STATUSES) {
    const bucket = byStatus.get(status);
    const rows = bucket?.exhibitors ?? [];
    merged.byStatus[status] = rows;
    merged.counts[status] = bucket?.total ?? 0;
    merged.all.push(...rows);
    if ((bucket?.total ?? 0) > rows.length) merged.truncated = true;
  }

  merged.total =
    merged.counts.PENDING_APPROVAL +
    merged.counts.ACTIVE +
    merged.counts.SUSPENDED +
    merged.counts.COMPLETED;

  return merged;
}

/** 取某個分頁籤要顯示的列。`ALL` 是合併清單，其餘是該狀態的清單。 */
export function exhibitorsForTab(
  merged: MergedExhibitors,
  tab: ExhibitorTab,
): Exhibitor[] {
  return tab === "ALL" ? merged.all : merged.byStatus[tab];
}

/**
 * 分頁籤上的數字。
 *
 * 「全部」用 `total`（四個 `pagination.total` 之和），不是 `all.length`——
 * 被 100 筆上限截斷時後者會比真實數字小，而那個數字正是操作員判斷「有沒有人在
 * 等我審批」的依據。
 */
export function countForTab(
  merged: MergedExhibitors,
  tab: ExhibitorTab,
): number {
  return tab === "ALL" ? merged.total : merged.counts[tab];
}
