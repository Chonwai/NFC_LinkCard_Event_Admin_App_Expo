/**
 * `leaderboardService` 的語意測試（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 *
 * 排行榜只有一條呼叫，所以「範圍」沒什麼好鎖的；真正的坑在**參數**：
 *
 * 1. **查詢參數放在 `params`，不是拼在網址上**。拼進網址會讓
 *    `scripts/check-backend-contract.mjs` 抽到的路徑多一段
 *    （`…/taps/leaderboard/*`），與後端的 `…/taps/leaderboard` 永遠對不上。
 *    這支測試直接斷言「網址恰好是那一條、參數在 config 裡」。
 * 2. **空字串與 `undefined` 必須被過濾**。`registrantTypes: ''` 送到後端會被當成
 *    非法 CSV 回 400，而 axios 只會略過 `undefined`。
 * 3. **不回傳 envelope**。畫面要的是 `res.data.data`，回錯一層會讓所有欄位變成
 *    `undefined` 且沒有任何型別或執行期錯誤。
 *
 * 它刻意**不驗**：後端有沒有這條路徑（`tests/leaderboard-contract.test.mjs` 與
 * 全域 `check:contract` 的事）、畫面上每個狀態怎麼渲染
 * （`tests/leaderboard-display.test.mjs` 的事）。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const calls = [];

/** 非 `null` 時，模擬的 `get` 會直接拋這個值（用來驗 service 不吞錯）。 */
let failWith = null;

const RESPONSE = {
  scope: "event",
  eventId: "evt-1",
  metric: "unique_visitors",
  snapshotId: "2026-11-07T14:15:03.412Z",
  asOf: "2026-11-07T14:15:03.412Z",
  staleness: "fresh",
  attributionScope: "time_window_cohort",
  window: { fromDay: "2026-11-07", toDay: "2026-11-07", source: "event_dates" },
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
    registrantTypesIncluded: ["ATTENDEE"],
    profileResolution: "current_default_public",
    refreshIntervalSeconds: 900,
    trackingEnabled: true,
    generatedAt: "2026-11-07T14:16:20.001Z",
  },
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url, config) => {
        calls.push({ method: "GET", url, config });
        if (failWith !== null) throw failWith;
        return { data: { success: true, data: RESPONSE } };
      },
      post: async () => {
        calls.push({ method: "POST" });
        return { data: { data: RESPONSE } };
      },
      patch: async () => {
        calls.push({ method: "PATCH" });
        return { data: { data: RESPONSE } };
      },
    },
  },
});

const { leaderboardService } = await import("@/services/leaderboard.service");

const PATH = "/api/v1/events/evt-1/taps/leaderboard";

function reset() {
  calls.length = 0;
  failWith = null;
}

test("只有一支呼叫，而且就在後端實作的那條路徑上", async () => {
  reset();
  await leaderboardService.getLeaderboard("evt-1");

  assert.deepEqual(Object.keys(leaderboardService), ["getLeaderboard"]);
  assert.equal(calls.length, 1, "一次請求就該拿回整份榜單");
  assert.equal(calls[0].method, "GET");
  assert.equal(
    calls[0].url,
    PATH,
    "路徑必須是 /taps/leaderboard（設計文件寫的 /leaderboard 後端沒有實作）",
  );
});

test("查詢參數走 axios 的 params，不拼進網址", async () => {
  reset();
  await leaderboardService.getLeaderboard("evt-1", {
    registrantTypes: "ATTENDEE,GUEST,MEDIA",
    metric: "unique_visitors",
    limit: 20,
    minUniqueVisitors: 5,
    from: "2026-11-07",
    to: "2026-11-07",
  });

  assert.equal(calls[0].url, PATH, "網址不得夾帶查詢字串");
  assert.deepEqual(calls[0].config, {
    params: {
      metric: "unique_visitors",
      from: "2026-11-07",
      to: "2026-11-07",
      registrantTypes: "ATTENDEE,GUEST,MEDIA",
      limit: "20",
      minUniqueVisitors: "5",
    },
  });
});

test("不帶參數時 params 是空物件（讓後端套自己的預設）", async () => {
  reset();
  await leaderboardService.getLeaderboard("evt-1");

  assert.deepEqual(calls[0].config, { params: {} });
});

test("空字串與 undefined 一律不送（後端會把空 registrantTypes 判成非法 CSV）", async () => {
  reset();
  await leaderboardService.getLeaderboard("evt-1", {
    registrantTypes: "",
    metric: undefined,
    limit: undefined,
    minUniqueVisitors: undefined,
  });

  assert.deepEqual(calls[0].config, { params: {} });
});

test("eventId 會被 URL-encode（避免路徑注入與帶斜線的識別碼）", async () => {
  reset();
  await leaderboardService.getLeaderboard("evt/../1");

  assert.equal(calls[0].url, "/api/v1/events/evt%2F..%2F1/taps/leaderboard");
});

test("回傳的是 data.data，不是整個 envelope", async () => {
  reset();
  const result = await leaderboardService.getLeaderboard("evt-1");

  assert.deepEqual(result, RESPONSE);
  assert.equal(result.success, undefined, "不得把 envelope 的 success 帶出去");
});

test("不吞錯：例外原樣往外拋，交給畫面分成 403／cohort-too-large／一般失敗", async () => {
  reset();
  const forbidden = new Error("forbidden");
  forbidden.response = { status: 403, data: { error: { code: "FORBIDDEN" } } };
  failWith = forbidden;

  await assert.rejects(
    () => leaderboardService.getLeaderboard("evt-1"),
    (error) => error === forbidden,
    "service 若在這裡 catch，畫面就分不出「沒權限」與「載入失敗」",
  );

  failWith = null;
});
