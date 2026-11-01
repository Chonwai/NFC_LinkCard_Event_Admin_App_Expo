/**
 * `src/utils/poll-errors.ts` 的行為鎖定（R5）。
 *
 * ## 這支測試要釘住的是「不要原樣轉發」
 *
 * `polls.tsx` 原本直接用 `getApiErrorMessage(error, copy.polls.actionError)`，
 * 也就是**後端給什麼就顯示什麼**。後端只有少數幾條錯誤是給操作員看的中文，
 * 其餘是 `Failed to create poll`、`Internal Server Error` 這類英文。畫面上出現
 * 一句英文，操作員會以為是自己按錯，然後重試同一個動作。
 *
 * 所以這裡的正例與**反例同樣重要**：反例（未知碼 / 沒碼 / 5xx）必須落回
 * `copy.polls.actionError`，不是落回後端訊息。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "@/constants/copy.zh-TW";
import {
  KNOWN_POLL_ERROR_CODES,
  resolvePollActionErrorMessage,
} from "@/utils/poll-errors";

/** 後端統一的錯誤 envelope */
function httpError(status, body) {
  return { response: { status, data: body } };
}

/** 帶碼與訊息的後端錯誤（形狀同 `ApiResponse.error`） */
function backendError(status, code, message) {
  return httpError(status, { error: { code, message } });
}

test("已知的碼 ⇒ 原樣顯示後端訊息（那幾句是寫給操作員看的中文）", () => {
  assert.equal(
    resolvePollActionErrorMessage(
      backendError(400, "VALIDATION_ERROR", "問題和至少兩個選項是必填的"),
    ),
    "問題和至少兩個選項是必填的",
  );
  assert.equal(
    resolvePollActionErrorMessage(
      backendError(403, "INSUFFICIENT_PERMISSION", "你沒有權限關閉投票"),
    ),
    "你沒有權限關閉投票",
  );
  assert.equal(
    resolvePollActionErrorMessage(
      backendError(404, "POLL_NOT_FOUND", "投票不存在"),
    ),
    "投票不存在",
  );
});

test("未知的碼 ⇒ 落回 copy.polls.actionError，不顯示後端原文", () => {
  // 反例探針：這條若回 "Failed to create poll"，畫面就會出現一句英文。
  assert.equal(
    resolvePollActionErrorMessage(
      backendError(500, "INTERNAL_SERVER_ERROR", "Failed to create poll"),
    ),
    copy.polls.actionError,
  );
  assert.equal(
    resolvePollActionErrorMessage(backendError(418, "SOMETHING_ELSE", "nope")),
    copy.polls.actionError,
  );
});

test("沒有 response（連不上／逾時）⇒ 落回 copy.polls.actionError", () => {
  // axios 連線失敗沒有 `response`，因此沒有錯誤碼可白名單比對。
  assert.equal(
    resolvePollActionErrorMessage({ code: "ERR_NETWORK", message: "x" }),
    copy.polls.actionError,
  );
  assert.equal(resolvePollActionErrorMessage(null), copy.polls.actionError);
  assert.equal(resolvePollActionErrorMessage("boom"), copy.polls.actionError);
});

test("已知的碼但訊息是空白 ⇒ 仍落回 copy.polls.actionError", () => {
  // `getApiErrorMessage` 對空白訊息已經回 fallback；這裡鎖住「上層不會因為
  // 「碼認得」就把空字串放行」。
  assert.equal(
    resolvePollActionErrorMessage(backendError(404, "POLL_NOT_FOUND", "   ")),
    copy.polls.actionError,
  );
});

test("白名單不含 5xx 的預設碼（英文訊息對操作員不可行動）", () => {
  assert.equal(KNOWN_POLL_ERROR_CODES.has("INTERNAL_SERVER_ERROR"), false);
  // 也不含訪客投票路徑的碼：後台碰不到，收進來只會變成一張對不上的表。
  assert.equal(KNOWN_POLL_ERROR_CODES.has("ALREADY_VOTED"), false);
  assert.equal(KNOWN_POLL_ERROR_CODES.has("POLL_NOT_ACTIVE"), false);
});
