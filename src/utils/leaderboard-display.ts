import { copy } from "@/constants/copy.zh-TW";
import type {
  LeaderboardEntry,
  LeaderboardExclusionReason,
  LeaderboardResponse,
  LeaderboardSampleQuality,
} from "@/types/leaderboard.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

/**
 * 排行榜的顯示層純邏輯（設計 §8.3 單列規格 ＋ §8.4 狀態矩陣）。
 *
 * ## 為什麼這支檔案不能碰 React Native
 *
 * `tests/*.test.mjs` 用 Node 內建的 type stripping 直接 import 這個模組
 * （`tests/alias-loader.mjs`）。`theme.ts` 頂層就會用 `StyleSheet.hairlineWidth`，
 * 一 import 進來測試就跑不動。所以這裡只做「輸入 response → 輸出字串與布林」，
 * 顏色與版面留在畫面檔。
 *
 * ## 這支檔案存在的唯一理由：`rank: null`
 *
 * 設計 §8.3 的原文警告是「不寫清楚，實作者直接 `{rank}` 會渲染出空白或字串
 * `null`」。所以**名次標籤只有一個產生點**（`rankBadgeLabel`），而且
 * `null` 一律變成 U+2014 的 `—`（不是 `-`、不是空字串、不是 `null`）。
 * 畫面上任何地方都不准自己寫 `{row.rank}`——`tests/leaderboard-display.test.mjs`
 * 有一條專門驗這件事，`tests/leaderboard-contract.test.mjs` 再從原始碼掃一次。
 *
 * ## 三條從契約繼承下來的紀律
 *
 * 1. **名次分流只看 `rank === null`**，不得用 `sampleQuality` 或
 *    `uniqueVisitors === 0` 反推（`minUniqueVisitors` 可調到 50，於是
 *    `uv >= 10` 但 `rank === null` 是合法狀態）。
 * 2. **低於門檻的列不畫比較條、不顯示百分比**：沒有名次時的長條會被讀成
 *    「有排名但比較短」。
 * 3. **低於門檻不是錯誤**：不得使用 danger 色票，只降透明度。
 */
export type LeaderboardErrorKind =
  "none" | "load" | "forbidden" | "cohortTooLarge";

export interface LeaderboardFailure {
  kind: LeaderboardErrorKind;
  /** `LEADERBOARD_COHORT_TOO_LARGE` 才會有值（後端 `details.cohort`）。 */
  cohort: number | null;
}

/**
 * 把 API 例外收斂成三種畫面語意（設計 §8.4 的 S4／S5／S14）。
 *
 * 這三種不能合併：
 * - `forbidden`（403）**不給重試按鈕**——重試一百次還是不會過，給按鈕等於騙人。
 * - `cohortTooLarge`（400）要說出人數，否則主辦方只會看到「載入失敗」然後一直重試。
 * - `load` 才是真的可以重試的那一種。
 *
 * 讀 `details` 時全部走 optional chaining：這個函式同時要能吃掉 axios 的網路層
 * 錯誤（沒有 `response`）與非物件例外。
 */
export function classifyLeaderboardError(error: unknown): LeaderboardFailure {
  const status = getApiErrorStatus(error);
  const code = getApiErrorCode(error);

  if (status === 403) {
    return { kind: "forbidden", cohort: null };
  }
  if (code === "LEADERBOARD_COHORT_TOO_LARGE") {
    return { kind: "cohortTooLarge", cohort: readCohortFromError(error) };
  }
  return { kind: "load", cohort: null };
}

function readCohortFromError(error: unknown): number | null {
  if (error === null || typeof error !== "object") return null;
  const details = (
    error as {
      response?: { data?: { error?: { details?: { cohort?: unknown } } } };
    }
  ).response?.data?.error?.details;
  const cohort = details?.cohort;
  return typeof cohort === "number" ? cohort : null;
}

/**
 * 名次徽章的文字。**`null` ⇒ `—`**（U+2014）。
 *
 * 這是整個功能唯一允許產生名次文字的地方。設計 §8.3 的 below-threshold 規格
 * 是「不渲染名次徽章，改顯示 `—`」，不是「渲染 0」也不是「留空」。
 */
export function rankBadgeLabel(rank: number | null): string {
  if (rank === null) return copy.leaderboard.rankPlaceholder;
  return String(rank);
}

/** 讀屏用的名次說明。`null` 走專用字串，不唸成「第 null 名」。 */
export function rankAccessibilityLabel(rank: number | null): string {
  if (rank === null) return copy.leaderboard.rankBelowThresholdA11y;
  return copy.leaderboard.rankLabel(rank);
}

/** 這一列是否低於門檻（唯一判準：`rank === null`）。 */
export function isBelowThreshold(entry: LeaderboardEntry): boolean {
  return entry.rank === null;
}

/**
 * 比較條的長度（0–100 整數）。
 *
 * 分母是 `entries[0].uniqueVisitors`——後端已依主指標降幂排出 `entries`，
 * 首列即最大值，所以不需要新欄位、也不需要再打一次 API（設計 §8.3）。
 * `top <= 0` 時回 0（全部並列 0 的極端情境，不能讓 0/0 變成 NaN 寬度）。
 */
export function barPercent(
  uniqueVisitors: number,
  topUniqueVisitors: number,
): number {
  if (topUniqueVisitors <= 0) return 0;
  const percent = Math.round((uniqueVisitors / topUniqueVisitors) * 100);
  return Math.max(0, Math.min(100, percent));
}

export interface LeaderboardRowBar {
  percent: number;
  /** `sampleQuality === 'small'` ⇒ 灰虛線條（樣本小，長條只是相對關係）。 */
  dashed: boolean;
}

export interface LeaderboardRowView {
  /** List key。**不是** `profileId`——同一使用者可有兩筆有效報名（見 `buildRows`）。 */
  key: string;
  rank: number | null;
  rankLabel: string;
  rankAccessibilityLabel: string;
  /** `top` ⇒ 前 3 名用強調色；`default` ⇒ 一般名次；`placeholder` ⇒ `—`。 */
  rankTone: "top" | "default" | "placeholder";
  /** 只在「同 rank 群組人數 > 1」時才有值（並列裁決序對無名次者無意義）。 */
  tieBreakLabel: string | null;
  displayName: string;
  company: string | null;
  uniqueVisitors: number;
  leadsCaptured: number;
  sampleQuality: LeaderboardSampleQuality;
  /** 「資料累積中」（只有 below-threshold／`accumulating` 才會有值）。 */
  sampleQualityLabel: string | null;
  /** 主指標旁的小星號（`uv < 10` 且**有名次**時）。 */
  visitorAsterisk: boolean;
  /** `null` ⇒ 不畫比較條（below-threshold、或 `uv = 0`）。 */
  bar: LeaderboardRowBar | null;
  belowThreshold: boolean;
  integrityFlagCount: number;
  flaggedTaps: number;
  dataQualityFlags: string[];
  earliestAchievedDay: string | null;
  firstLeadAt: string | null;
}

/**
 * 榜上（有名次）的列。
 *
 * ## `key` 為什麼不是 `profileId`
 *
 * 後端 cohort 是「一筆 `EventRegistration` 一列」，而
 * `event_registrations` **沒有**`(eventId, userId)` 唯一鍵——同一個使用者可以在
 * 同一活動有兩筆有效報名，於是同一張名片會在 `entries[]` 出現兩次。設計 §8.2
 * 的 `keyExtractor={r => r.profileId}` 在那種情況下會產生重複 key（React 會
 * 警告並可能重複渲染同一列）。這裡改成 `profileId#序號`：仍然穩定（榜單不分頁、
 * 每列順序由後端決定），但保證唯一。
 */
export function buildLeaderboardRows(
  response: LeaderboardResponse,
): LeaderboardRowView[] {
  const top = response.entries[0]?.uniqueVisitors ?? 0;
  const groupSizes = rankGroupSizes(response.entries);

  return response.entries.map((entry, index) =>
    toRow(entry, {
      index,
      top,
      tieGroupSize: entry.rank === null ? 0 : (groupSizes.get(entry.rank) ?? 0),
      belowThreshold: isBelowThreshold(entry),
    }),
  );
}

/**
 * 低於門檻的列（設計 §8.3 四列表）。
 *
 * 與 `buildLeaderboardRows` 共用同一個 `toRow`，差別只在 `belowThreshold: true`
 * ——這正是「共用同一個 renderEntry」的實作方式。三個必守差異：
 *
 * 1. 名次一律 `—`（`rankBadgeLabel(null)`）；
 * 2. `tieBreakOrder` 不顯示（恆 `null`，並列裁決序只對有名次者有意義）；
 * 3. **不畫比較條、不顯示百分比**，即使 `uv >= 10`（門檻被調高時會發生）。
 */
export function buildBelowThresholdRows(
  response: LeaderboardResponse,
): LeaderboardRowView[] {
  return response.belowThreshold.map((entry, index) =>
    toRow(entry, {
      index,
      top: 0,
      tieGroupSize: 0,
      belowThreshold: true,
    }),
  );
}

function toRow(
  entry: LeaderboardEntry,
  options: {
    index: number;
    top: number;
    tieGroupSize: number;
    belowThreshold: boolean;
  },
): LeaderboardRowView {
  const { index, top, tieGroupSize, belowThreshold } = options;
  const quality = entry.sampleQuality;
  /**
   * 並列時讀屏唸「並列第 N 名」。同一個數字代表多名次是 dense rank 的正常結果，
   * 若唸成「第 2 名」會讓人以為系統算錯（設計 §3.1：並列在活動現場是高發情境）。
   */
  const accessibilityLabel =
    entry.rank !== null && tieGroupSize > 1
      ? copy.leaderboard.tiedLabel(entry.rank)
      : rankAccessibilityLabel(entry.rank);

  return {
    key: `${entry.profileId}#${index}`,
    rank: entry.rank,
    rankLabel: rankBadgeLabel(entry.rank),
    rankAccessibilityLabel: accessibilityLabel,
    rankTone: rankTone(entry.rank),
    tieBreakLabel:
      tieGroupSize > 1 && entry.tieBreakOrder !== null
        ? copy.leaderboard.tieBreakLabel(entry.tieBreakOrder)
        : null,
    displayName: entry.displayName,
    company: entry.company,
    uniqueVisitors: entry.uniqueVisitors,
    leadsCaptured: entry.leadsCaptured,
    sampleQuality: quality,
    sampleQualityLabel: sampleQualityLabel(quality, belowThreshold),
    visitorAsterisk: !belowThreshold && quality === "small",
    bar:
      belowThreshold || quality === "accumulating"
        ? null
        : {
            percent: barPercent(entry.uniqueVisitors, top),
            dashed: quality === "small",
          },
    belowThreshold,
    integrityFlagCount: entry.integrityFlagCount,
    flaggedTaps: entry.flaggedTaps,
    dataQualityFlags: entry.dataQualityFlags,
    earliestAchievedDay: entry.earliestAchievedDay,
    firstLeadAt: entry.firstLeadAt,
  };
}

function rankTone(rank: number | null): "top" | "default" | "placeholder" {
  if (rank === null) return "placeholder";
  return rank <= 3 ? "top" : "default";
}

/**
 * 樣本品質的說明文字。
 *
 * `small`（1–9）與 `accumulating`（0）都顯示「資料累積中」——對使用者而言
 * 兩者都是「樣本不夠，先不要下結論」。有名次的列只有在 `small` 時才會拿到
 * 這張標籤嗎？不是：有名次＋`small`（門檻 5～9 之間）用主指標旁的 `*` 表示，
 * 標籤留給沒有名次的列，才不會同一列出現兩種樣本提示。
 */
function sampleQualityLabel(
  quality: LeaderboardSampleQuality,
  belowThreshold: boolean,
): string | null {
  if (quality === "accumulating") return copy.leaderboard.sampleAccumulating;
  if (belowThreshold && quality === "small") {
    return copy.leaderboard.sampleAccumulating;
  }
  return null;
}

function rankGroupSizes(entries: LeaderboardEntry[]): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const entry of entries) {
    if (entry.rank === null) continue;
    sizes.set(entry.rank, (sizes.get(entry.rank) ?? 0) + 1);
  }
  return sizes;
}

export type LeaderboardEmptyKind = "none" | "noCohort" | "belowThresholdOnly";

export interface LeaderboardScreenState {
  /** S1：首次載入才畫骨架；重新整理不閃骨架（S2）。 */
  showSkeleton: boolean;
  /** S2：下拉刷新中的轉圈（列表保留）。 */
  refreshing: boolean;
  emptyKind: LeaderboardEmptyKind;
  errorKind: LeaderboardErrorKind;
  cohortTooLargeCount: number | null;
  /** S10：`stale` ⇒ info；`very_stale` ⇒ warning。 */
  staleTone: "none" | "info" | "warning";
  /** S11：**優先於 S6／S7**（追蹤沒開時「沒人」是錯誤診斷）。 */
  showTrackingDisabled: boolean;
  /** S12：`attributionScope === 'time_window_cohort'` 必須常駐揭露。 */
  showAttributionNotice: boolean;
  /** S13：`riskFlagsActive === false` ⇒ ⚠ 區塊不顯示，只在方法論註記裡說一句。 */
  showRiskFlagsInactive: boolean;
  /** S8：有 below-threshold 列才顯示摺疊區塊（**與 S7 的空狀態並存**）。 */
  showBelowThresholdSection: boolean;
  /** S9：`excluded.total > 0`。 */
  showExcludedSection: boolean;
  showSummary: boolean;
}

export interface LeaderboardScreenInput {
  loading: boolean;
  errorKind: LeaderboardErrorKind;
  cohortTooLargeCount?: number | null;
  response: LeaderboardResponse | null;
}

const IDLE_STATE: LeaderboardScreenState = {
  showSkeleton: false,
  refreshing: false,
  emptyKind: "none",
  errorKind: "none",
  cohortTooLargeCount: null,
  staleTone: "none",
  showTrackingDisabled: false,
  showAttributionNotice: false,
  showRiskFlagsInactive: false,
  showBelowThresholdSection: false,
  showExcludedSection: false,
  showSummary: false,
};

/**
 * 狀態矩陣（設計 §8.4 S1–S14）的單一判定點。
 *
 * 這個函式是「畫面該長什麼樣」的唯一真相，畫面只負責把回傳的布林接到對應的
 * 元件上。之所以要抽出來，是因為矩陣裡有三條**優先序**靠肉眼很容易寫錯：
 *
 * - **S11 追蹤未啟用優先於 S6／S7**：追蹤沒開時 `cohort` 可能 > 0 但所有數字
 *   都是 0，那會命中「目前沒有人達到 5 位」——一個錯誤診斷。所以
 *   `showTrackingDisabled` 為真時**不給任何空狀態**。
 * - **S5 forbidden 不出現重試**：錯誤種類本身就是 `errorKind`，畫面依
 *   `errorKind` 決定要不要給重試鈕。
 * - **S4 error 不出現 EmptyState**：失敗與「真的沒人」是兩件事，`errorKind`
 *   非 `none` 時 `emptyKind` 一律 `none`。
 */
export function resolveLeaderboardScreen(
  input: LeaderboardScreenInput,
): LeaderboardScreenState {
  const { loading, errorKind, response } = input;

  if (errorKind !== "none") {
    return {
      ...IDLE_STATE,
      errorKind,
      cohortTooLargeCount: input.cohortTooLargeCount ?? null,
    };
  }

  if (response === null) {
    return { ...IDLE_STATE, showSkeleton: loading };
  }

  const trackingDisabled = response.methodology.trackingEnabled === false;
  let emptyKind: LeaderboardEmptyKind = "none";
  if (!trackingDisabled) {
    if (response.totals.cohort === 0) {
      emptyKind = "noCohort";
    } else if (response.totals.ranked === 0) {
      emptyKind = "belowThresholdOnly";
    }
  }

  return {
    showSkeleton: false,
    refreshing: loading,
    emptyKind,
    errorKind: "none",
    cohortTooLargeCount: null,
    staleTone:
      response.staleness === "very_stale"
        ? "warning"
        : response.staleness === "stale"
          ? "info"
          : "none",
    showTrackingDisabled: trackingDisabled,
    showAttributionNotice: response.attributionScope === "time_window_cohort",
    showRiskFlagsInactive: response.methodology.riskFlagsActive === false,
    showBelowThresholdSection: response.belowThreshold.length > 0,
    showExcludedSection: response.excluded.total > 0,
    showSummary: true,
  };
}

export interface LeaderboardExcludedGroupView {
  reason: LeaderboardExclusionReason;
  label: string;
  count: number;
}

/**
 * `excluded.byReason` → 可渲染的分組。
 *
 * **順序照後端常數**（`REGISTRATION_INACTIVE` → `ROLE_EXCLUDED` → `NO_ACCOUNT`
 * → `NO_PUBLIC_DEFAULT_PROFILE`），不照數字大小排：那個順序是契約的一部分
 * （後端分類有固定優先序），前端自己排序會讓同一份資料在兩台手機上順序不同。
 * 只回傳 `count > 0` 的類別——列出「0 位」只會讓人以為哪裡壞了。
 */
export function excludedGroups(
  response: LeaderboardResponse,
): LeaderboardExcludedGroupView[] {
  const byReason = response.excluded.byReason;
  const groups: LeaderboardExcludedGroupView[] = [];

  const labels: Record<LeaderboardExclusionReason, string> = {
    REGISTRATION_INACTIVE: copy.leaderboard.excludedInactive,
    ROLE_EXCLUDED: copy.leaderboard.excludedRoleExcluded,
    NO_ACCOUNT: copy.leaderboard.excludedNoAccount,
    NO_PUBLIC_DEFAULT_PROFILE: copy.leaderboard.excludedNoProfile,
  };

  const order: LeaderboardExclusionReason[] = [
    "REGISTRATION_INACTIVE",
    "ROLE_EXCLUDED",
    "NO_ACCOUNT",
    "NO_PUBLIC_DEFAULT_PROFILE",
  ];

  for (const reason of order) {
    const count = byReason[reason] ?? 0;
    if (count > 0) groups.push({ reason, label: labels[reason], count });
  }

  return groups;
}

export interface LeaderboardExcludedItemView {
  key: string;
  displayName: string;
  reasonLabel: string;
  registrantType: string;
}

/**
 * `excluded.items[]` → 可渲染的列。
 *
 * ⚠️ **刻意不回傳 `email`**。後端在 `WRITE` 權限下會帶它，但這張榜單的用途是
 * 「解釋為什麼這個人不在榜上」，不是通訊錄。派發約束明訂不得顯示他人以外的
 * 敏感資料；型別裡留著 `email` 是為了標記「後端有回、我們選擇不顯示」。
 */
export function excludedItemViews(
  response: LeaderboardResponse,
): LeaderboardExcludedItemView[] {
  const groups = new Map(
    excludedGroups(response).map((group) => [group.reason, group.label]),
  );

  return response.excluded.items.map((item, index) => ({
    key: `${item.displayName}#${index}`,
    displayName: item.displayName,
    reasonLabel: groups.get(item.reason) ?? item.reason,
    registrantType: item.registrantType,
  }));
}

/**
 * 方法論註記的段落（設計 §8.2 `MethodologyNote`）。
 *
 * 這幾句是**契約層的誠實揭露**，不是裝飾：
 * - `methodologyDedupe` 必須寫多日活動「按日去重加總」（`subjectHash` 的 salt
 *   是日粒度，跨日不重複訪客在數學上不可得）。
 * - `methodologyLead` 必須寫「多人共用同一 email 會合併成 1 筆」（去重的偽陰性）。
 * - `attributionTimeWindow` 由 S12 橫幅承擔，這裡不重複。
 *
 * ⚠️ 「異常標記尚未啟用」（S13）**不在這裡**：它由
 * `resolveLeaderboardScreen().showRiskFlagsInactive` 驅動，畫面在方法論區塊
 * 尾端單獨渲染。放進這個陣列會讓同一個開關有兩個真相來源（陣列內容 vs 旗標）。
 */
export function methodologyNotes(): string[] {
  return [
    copy.leaderboard.methodologyBody,
    copy.leaderboard.methodologyDedupe,
    copy.leaderboard.methodologyLead,
    copy.leaderboard.methodologyExcluded,
  ];
}

/**
 * `asOf`／`snapshotId` 的顯示格式：`2026-11-07 14:15 UTC`。
 *
 * 一律以 UTC 呈現，因為去重日就是 UTC 日（`dedupe.timezone`）。用本地時間會
 * 讓「今天」與主辦方的認知錯開，那是設計 §12.1 R-12 記過的風險，不要在 UI 上
 * 再製造一次。無法解析時回 `null`，由呼叫端落回 `staleWarning` 或省略時間。
 */
export function formatAsOf(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
