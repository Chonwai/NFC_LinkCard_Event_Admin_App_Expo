/**
 * `exhibitor-list.ts` 的純規則測試。
 *
 * ## 為什麼這一支值得存在
 * 展商列表的數字與順序全部來自這裡，而它們錯了**不會有任何錯誤**：分頁籤的
 * 數字少一家、順序顛倒、「全部」其實只有一半——畫面照樣畫得出來，而且看起來
 * 很合理。這正是 Web 現在的狀態（「全部」分頁只顯示 `ACTIVE`，因為後端把
 * 缺席的 `status` 補成 `ACTIVE`）。
 *
 * 兩條規則要釘住：
 *
 * 1. **數字用後端的 `pagination.total`，不是本地陣列長度。** 被 100 筆上限
 *    截斷時，長度會比真實數字小——用長度就等於把「還有 40 家在等你審批」
 *    抹掉。
 * 2. **合併順序＝分頁籤順序。** 操作員的動線是「全部 → 待審批」，
 *    不是字母序。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  countForTab,
  emptyMergedExhibitors,
  exhibitorsForTab,
  EXHIBITOR_STATUSES,
  EXHIBITOR_TABS,
  mergeExhibitorBuckets,
} = await import("@/utils/exhibitor-list");

/** 造一列。只有 `id` 與 `companyName` 對這裡的規則有意義。 */
function row(id) {
  return { id, companyName: `公司 ${id}` };
}

// ---------------------------------------------------------------------------
// 一、分頁籤的順序與成員
// ---------------------------------------------------------------------------

test("分頁籤順序與 Web 的 STATUS_TABS 相同：全部在最前", () => {
  assert.deepEqual(EXHIBITOR_TABS, [
    "ALL",
    "PENDING_APPROVAL",
    "ACTIVE",
    "SUSPENDED",
    "COMPLETED",
  ]);
});

test("EXHIBITOR_STATUSES 是分頁籤去掉 ALL，不多不少", () => {
  assert.deepEqual(
    EXHIBITOR_STATUSES,
    EXHIBITOR_TABS.filter((tab) => tab !== "ALL"),
  );
});

// ---------------------------------------------------------------------------
// 二、合併：順序、數字、截斷
// ---------------------------------------------------------------------------

test("合併順序依 EXHIBITOR_STATUSES，不是依輸入順序", () => {
  const merged = mergeExhibitorBuckets([
    { status: "COMPLETED", exhibitors: [row("c1")], total: 1 },
    { status: "PENDING_APPROVAL", exhibitors: [row("p1")], total: 1 },
    { status: "ACTIVE", exhibitors: [row("a1")], total: 1 },
    { status: "SUSPENDED", exhibitors: [row("s1")], total: 1 },
  ]);

  assert.deepEqual(
    merged.all.map((item) => item.id),
    ["p1", "a1", "s1", "c1"],
  );
});

test("數字取自 pagination.total，不是陣列長度（截斷時兩者不同）", () => {
  const merged = mergeExhibitorBuckets([
    // 後端說有 250 家，但單頁上限只回 100 筆。
    { status: "ACTIVE", exhibitors: [row("a1"), row("a2")], total: 250 },
    { status: "PENDING_APPROVAL", exhibitors: [row("p1")], total: 7 },
  ]);

  assert.equal(merged.counts.ACTIVE, 250, "分頁籤要顯示後端的真實總數");
  assert.equal(merged.byStatus.ACTIVE.length, 2, "但清單只有載回來的那些");
  assert.equal(merged.total, 257);
  assert.equal(countForTab(merged, "ALL"), 257);
});

test("任一桶被截斷就標 truncated", () => {
  const truncated = mergeExhibitorBuckets([
    { status: "ACTIVE", exhibitors: [row("a1")], total: 2 },
  ]);
  assert.equal(truncated.truncated, true);

  const exact = mergeExhibitorBuckets([
    { status: "ACTIVE", exhibitors: [row("a1"), row("a2")], total: 2 },
  ]);
  assert.equal(exact.truncated, false, "剛好等於上限不算截斷");
});

test("缺的狀態視為 0 筆，不是 undefined", () => {
  const merged = mergeExhibitorBuckets([
    { status: "ACTIVE", exhibitors: [row("a1")], total: 1 },
  ]);

  assert.equal(merged.counts.SUSPENDED, 0);
  assert.deepEqual(merged.byStatus.SUSPENDED, []);
  assert.equal(merged.total, 1);
  assert.equal(merged.truncated, false);
});

test("空輸入回全空檢視（不拋錯、每個狀態都在）", () => {
  const merged = mergeExhibitorBuckets([]);
  assert.deepEqual(merged, emptyMergedExhibitors());
});

// ---------------------------------------------------------------------------
// 三、取列
// ---------------------------------------------------------------------------

test("exhibitorsForTab：ALL 給合併清單，其餘給單一狀態", () => {
  const merged = mergeExhibitorBuckets([
    {
      status: "PENDING_APPROVAL",
      exhibitors: [row("p1"), row("p2")],
      total: 2,
    },
    { status: "ACTIVE", exhibitors: [row("a1")], total: 1 },
  ]);

  assert.deepEqual(
    exhibitorsForTab(merged, "ALL").map((item) => item.id),
    ["p1", "p2", "a1"],
  );
  assert.deepEqual(
    exhibitorsForTab(merged, "PENDING_APPROVAL").map((item) => item.id),
    ["p1", "p2"],
  );
  assert.deepEqual(
    exhibitorsForTab(merged, "ACTIVE").map((item) => item.id),
    ["a1"],
  );
  assert.deepEqual(exhibitorsForTab(merged, "COMPLETED"), []);
});
