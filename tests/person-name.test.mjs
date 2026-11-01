/**
 * `formatPersonName` 的測試——**全 repo 唯一的姓名組法**。
 *
 * ## 為什麼要這一支
 *
 * 2026-11-01 之前這條式子存在兩份（`bank-transfer-display.ts` 與
 * `registration-display.ts` 各一套），場次名冊需要第三份。三份同樣的規則
 * 一定會分岔，所以收成 `utils/person-name.ts` 一份。
 *
 * 收斂的風險是「以為行為一樣、其實改了」。這一支把行為逐條釘住：
 *
 * 1. 兩段都有 → 中間**一個**空白
 * 2. 只有一段 → 不要留下前後空白（`"小明 "` 那種）
 * 3. 都沒有 → 退回 email
 * 4. email 也沒有 → **空字串**（不是 `null`：呼叫端直接放進 `Text`）
 * 5. `null` / `undefined` / 純空白都視為沒有值
 *
 * 以及最重要的一條：`formatBankTransferPersonName` 必須**等於**
 * `formatPersonName`——那支現在只是轉呼叫，若哪天有人在那裡加料
 * （例如補上 `—` 或改成 `lastName + firstName`），匯款頁與名冊頁就會顯示
 * 不同的名字，而且兩邊都不會報錯。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { formatPersonName } = await import("@/utils/person-name");
const { formatBankTransferPersonName } =
  await import("@/utils/bank-transfer-display");

test("兩段都有值：中間恰好一個空白", () => {
  assert.equal(formatPersonName("小明", "王", "ming@example.com"), "小明 王");
});

test("只有 first：不留下尾隨空白", () => {
  assert.equal(formatPersonName("小明", "", "ming@example.com"), "小明");
  assert.equal(formatPersonName("小明", null, "ming@example.com"), "小明");
});

test("只有 last：不留下前置空白", () => {
  assert.equal(formatPersonName("", "王", "ming@example.com"), "王");
  assert.equal(formatPersonName(undefined, "王", "ming@example.com"), "王");
});

test("都沒有值：退回 email", () => {
  assert.equal(
    formatPersonName("", "", "ming@example.com"),
    "ming@example.com",
  );
  assert.equal(
    formatPersonName(null, null, "ming@example.com"),
    "ming@example.com",
  );
});

test("連 email 都沒有：空字串（不是 null，也不是破折號）", () => {
  assert.equal(formatPersonName("", "", ""), "");
  assert.equal(formatPersonName(null, null, null), "");
  assert.equal(formatPersonName(undefined, undefined, undefined), "");
});

test("純空白視為沒有值，不是有值", () => {
  assert.equal(
    formatPersonName("   ", "  ", "ming@example.com"),
    "ming@example.com",
  );
  assert.equal(formatPersonName("   ", "   ", ""), "");
});

test("前後空白會被 trim（畫面上不該出現「 小明」）", () => {
  assert.equal(formatPersonName("  小明  ", "  王  ", "x@y.z"), "小明 王");
});

test("formatBankTransferPersonName 與 formatPersonName 完全一致", () => {
  const cases = [
    { firstName: "小明", lastName: "王", email: "ming@example.com" },
    { firstName: "小明", lastName: "", email: "ming@example.com" },
    { firstName: "", lastName: "王", email: "ming@example.com" },
    { firstName: "", lastName: "", email: "ming@example.com" },
    { firstName: "", lastName: "", email: "" },
    { firstName: null, lastName: null, email: null },
    { firstName: "  小明  ", lastName: "  王  ", email: "x@y.z" },
  ];

  for (const c of cases) {
    assert.equal(
      formatBankTransferPersonName(c),
      formatPersonName(c.firstName, c.lastName, c.email),
      `匯款頁與名冊頁的姓名組法分岔了：${JSON.stringify(c)}`,
    );
  }
});
