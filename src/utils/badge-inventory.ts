import type { BadgeStatus, NfcBadgeInventoryItem } from "@/types/api.types";

/**
 * Badge 庫存的**純規則**（不碰畫面、不碰網路）。
 *
 * ## 為什麼需要這一層
 *
 * Web 的徽章管理頁把統計與批次聚合寫在 `useMemo` 裡（`badges/page.tsx` 的
 * `buildStats`／`buildBatchSummaries`），而那份計算是**整頁數字的來源**：
 * 「還有幾張沒寫卡」「有幾張已綁人」「作廢了幾張」全是操作員決定要不要再開
 * 一批手環的依據。算錯不會有任何錯誤訊息，只會讓現場多買或少買一批。
 *
 * 所以這裡把它抽成純函式並用測試釘住三個容易「順手改壞」的定義：
 *
 * 1. **`written` 看的是 `writtenAt`，不是 `status`**。一張卡可以被寫入
 *    （`writtenAt` 有值）卻仍是 `UNASSIGNED`（還沒綁人）。Web 就是這樣算的；
 *    改成「status === 'BOUND'」會讓「已寫未綁」的數量整批消失。
 * 2. **`bound` 看的是 `registrationId`，不是 `status === 'BOUND'`**。
 *    實體手環綁定後狀態可能是 `ACTIVE`；用 status 判斷會少算。
 * 3. **`total` 是陣列長度**，不是後端 `pagination.total`。呼叫端傳進來的
 *    必須是 `all: true` 的全量結果——若有人拿單頁結果來算，這張卡就會低報，
 *    而畫面上完全看不出來（見 `badges.tsx` 的 `loadAll`）。
 *
 * ## 與 Web 的差異（刻意，且已列入交付說明）
 *
 * Web 的 `buildBatchSummaries` 把「沒有 batchId 的散卡」也聚成一群，鍵是
 * `'__no_batch__'`，但群組物件裡的 `batchId` 卻寫成 `''`。於是那個群組的
 * 兩個按鈕都是壞的：
 *
 * | 按鈕 | Web 的行為 |
 * | --- | --- |
 * | 完成批次 | 呼叫 `completeNfcBatch(eventId, '', …)` → 404 |
 * | 指派展商 | `allBadges.filter(b => b.batchId === '')` 恆為空 → 必得 0 筆 |
 *
 * 這裡把兩件事分開：群組要有**穩定的 `key`**（`'__no_batch__'`），
 * 以及**可為 `null` 的 `batchId`**（散卡沒有批次可完成）。
 * `canCompleteBadgeBatch()` 因此會對散卡群組回 `false`，畫面就不會畫出那顆
 * 按鈕；而 `badgesOfBadgeBatch()` 用 `key` 比對，散卡群組的「指派」是真的
 * 指得到那批散卡。**這是修掉 Web 的壞按鈕，不是多做功能。**
 */

/** 散卡群組的鍵。真實 batchId 不可能長這樣（後端是 uuid）。 */
export const NO_BATCH_KEY = "__no_batch__";

/** 統計卡的五個數字（與 Web 的 `Stats` 逐字同構）。 */
export interface BadgeStats {
  total: number;
  unassigned: number;
  written: number;
  bound: number;
  deactivated: number;
}

/** 批次聚合的一列。 */
export interface BadgeBatchSummary {
  /** 群組鍵。真實批次＝`batchId`；散卡＝`NO_BATCH_KEY`。 */
  key: string;
  /** 真實批次 id；**散卡為 `null`**（沒有批次可以「完成」）。 */
  batchId: string | null;
  batchLabel: string | null;
  count: number;
  writtenCount: number;
  boundCount: number;
  assignedCount: number;
}

/** 統計卡的排列順序與文案鍵（與 Web 的 `statCards` 同序）。 */
export const BADGE_STAT_KEYS = [
  "total",
  "unassigned",
  "written",
  "bound",
  "deactivated",
] as const satisfies readonly (keyof BadgeStats)[];

/** 狀態篩選的順序（`""` ＝ 全部）。與 Web 的 `STATUS_FILTERS` 同序。 */
export const BADGE_STATUS_FILTERS = [
  "",
  "UNASSIGNED",
  "BOUND",
  "ACTIVE",
  "DEACTIVATED",
  "LOST",
] as const satisfies readonly ("" | BadgeStatus)[];

/** 建立批次時可選的載體類型。與 Web 的 `BADGE_TYPES` 同序。 */
export const BADGE_TYPE_OPTIONS = [
  "WRISTBAND",
  "CARD",
  "QR_ONLY",
] as const satisfies readonly ("WRISTBAND" | "CARD" | "QR_ONLY")[];

/**
 * 算統計卡。
 *
 * 傳進來的必須是 `all: true` 的全量結果——見檔頭第 3 點。
 */
export function buildBadgeStats(
  badges: readonly NfcBadgeInventoryItem[],
): BadgeStats {
  return {
    total: badges.length,
    unassigned: badges.filter((b) => b.status === "UNASSIGNED").length,
    written: badges.filter((b) => (b.writtenAt ?? null) !== null).length,
    bound: badges.filter((b) => (b.registrationId ?? null) !== null).length,
    deactivated: badges.filter((b) => b.status === "DEACTIVATED").length,
  };
}

/** 一張 badge 屬於哪個群組。 */
export function badgeBatchKey(
  badge: Pick<NfcBadgeInventoryItem, "batchId">,
): string {
  return badge.batchId ?? NO_BATCH_KEY;
}

/**
 * 一個群組裡的成員。比對用 `badgeBatchKey()` 而不是直接比 `batchId`，
 * 散卡群組（`batchId === null`）才指得到人。
 */
export function badgesOfBadgeBatch(
  badges: readonly NfcBadgeInventoryItem[],
  key: string,
): NfcBadgeInventoryItem[] {
  return badges.filter((b) => badgeBatchKey(b) === key);
}

/**
 * 這個群組能不能「完成批次」。
 *
 * 散卡群組不行——它沒有 batchId，而完成批次的路徑需要它。Web 對這一列照樣
 * 畫按鈕，按下去就是 404（見檔頭）。
 */
export function canCompleteBadgeBatch(
  summary: Pick<BadgeBatchSummary, "batchId">,
): boolean {
  return summary.batchId !== null && summary.batchId !== "";
}

/**
 * 依 badge 明細聚合批次摘要（`batchId` 為 key）。
 *
 * 排序照 Web：**`count` 降冪**，同數維持輸入順序（`Map` 保有插入序）。
 * 不改成 batchLabel 字母序——操作員看的是「哪一批還有一堆沒處理」。
 */
export function buildBadgeBatchSummaries(
  badges: readonly NfcBadgeInventoryItem[],
): BadgeBatchSummary[] {
  const map = new Map<string, BadgeBatchSummary>();

  for (const badge of badges) {
    const key = badgeBatchKey(badge);
    const entry = map.get(key) ?? {
      key,
      batchId: badge.batchId ?? null,
      batchLabel: badge.batchLabel ?? null,
      count: 0,
      writtenCount: 0,
      boundCount: 0,
      assignedCount: 0,
    };
    entry.count += 1;
    if ((badge.writtenAt ?? null) !== null) entry.writtenCount += 1;
    if ((badge.registrationId ?? null) !== null) entry.boundCount += 1;
    if ((badge.assignedExhibitorId ?? null) !== null) entry.assignedCount += 1;
    map.set(key, entry);
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * 時間欄位的顯示字串；沒有值或無法解析時回 `null`。
 *
 * 回 `null` 而不是空字串，是為了讓呼叫端自己決定要顯示「—」還是
 * `copy.badges.boundAtEmpty`（兩者的語意不同：一個是「後端沒給」，
 * 一個是「還沒綁」）。無法解析時**回原字串**——把後端送來的怪值吞成
 * 「尚未綁定」會讓資料問題永遠不被發現。
 */
export function formatBadgeTimestamp(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
