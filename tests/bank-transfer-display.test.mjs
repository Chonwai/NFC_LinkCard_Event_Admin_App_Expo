/**
 * 匯款覆核畫面的顯示推導（`utils/bank-transfer-display.ts`）。
 *
 * ## 為什麼要這一支
 *
 * 這一頁會放行款項，而「畫面上寫的是誰、多少錢、哪一筆」全部由這三個函式
 * 決定。AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），
 * 所以推導必須在 util 層被釘住——否則「人名組法改了一個字」這種事，只能靠
 * 讀原始碼發現。
 *
 * ## 它刻意不驗什麼
 * - **不驗**文案本身好不好（那是 copy 的事）。
 * - **不驗**清單請求和分頁（那是 `bank-transfer-service.test.mjs`）。
 * - **不驗**「按下批准前有沒有二次確認」（那是
 *   `bank-transfer-review-confirm.test.mjs`）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "@/constants/copy.zh-TW";
import {
  bankTransferStatusLabel,
  bankTransferTabCounts,
  formatBankTransferPersonName,
} from "@/utils/bank-transfer-display";

// ---------------------------------------------------------------------------
// 一、人名（照 Web `formatPersonName`）
// ---------------------------------------------------------------------------

test("人名：姓與名都有 → 用單一空白相接", () => {
  assert.equal(
    formatBankTransferPersonName({
      firstName: "小明",
      lastName: "陳",
      email: "ming@example.com",
      registrationCode: "LKC-202611-AB12CD",
    }),
    "小明 陳",
  );
});

test("人名：只有名 → 不留下尾端空白", () => {
  assert.equal(
    formatBankTransferPersonName({
      firstName: "小明",
      lastName: "",
      email: "ming@example.com",
      registrationCode: "LKC-202611-AB12CD",
    }),
    "小明",
  );
});

test("人名：姓與名都是空白 → 退回 email（與 Web 的 fallback 相同）", () => {
  assert.equal(
    formatBankTransferPersonName({
      firstName: "  ",
      lastName: "",
      email: "ming@example.com",
      registrationCode: "LKC-202611-AB12CD",
    }),
    "ming@example.com",
  );
});

test("人名：什麼都沒有 → 空字串（呼叫端自己決定要不要顯示破折號）", () => {
  assert.equal(
    formatBankTransferPersonName({
      firstName: "",
      lastName: "",
      email: "",
      registrationCode: "LKC-202611-AB12CD",
    }),
    "",
  );
});

// ---------------------------------------------------------------------------
// 二、狀態對照（認不得的字串原樣印出）
// ---------------------------------------------------------------------------

test("狀態：三個已知值走 copy", () => {
  assert.equal(
    bankTransferStatusLabel("PENDING"),
    copy.bankTransfers.tabs.pending,
  );
  assert.equal(
    bankTransferStatusLabel("APPROVED"),
    copy.bankTransfers.tabs.approved,
  );
  assert.equal(
    bankTransferStatusLabel("REJECTED"),
    copy.bankTransfers.tabs.rejected,
  );
});

test("狀態：認不得的值原樣印出（不是空白、不是「未知」）", () => {
  assert.equal(bankTransferStatusLabel("REFUNDED"), "REFUNDED");
  assert.equal(bankTransferStatusLabel(""), "");
});

// ---------------------------------------------------------------------------
// 三、頁籤計數（來源是 manage-stats，一次請求）
// ---------------------------------------------------------------------------

test("計數：完整回應 → 四個頁籤各自的數字", () => {
  const counts = bankTransferTabCounts({
    registrations: { total: 0, byStatus: {} },
    exhibitors: { total: 0, byStatus: {} },
    bankTransfers: {
      total: 9,
      byStatus: { PENDING: 4, APPROVED: 3, REJECTED: 2 },
    },
  });

  assert.deepEqual(counts, { "": 9, PENDING: 4, APPROVED: 3, REJECTED: 2 });
});

test("計數：byStatus 缺該狀態 → 0（BE 的 groupBy 不補 0，缺＝真的 0 筆）", () => {
  const counts = bankTransferTabCounts({
    registrations: { total: 0, byStatus: {} },
    exhibitors: { total: 0, byStatus: {} },
    bankTransfers: { total: 2, byStatus: { APPROVED: 2 } },
  });

  assert.deepEqual(counts, { "": 2, PENDING: 0, APPROVED: 2, REJECTED: 0 });
});

test("計數：stats 還沒到（null）→ null，呼叫端不顯示任何數字", () => {
  assert.equal(bankTransferTabCounts(null), null);
  assert.equal(bankTransferTabCounts(undefined), null);
});

test("計數：全部為 0 也回數字（不是 null）——「讀到了，就是 0」", () => {
  const counts = bankTransferTabCounts({
    registrations: { total: 0, byStatus: {} },
    exhibitors: { total: 0, byStatus: {} },
    bankTransfers: { total: 0, byStatus: {} },
  });

  assert.deepEqual(counts, { "": 0, PENDING: 0, APPROVED: 0, REJECTED: 0 });
});
