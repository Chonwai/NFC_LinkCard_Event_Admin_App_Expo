/**
 * 活動社交排行榜（Event Leaderboard）型別 — App 端主辦方看榜。
 *
 * 設計來源：`docs/analysis/nfc-tap-attribution/20261107_Leaderboard_Design.md`
 * §7.1（API 契約）與 §8（Expo Admin 頁規格）。
 *
 * ## 契約是**後端實作**，不是設計文件的路徑
 *
 * 設計文件 §7.1 寫的路徑是 `/api/v1/events/:eventId/leaderboard`，但後端實際落在
 * `/api/v1/events/:eventId/taps/leaderboard`（掛在 `event-ops.routes.ts`，理由是
 * 排行榜的資料來源是 tap 聚合，`/api/v1/taps/*` 的既有結構不改）。**以實作為準**：
 * 型別與 service 都對齊實作，設計文件的路徑視為歷史草稿。
 *
 * ## 為什麼 `rank` 是 `number | null` 而不是 optional
 *
 * `belowThreshold[]` 的 `rank` **恆為 `null`**（`rankExclusionReason:
 * 'BELOW_THRESHOLD'`），而 `entries[]` 的 `rank` 恆為整數。用 `number | null`
 * 強迫每一處消費端先處理 `null`——`{rank}` 直接渲染就會編不過（React Native
 * 不接受 `null` 當子節點以外的用法時不會報錯，但畫面會是空白，而這正是設計
 * §8.3 要防的那個 bug）。顯示層的 `—` 由 `utils/leaderboard-display.ts` 統一
 * 產生。
 *
 * ## 刻意不建模的欄位（不是漏抄）
 *
 * - `excluded.items[].email`：後端在 `WRITE` 權限下會回傳，但**畫面不顯示**
 *   （派發硬約束：不得顯示他人以外的敏感資料）。型別仍然保留，讓「有沒有這個
 *   欄位」在型別層可查，但 UI 永不讀它。
 * - `subjectHash` / `ipPrefix` / `uaHash`：後端**契約層就不回傳**（這三個是
 *   tap 事件的去識別化欄位，屬內部記帳）。所以這裡連型別都不放——型別上不存在
 *   的欄位，就不可能被「順手顯示」。
 */

/** 排行榜支援的兩個指標（`LEADERBOARD_METRICS`）。 */
export type LeaderboardMetric = "unique_visitors" | "leads_captured";

/** 資料新鮮度（`resolveStaleness`）。 */
export type LeaderboardStaleness = "fresh" | "stale" | "very_stale" | "unknown";

/**
 * 樣本品質分級（`resolveSampleQuality`）。
 *
 * - `sufficient`：`uniqueVisitors >= 10`（`displayThreshold.exactStatsAt`）
 * - `small`：`1..9`
 * - `accumulating`：`0`
 *
 * ⚠️ 分級**不決定有沒有名次**：`minUniqueVisitors` 可調到 50，於是可能出現
 * `uv >= 10` 但 `rank === null`（band 仍是 `sufficient`）。名次分流一律看
 * `rank === null`，不得用 band 或 `uv === 0` 反推（設計 §8.3 的明文禁令）。
 */
export type LeaderboardSampleQuality = "sufficient" | "small" | "accumulating";

/** `excluded.byReason` 的固定分類（後端 `LEADERBOARD_EXCLUSION_REASONS`，順序即契約）。 */
export type LeaderboardExclusionReason =
  | "REGISTRATION_INACTIVE"
  | "ROLE_EXCLUDED"
  | "NO_ACCOUNT"
  | "NO_PUBLIC_DEFAULT_PROFILE";

/** `rank` 為 `null` 的唯一原因。 */
export type LeaderboardRankExclusionReason = "BELOW_THRESHOLD";

/** 榜上／樣本不足的一列（兩者**共用同一個型別**，靠 `rank` 分流）。 */
export interface LeaderboardEntry {
  /** 密集排名（dense）。`null` ⇒ 低於門檻，不參與名次計算。 */
  rank: number | null;
  /** 並列裁決序。只有「同 rank 群組 > 1」時才有意義；`belowThreshold` 恆為 `null`。 */
  tieBreakOrder: number | null;
  profileId: string;
  profileSlug: string;
  displayName: string;
  /** 公司名，可為 `null`（後端 `registration.company`）。 */
  company: string | null;
  registrantType: string;
  uniqueVisitors: number;
  leadsCaptured: number;
  /** 累計訪客數首次達到最終值的最早 UTC 日（`YYYY-MM-DD`），可為 `null`。 */
  earliestAchievedDay: string | null;
  /** 最早一筆聯絡資料的時間（ISO 8601），可為 `null`。 */
  firstLeadAt: string | null;
  /** 等價於 `rank !== null`。 */
  eligible: boolean;
  rankExclusionReason: LeaderboardRankExclusionReason | null;
  /** 誠信訊號（Phase 1 恆空）。**只標記、不排除**。 */
  riskFlags: string[];
  integrityFlagCount: number;
  /** 量測品質訊號（**不是**作弊，例如訪客封鎖 cookie）。 */
  dataQualityFlags: string[];
  flaggedTaps: number;
  sampleQuality: LeaderboardSampleQuality;
}

/** `excluded.items[]` 的一列。 */
export interface LeaderboardExcludedItem {
  displayName: string;
  /** ⚠️ 屬 PII。**UI 不顯示**（見檔頭）。 */
  email: string;
  reason: LeaderboardExclusionReason;
  registrantType: string;
}

export interface LeaderboardExcluded {
  total: number;
  byReason: Record<LeaderboardExclusionReason, number>;
  items: LeaderboardExcludedItem[];
  truncated: boolean;
}

export interface LeaderboardTotals {
  /** 該活動**全部** `EventRegistration`（含取消／封存／未付款）。 */
  registrations: number;
  /** 通過身分篩選且有公開預設卡（＝ `ranked + belowThreshold`）。 */
  cohort: number;
  ranked: number;
  belowThreshold: number;
  excluded: number;
  /** 自我校驗欄位，恆 0；非 0 代表後端分類漏算，畫面應視為資料異常。 */
  unaccounted: number;
  totalUniqueVisitors: number;
  totalLeadsCaptured: number;
}

export interface LeaderboardTieBreaker {
  layer: number;
  key: string;
  direction: "asc" | "desc";
  nullsLast?: boolean;
}

export interface LeaderboardMethodology {
  metric: LeaderboardMetric;
  secondaryMetric: LeaderboardMetric;
  rankingMethod: string;
  /** `fromDay === toDay` ⇒ `single_day_unique`（設計 §2.1 的機械判定）。 */
  uniqueVisitorSemantics: "single_day_unique" | "sum_of_daily_unique";
  leadDedupe: string;
  dedupe: { window: string; timezone: string; scopeRule: string };
  threshold: { minUniqueVisitors: number; applied: number; appliesTo: string };
  displayThreshold: { exactStatsAt: number };
  sampleQualityBands: Record<LeaderboardSampleQuality, string>;
  tieBreakers: LeaderboardTieBreaker[];
  stabilityKey: string;
  riskPolicy: string;
  /** Phase 1 恆 `false`（沒有任何地方寫入 `riskFlags`）。 */
  riskFlagsActive: boolean;
  registrantTypesIncluded: string[];
  profileResolution: string;
  refreshIntervalSeconds: number;
  trackingEnabled: boolean;
  generatedAt: string;
}

export interface LeaderboardWindow {
  fromDay: string;
  toDay: string;
  source: string;
}

/**
 * 一個名次的並列人數（後端在 `limit` 截斷**前**算好）。
 *
 * 為什麼不是讓前端自己數 `entries`：`entries` 已被 `?limit=` 截斷，並列群組
 * 跨過截斷邊界時會被低估，於是「並列 N 位」會說出一個確定錯誤的事實。
 */
export interface LeaderboardRankGroupSize {
  rank: number;
  size: number;
}

/** `GET /api/v1/events/:eventId/taps/leaderboard` 的 `data`。 */
export interface LeaderboardResponse {
  scope: string;
  eventId: string;
  metric: LeaderboardMetric;
  /** `MAX(computedAt)`；`null` 代表聚合還沒跑過。 */
  snapshotId: string | null;
  asOf: string | null;
  staleness: LeaderboardStaleness;
  /** Phase 1 恆為 `'time_window_cohort'`，必須在 UI 常駐揭露。 */
  attributionScope: string;
  window: LeaderboardWindow;
  entries: LeaderboardEntry[];
  /**
   * 每個名次的並列人數，依 rank 遞增、**不受 `limit` 截斷影響**。
   *
   * 選用（optional）是為了相容於「後端還沒升版」的回應；缺少時顯示層退回自行
   * 從 `entries` 數，那是**已知會低估**的降級行為，不是等價替代。
   */
  rankGroupSizes?: LeaderboardRankGroupSize[];
  belowThreshold: LeaderboardEntry[];
  belowThresholdTruncated: boolean;
  excluded: LeaderboardExcluded;
  totals: LeaderboardTotals;
  methodology: LeaderboardMethodology;
}

/**
 * 查詢參數。
 *
 * 全部 optional：不帶就讓後端套預設（`metric=unique_visitors`、`limit=20`、
 * `minUniqueVisitors=5`、`registrantTypes=ATTENDEE,GUEST,MEDIA`）。App **不在
 * 前端重複實作 clamp**——門檻與上限由後端決定並在 `methodology` 回報實際值，
 * 前端再夾一次只會製造兩個不一致的真相。
 */
export interface LeaderboardQuery {
  metric?: LeaderboardMetric;
  limit?: number;
  /** `YYYY-MM-DD`（UTC 日）。 */
  from?: string;
  to?: string;
  minUniqueVisitors?: number;
  /** CSV，例如 `ATTENDEE,GUEST,MEDIA`。 */
  registrantTypes?: string;
}
