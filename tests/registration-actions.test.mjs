/**
 * 名單管理動作的**規則**鎖定（不是 wire 契約）。
 *
 * 這一條規則決定「畫面上會出現哪些按鈕」，而它先前只是一個內嵌在畫面裡的
 * if/else——畫面拉的 `react-native` 讓它在 Node 測試裡載不進來，於是規則
 * 只能靠人記住。抽成純函式之後，這裡就可以直接斷言：
 *
 * 1. 狀態修正**只在** `CONFIRMED` / `CHECKED_IN` 出現，而且目標剛好是另一邊。
 * 2. 隱藏與封存是兩條獨立軸，四種組合都要正確（不是「隱藏了就順便封存」）。
 * 3. 狀態修正排在最上方——Web 的 row menu 刻意讓它與下面的資料品質操作分開，
 *    因為「更正錯誤」跟「把資料藏起來」不是同一層級的動作。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { correctionTargetFor, manageActionsFor, REVERSE_ACTION } =
  await import("@/utils/registration-actions");

/** 最小可用的 registration；只帶規則會讀的欄位。 */
function reg(overrides = {}) {
  return {
    id: "reg-1",
    registrationCode: "ABC123",
    status: "CONFIRMED",
    ...overrides,
  };
}

test("CONFIRMED → 修正目標是 CHECKED_IN（人工報到）", () => {
  assert.equal(correctionTargetFor(reg({ status: "CONFIRMED" })), "CHECKED_IN");
});

test("CHECKED_IN → 修正目標是 CONFIRMED（撤銷報到）", () => {
  assert.equal(correctionTargetFor(reg({ status: "CHECKED_IN" })), "CONFIRMED");
});

test("其餘狀態不提供狀態修正（避免給出必定 409 的按鈕）", () => {
  for (const status of [
    "PENDING_PAYMENT",
    "CANCELLED",
    "NO_SHOW",
    "REFUNDED",
    "ARCHIVED",
    "",
  ]) {
    assert.equal(correctionTargetFor(reg({ status })), null, status);
  }
});

test("CONFIRMED 未隱藏未封存 → 三個動作，順序為 修正 / 隱藏 / 封存", () => {
  assert.deepEqual(manageActionsFor(reg()), ["correct", "hide", "archive"]);
});

test("已隱藏、已封存 → 兩軸各自翻面，且沒有狀態修正", () => {
  assert.deepEqual(
    manageActionsFor(reg({ status: "ARCHIVED", isHidden: true })),
    ["unhide", "unarchive"],
  );
});

test("已封存但未隱藏 → 修正消失，隱藏/封存各自獨立", () => {
  assert.deepEqual(manageActionsFor(reg({ status: "ARCHIVED" })), [
    "hide",
    "unarchive",
  ]);
});

test("isHidden 為 null/undefined 時視為未隱藏（舊 BE 降級不誤判）", () => {
  assert.deepEqual(manageActionsFor(reg({ isHidden: null })), [
    "correct",
    "hide",
    "archive",
  ]);
  assert.deepEqual(manageActionsFor(reg({ isHidden: undefined })), [
    "correct",
    "hide",
    "archive",
  ]);
});

test("四項可見性/封存動作都有反向；狀態修正刻意沒有", () => {
  assert.deepEqual(REVERSE_ACTION, {
    hide: "unhide",
    unhide: "hide",
    archive: "unarchive",
    unarchive: "archive",
  });
  assert.equal(REVERSE_ACTION.correct, undefined);
});
