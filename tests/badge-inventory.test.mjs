/**
 * `src/utils/badge-inventory.ts` 的純規則測試。
 *
 * ## 為什麼這支測試值得存在
 *
 * 這個檔算的是「還有幾張手環沒寫、幾張沒綁、幾張作廢」——那是採購與現場
 * 備料的唯一依據。算錯不會報錯，只會讓數字安靜地錯。
 *
 * 下面每一條幾乎都對應一個「看起來等價、其實不等價」的寫法：
 *
 * - `written` 用 `writtenAt` 而非 `status === 'BOUND'`
 * - `bound` 用 `registrationId` 而非 `status === 'ACTIVE'`
 * - 散卡群組的 `batchId` 是 `null`（不是 `""`），否則「完成批次」會打 404
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  BADGE_STAT_KEYS,
  BADGE_STATUS_FILTERS,
  BADGE_TYPE_OPTIONS,
  NO_BATCH_KEY,
  badgeBatchKey,
  badgesOfBadgeBatch,
  buildBadgeBatchSummaries,
  buildBadgeStats,
  canCompleteBadgeBatch,
  formatBadgeTimestamp,
} = await import("@/utils/badge-inventory");

/** 造一張 badge 列，只覆蓋測試關心的欄位。 */
function badge(overrides = {}) {
  return {
    id: "bd-1",
    eventId: "evt-1",
    tagUid: "TAG-0001",
    qrCode: null,
    badgeType: "WRISTBAND",
    status: "UNASSIGNED",
    registrationId: null,
    assignedExhibitorId: null,
    batchId: "bt-1",
    batchLabel: "第一批",
    boundAt: null,
    writtenAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 一、統計卡
// ---------------------------------------------------------------------------

test("buildBadgeStats: 空清單全部為 0（不是 undefined，也不是 NaN）", () => {
  assert.deepEqual(buildBadgeStats([]), {
    total: 0,
    unassigned: 0,
    written: 0,
    bound: 0,
    deactivated: 0,
  });
});

test("buildBadgeStats: written 看 writtenAt —— 已寫但未綁也要算進去", () => {
  const stats = buildBadgeStats([
    badge({ id: "a", status: "UNASSIGNED", writtenAt: "2026-11-01T01:00:00Z" }),
    badge({ id: "b", status: "UNASSIGNED", writtenAt: null }),
  ]);

  assert.equal(stats.written, 1);
  assert.equal(stats.unassigned, 2);
  assert.equal(stats.bound, 0);
});

test("buildBadgeStats: bound 看 registrationId —— 狀態是 ACTIVE 也要算", () => {
  const stats = buildBadgeStats([
    // 綁了人、狀態是 ACTIVE：若用 status === 'BOUND' 判斷就會漏算這筆
    badge({ id: "a", status: "ACTIVE", registrationId: "reg-1" }),
    badge({ id: "b", status: "BOUND", registrationId: null }),
  ]);

  assert.equal(stats.bound, 1);
});

test("buildBadgeStats: deactivated 只算 DEACTIVATED，不含 LOST", () => {
  const stats = buildBadgeStats([
    badge({ id: "a", status: "DEACTIVATED" }),
    badge({ id: "b", status: "LOST" }),
    badge({ id: "c", status: "ACTIVE" }),
  ]);

  assert.equal(stats.deactivated, 1);
  assert.equal(stats.total, 3);
});

test("buildBadgeStats: total 是傳入長度（呼叫端必須先取全量）", () => {
  const rows = Array.from({ length: 7 }, (_, i) => badge({ id: `b${i}` }));
  assert.equal(buildBadgeStats(rows).total, 7);
});

// ---------------------------------------------------------------------------
// 二、批次聚合
// ---------------------------------------------------------------------------

test("badgeBatchKey: 沒有 batchId 的散卡歸到 NO_BATCH_KEY（不是空字串）", () => {
  assert.equal(badgeBatchKey({ batchId: null }), NO_BATCH_KEY);
  assert.equal(badgeBatchKey({ batchId: undefined }), NO_BATCH_KEY);
  assert.equal(badgeBatchKey({ batchId: "bt-1" }), "bt-1");
});

test("buildBadgeBatchSummaries: 依 batchId 分群，並分別累計 written／bound／assigned", () => {
  const summaries = buildBadgeBatchSummaries([
    badge({
      id: "a",
      batchId: "bt-1",
      writtenAt: "2026-11-01T01:00:00Z",
      registrationId: "reg-1",
      assignedExhibitorId: "ex-1",
    }),
    badge({ id: "b", batchId: "bt-1" }),
    badge({ id: "c", batchId: "bt-2", writtenAt: "2026-11-01T02:00:00Z" }),
  ]);

  assert.equal(summaries.length, 2);
  const first = summaries.find((s) => s.key === "bt-1");
  assert.equal(first.count, 2);
  assert.equal(first.writtenCount, 1);
  assert.equal(first.boundCount, 1);
  assert.equal(first.assignedCount, 1);

  const second = summaries.find((s) => s.key === "bt-2");
  assert.equal(second.count, 1);
  assert.equal(second.writtenCount, 1);
  assert.equal(second.boundCount, 0);
});

test("buildBadgeBatchSummaries: count 降冪排序（照 Web）", () => {
  const summaries = buildBadgeBatchSummaries([
    badge({ id: "a", batchId: "bt-small" }),
    badge({ id: "b", batchId: "bt-big" }),
    badge({ id: "c", batchId: "bt-big" }),
    badge({ id: "d", batchId: "bt-big" }),
  ]);

  assert.deepEqual(
    summaries.map((s) => s.key),
    ["bt-big", "bt-small"],
  );
});

test("buildBadgeBatchSummaries: 散卡群組存在，且 batchId 是 null（不是空字串）", () => {
  const summaries = buildBadgeBatchSummaries([
    badge({ id: "a", batchId: null, batchLabel: null }),
    badge({ id: "b", batchId: null, batchLabel: null }),
    badge({ id: "c", batchId: "bt-1" }),
  ]);

  const loose = summaries.find((s) => s.key === NO_BATCH_KEY);
  assert.ok(loose, "散卡群組必須存在，否則那批手環在畫面上沒有任何出口");
  assert.equal(loose.batchId, null);
  assert.equal(loose.count, 2);
});

// ---------------------------------------------------------------------------
// 三、「完成批次」的守門條件（修掉 Web 的 404 按鈕）
// ---------------------------------------------------------------------------

test("canCompleteBadgeBatch: 真批次可完成，散卡群組不可", () => {
  assert.equal(canCompleteBadgeBatch({ batchId: "bt-1" }), true);
  // Web 把散卡的 batchId 寫成 ''，按下去就是 POST /nfc/batch//complete → 404
  assert.equal(canCompleteBadgeBatch({ batchId: "" }), false);
  assert.equal(canCompleteBadgeBatch({ batchId: null }), false);
});

test("badgesOfBadgeBatch: 散卡群組指得到人（Web 用 batchId === '' 比對，恆為空）", () => {
  const rows = [
    badge({ id: "a", batchId: null }),
    badge({ id: "b", batchId: "bt-1" }),
    badge({ id: "c", batchId: null }),
  ];

  assert.deepEqual(
    badgesOfBadgeBatch(rows, NO_BATCH_KEY).map((b) => b.id),
    ["a", "c"],
  );
  assert.deepEqual(
    badgesOfBadgeBatch(rows, "bt-1").map((b) => b.id),
    ["b"],
  );
});

// ---------------------------------------------------------------------------
// 四、時間格式
// ---------------------------------------------------------------------------

test("formatBadgeTimestamp: 沒有值回 null（交給呼叫端決定顯示什麼）", () => {
  assert.equal(formatBadgeTimestamp(null), null);
  assert.equal(formatBadgeTimestamp(undefined), null);
  assert.equal(formatBadgeTimestamp(""), null);
});

test("formatBadgeTimestamp: 無法解析時回原字串，不吞成空值", () => {
  assert.equal(formatBadgeTimestamp("not-a-date"), "not-a-date");
});

test("formatBadgeTimestamp: 合法 ISO 轉成本地時間字串", () => {
  const formatted = formatBadgeTimestamp("2026-11-01T03:04:05.000Z");
  assert.equal(typeof formatted, "string");
  assert.ok(formatted.length > 0);
  assert.notEqual(formatted, "2026-11-01T03:04:05.000Z");
});

// ---------------------------------------------------------------------------
// 五、選項順序（與 Web 對齊，不是字母序也不是 enum 序）
// ---------------------------------------------------------------------------

test("BADGE_STATUS_FILTERS: 順序照 Web（全部 → UNASSIGNED → BOUND → ACTIVE → DEACTIVATED → LOST）", () => {
  assert.deepEqual(BADGE_STATUS_FILTERS, [
    "",
    "UNASSIGNED",
    "BOUND",
    "ACTIVE",
    "DEACTIVATED",
    "LOST",
  ]);
});

test("BADGE_STAT_KEYS: 順序照 Web 的 statCards", () => {
  assert.deepEqual(BADGE_STAT_KEYS, [
    "total",
    "unassigned",
    "written",
    "bound",
    "deactivated",
  ]);
});

test("BADGE_TYPE_OPTIONS: 只有 Web 提供的三種載體", () => {
  assert.deepEqual(BADGE_TYPE_OPTIONS, ["WRISTBAND", "CARD", "QR_ONLY"]);
});
