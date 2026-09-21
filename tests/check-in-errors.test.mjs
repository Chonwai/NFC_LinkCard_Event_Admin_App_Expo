/**
 * `CRA-V1-002` 的風險控制測試（計畫 §11 `R-3`）。
 *
 * 這個檔案存在的唯一理由：證明「加入網路分支」**不會**把真正的 404 吃掉。
 * 若哪天有人把判定順序對調、或用 `||` 串接，下面第二組斷言會立刻失敗。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { copy } = await import("@/constants/copy.zh-TW");
const { resolveCheckInErrorMessage } = await import("@/utils/check-in-errors");

/** 伺服器沒有回應（連不上／逾時）：axios 不帶 response */
function transportError(code, message) {
  return code === undefined ? { message } : { code, message };
}

/** 伺服器有回應的後端錯誤 */
function apiError(status, code, message) {
  return {
    response: {
      status,
      data: { error: { ...(code ? { code } : {}), ...(message ? { message } : {}) } },
    },
  };
}

test("R-3 ①：連不上伺服器 → 網路文案，且**不得**是「找不到此報名」", () => {
  for (const code of [
    "ECONNABORTED",
    "ERR_NETWORK",
    "ETIMEDOUT",
    "ENETUNREACH",
  ]) {
    const message = resolveCheckInErrorMessage(transportError(code, "x"));
    assert.equal(message, copy.checkIn.networkError, code);
    assert.notEqual(message, copy.checkIn.registrationNotFound, code);
  }

  // 完全沒有 code 時退回 message 特徵
  assert.equal(
    resolveCheckInErrorMessage(transportError(undefined, "Network Error")),
    copy.checkIn.networkError,
  );
});

test("R-3 ②：真正的 404 → 仍回「找不到此報名」", () => {
  assert.equal(
    resolveCheckInErrorMessage(apiError(404)),
    copy.checkIn.registrationNotFound,
  );
  assert.equal(
    resolveCheckInErrorMessage(apiError(404, "REGISTRATION_NOT_FOUND")),
    copy.checkIn.registrationNotFound,
  );
});

test("R-3 ③：有 response 的錯誤永不落入網路分支（即使 code 像網路碼）", () => {
  const message = resolveCheckInErrorMessage({
    response: { status: 404, data: {} },
    code: "ECONNABORTED",
  });
  assert.equal(message, copy.checkIn.registrationNotFound);
  assert.notEqual(message, copy.checkIn.networkError);
});

test("後端錯誤碼優先於狀態碼 fallback", () => {
  assert.equal(
    resolveCheckInErrorMessage(apiError(409, "REGISTRATION_NOT_CONFIRMED")),
    copy.checkIn.notConfirmed,
  );
  assert.equal(
    resolveCheckInErrorMessage(apiError(403, "INSUFFICIENT_PERMISSION")),
    copy.checkIn.notEnoughPermission,
  );
  assert.equal(
    resolveCheckInErrorMessage(apiError(409, "ALREADY_CHECKED_IN")),
    copy.checkIn.alreadyCheckedIn,
  );
  assert.equal(
    resolveCheckInErrorMessage(apiError(429, "REGISTRATION_LOOKUP_RATE_LIMITED")),
    copy.checkIn.rateLimited,
  );
});

test("未知錯誤碼但有後端 message → 顯示該 message", () => {
  assert.equal(
    resolveCheckInErrorMessage(apiError(400, "SOMETHING_NEW", "票券已作廢")),
    "票券已作廢",
  );
});

test("未知錯誤碼且無 message → 回「找不到此報名」而非空白", () => {
  assert.equal(
    resolveCheckInErrorMessage(apiError(500, "SOMETHING_NEW")),
    copy.checkIn.registrationNotFound,
  );
  assert.equal(
    resolveCheckInErrorMessage(new Error("boom")),
    copy.checkIn.registrationNotFound,
  );
});

test("錯誤碼用 Object.prototype 的鍵名時，回傳字串而非函式", () => {
  // 直接索引 Record 會取到 Object.prototype.constructor（函式）→ React 會炸。
  for (const code of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
    const message = resolveCheckInErrorMessage(apiError(400, code));
    assert.equal(typeof message, "string", code);
    assert.ok(message.length > 0, code);
  }
});
