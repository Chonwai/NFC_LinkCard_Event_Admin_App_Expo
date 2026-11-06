/**
 * 排行榜的**狀態矩陣**測試（設計 §8.4 S1–S14）與錯誤分類。
 *
 * ## 為什麼狀態矩陣值得單獨一支測試
 *
 * 矩陣的難點不是「有哪些狀態」，而是三條**優先序**——它們寫錯時畫面「看起來
 * 正常」，只有對照矩陣才看得出來：
 *
 * 1. **S11 追蹤未啟用必須壓過 S6／S7**。`TAP_TRACKING_ENABLED` 預設為 false，
 *    此時 `cohort` 可能 > 0 但所有數字都是 0，若不壓過空狀態，畫面會顯示
 *    「目前沒有人達到 5 位」——把「沒開統計」誤診成「沒有人達標」。
 * 2. **S5 forbidden 不給重試**。403 重試一百次還是不會過，給按鈕等於騙人。
 * 3. **S4 error 不出現空狀態**。失敗與「真的沒人」是兩件事，混在一起就再也
 *    分不出「活動沒人參加」和「後端壞了」。
 *
 * 單列怎麼畫在 `tests/leaderboard-display.test.mjs`。兩支都綠才算完整。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyLeaderboardError,
  resolveLeaderboardScreen,
} from "@/utils/leaderboard-display";

import { entry, response } from "./support/leaderboard-fixtures.mjs";

// ---------------------------------------------------------------------------
// 一、S1–S3：載入與重新整理
// ---------------------------------------------------------------------------

test("S1：首次載入（無資料）畫骨架；S2：重新整理時列表保留、只轉圈", () => {
  const firstLoad = resolveLeaderboardScreen({
    loading: true,
    errorKind: "none",
    response: null,
  });
  assert.equal(firstLoad.showSkeleton, true);
  assert.equal(firstLoad.refreshing, false);

  const refreshing = resolveLeaderboardScreen({
    loading: true,
    errorKind: "none",
    response: response({ entries: [entry()] }),
  });
  assert.equal(refreshing.showSkeleton, false, "重新整理不閃骨架");
  assert.equal(refreshing.refreshing, true);

  const settled = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({ entries: [entry()] }),
  });
  assert.equal(settled.refreshing, false);
  assert.equal(settled.showSkeleton, false);
});

test("S3：正常態顯示 summary，且沒有空狀態", () => {
  const state = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({
      entries: [entry()],
      totals: { ...response().totals, cohort: 1, ranked: 1 },
    }),
  });

  assert.equal(state.showSummary, true);
  assert.equal(state.emptyKind, "none");
  assert.equal(state.errorKind, "none");
});

// ---------------------------------------------------------------------------
// 二、S4／S5／S14：三種失敗
// ---------------------------------------------------------------------------

test("S4／S5／S14：失敗時不出空狀態、不顯示 summary", () => {
  for (const kind of ["load", "forbidden", "cohortTooLarge"]) {
    const state = resolveLeaderboardScreen({
      loading: false,
      errorKind: kind,
      cohortTooLargeCount: kind === "cohortTooLarge" ? 12345 : null,
      response: null,
    });

    assert.equal(state.errorKind, kind);
    assert.equal(state.emptyKind, "none", "失敗不得偽裝成「沒有人」");
    assert.equal(state.showSummary, false);
    assert.equal(state.showBelowThresholdSection, false);
  }
});

test("S14：cohort-too-large 要帶出人數（後端 details.cohort）", () => {
  const state = resolveLeaderboardScreen({
    loading: false,
    errorKind: "cohortTooLarge",
    cohortTooLargeCount: 12345,
    response: null,
  });

  assert.equal(state.cohortTooLargeCount, 12345);
});

// ---------------------------------------------------------------------------
// 三、S6／S7：兩種空狀態，以及 S11 的優先序
// ---------------------------------------------------------------------------

test("S6：cohort 為 0 ⇒ 真的沒人（first-use 空狀態）", () => {
  const state = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({
      totals: { ...response().totals, cohort: 0, ranked: 0 },
    }),
  });

  assert.equal(state.emptyKind, "noCohort");
  assert.equal(state.showTrackingDisabled, false);
});

test("S7：有 cohort 但 ranked 為 0 ⇒ 空狀態變體，而且仍顯示 below-threshold 區塊", () => {
  const state = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({
      belowThreshold: [entry({ rank: null, uniqueVisitors: 3 })],
      totals: {
        ...response().totals,
        cohort: 3,
        ranked: 0,
        belowThreshold: 3,
      },
    }),
  });

  assert.equal(state.emptyKind, "belowThresholdOnly");
  assert.equal(state.showBelowThresholdSection, true);
});

test("S11 優先於 S6／S7：追蹤未啟用時不給任何空狀態（否則會誤診成「沒人達標」）", () => {
  const base = response({
    totals: { ...response().totals, cohort: 12, ranked: 0, belowThreshold: 12 },
  });
  const state = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: {
      ...base,
      methodology: { ...base.methodology, trackingEnabled: false },
    },
  });

  assert.equal(state.showTrackingDisabled, true);
  assert.equal(state.emptyKind, "none", "不得說「目前沒有人達到 5 位」");
});

// ---------------------------------------------------------------------------
// 四、S8–S13：提示與摺疊區塊
// ---------------------------------------------------------------------------

test("S8／S9：below-threshold 與 excluded 區塊只在真的有人時出現", () => {
  const empty = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({ entries: [entry()] }),
  });
  assert.equal(empty.showBelowThresholdSection, false);
  assert.equal(empty.showExcludedSection, false);

  const withSections = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({
      entries: [entry()],
      belowThreshold: [entry({ rank: null, uniqueVisitors: 1 })],
      excluded: {
        ...response().excluded,
        total: 3,
        byReason: {
          REGISTRATION_INACTIVE: 1,
          ROLE_EXCLUDED: 2,
          NO_ACCOUNT: 0,
          NO_PUBLIC_DEFAULT_PROFILE: 0,
        },
      },
    }),
  });
  assert.equal(withSections.showBelowThresholdSection, true);
  assert.equal(withSections.showExcludedSection, true);
});

test("S10：staleness 對應 info／warning；fresh 與 unknown 不顯示", () => {
  const toneOf = (staleness) =>
    resolveLeaderboardScreen({
      loading: false,
      errorKind: "none",
      response: response({ entries: [entry()], staleness }),
    }).staleTone;

  assert.equal(toneOf("fresh"), "none");
  assert.equal(toneOf("unknown"), "none");
  assert.equal(toneOf("stale"), "info");
  assert.equal(toneOf("very_stale"), "warning");
});

test("S12：time_window_cohort 必須揭露；event_attributed 不用", () => {
  const notice = (attributionScope) =>
    resolveLeaderboardScreen({
      loading: false,
      errorKind: "none",
      response: response({ entries: [entry()], attributionScope }),
    }).showAttributionNotice;

  assert.equal(notice("time_window_cohort"), true);
  assert.equal(notice("event_attributed"), false);
});

test("S13：riskFlagsActive 為 false ⇒ 只留方法論一句，不畫永遠空的 ⚠ 區塊", () => {
  const inactive = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({ entries: [entry()] }),
  });
  assert.equal(inactive.showRiskFlagsInactive, true);

  const active = resolveLeaderboardScreen({
    loading: false,
    errorKind: "none",
    response: response({
      entries: [entry()],
      methodology: { ...response().methodology, riskFlagsActive: true },
    }),
  });
  assert.equal(active.showRiskFlagsInactive, false);
});

// ---------------------------------------------------------------------------
// 五、錯誤分類（S4／S5／S14 的來源）
// ---------------------------------------------------------------------------

test("403 ⇒ forbidden（畫面不給重試鈕）", () => {
  const forbidden = { response: { status: 403, data: { error: {} } } };
  assert.deepEqual(classifyLeaderboardError(forbidden), {
    kind: "forbidden",
    cohort: null,
  });
});

test("400 LEADERBOARD_COHORT_TOO_LARGE ⇒ cohortTooLarge，並帶出人數", () => {
  const tooLarge = {
    response: {
      status: 400,
      data: {
        error: {
          code: "LEADERBOARD_COHORT_TOO_LARGE",
          details: { cohort: 12345, limit: 10000 },
        },
      },
    },
  };

  assert.deepEqual(classifyLeaderboardError(tooLarge), {
    kind: "cohortTooLarge",
    cohort: 12345,
  });
});

test("其他一律 load（含沒有 response 的網路層錯誤與非物件例外）", () => {
  assert.equal(classifyLeaderboardError(new Error("network")).kind, "load");
  assert.equal(
    classifyLeaderboardError({ response: { status: 500, data: {} } }).kind,
    "load",
  );
  assert.equal(classifyLeaderboardError(null).kind, "load");
});
