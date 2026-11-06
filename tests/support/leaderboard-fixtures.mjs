/**
 * 排行榜測試的共用 fixture。
 *
 * 兩個測試檔（`leaderboard-display` 與 `leaderboard-states`）都需要同一份
 * 後端回應形狀。各自留一份一定會分岔：後端加一個 `totals` 欄位時，只改到其中
 * 一份的那個人不會發現另一份還是舊的（`CR-D4` 的同一個教訓）。
 *
 * 形狀**逐字對齊**後端 `LeaderboardService.getLeaderboard` 的回應（不是設計文件
 * 的範例）：`scope`、`metric`、`snapshotId`、`asOf`、`staleness`、
 * `attributionScope`、`window`、`entries`、`belowThreshold`、
 * `belowThresholdTruncated`、`excluded`、`totals`、`methodology`。
 */

/** 一列。預設是「有名次、樣本充足」的形狀；用 overrides 改成 below-threshold。 */
export function entry(overrides = {}) {
  return {
    rank: 1,
    tieBreakOrder: 1,
    profileId: "profile-1",
    profileSlug: "profile-1",
    displayName: "Participant",
    company: null,
    registrantType: "ATTENDEE",
    uniqueVisitors: 30,
    leadsCaptured: 4,
    earliestAchievedDay: "2026-11-07",
    firstLeadAt: "2026-11-07T03:12:44.000Z",
    eligible: true,
    rankExclusionReason: null,
    riskFlags: [],
    integrityFlagCount: 0,
    dataQualityFlags: [],
    flaggedTaps: 0,
    sampleQuality: "sufficient",
    ...overrides,
  };
}

/** 一份完整的回應。預設是「fresh、追蹤已啟用、沒有任何列」。 */
export function response(overrides = {}) {
  return {
    scope: "event",
    eventId: "evt-1",
    metric: "unique_visitors",
    snapshotId: "2026-11-07T14:15:03.412Z",
    asOf: "2026-11-07T14:15:03.412Z",
    staleness: "fresh",
    attributionScope: "time_window_cohort",
    window: {
      fromDay: "2026-11-07",
      toDay: "2026-11-07",
      source: "event_dates",
    },
    entries: [],
    belowThreshold: [],
    belowThresholdTruncated: false,
    excluded: {
      total: 0,
      byReason: {
        REGISTRATION_INACTIVE: 0,
        ROLE_EXCLUDED: 0,
        NO_ACCOUNT: 0,
        NO_PUBLIC_DEFAULT_PROFILE: 0,
      },
      items: [],
      truncated: false,
    },
    totals: {
      registrations: 0,
      cohort: 0,
      ranked: 0,
      belowThreshold: 0,
      excluded: 0,
      unaccounted: 0,
      totalUniqueVisitors: 0,
      totalLeadsCaptured: 0,
    },
    methodology: {
      metric: "unique_visitors",
      secondaryMetric: "leads_captured",
      rankingMethod: "dense",
      uniqueVisitorSemantics: "single_day_unique",
      leadDedupe: "normalized_email",
      dedupe: {
        window: "day",
        timezone: "UTC",
        scopeRule: "per-scope, no union",
      },
      threshold: { minUniqueVisitors: 5, applied: 5, appliesTo: "rank_only" },
      displayThreshold: { exactStatsAt: 10 },
      sampleQualityBands: { sufficient: "", small: "", accumulating: "" },
      tieBreakers: [],
      stabilityKey: "profile_id_asc",
      riskPolicy: "flag_only",
      riskFlagsActive: false,
      registrantTypesIncluded: ["ATTENDEE", "GUEST", "MEDIA"],
      profileResolution: "current_default_public",
      refreshIntervalSeconds: 900,
      trackingEnabled: true,
      generatedAt: "2026-11-07T14:16:20.001Z",
    },
    ...overrides,
  };
}
