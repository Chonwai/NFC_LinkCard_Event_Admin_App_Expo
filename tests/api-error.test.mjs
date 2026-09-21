/**
 * `src/utils/api-error.ts` 的行為鎖定（`R-06`／`H1-6`）。
 *
 * 該模組是純函式、零依賴，因此不需要任何 mock。此處的斷言同時是
 * `CRA-V1-002` 的前置條件：`isNetworkError` 的判定邊界決定了
 * 「連不上」與「後端有回應」能不能分開。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  getTerminalAuthReason,
  isNetworkError,
  isServerError,
} = await import("@/utils/api-error");

/** 後端統一的錯誤 envelope */
function httpError(status, body) {
  return { response: { status, data: body } };
}

function codedError(code) {
  return { response: { status: 500, data: { error: { code } } } };
}

/** axios 連線失敗：沒有 response */
function transportError(code, message) {
  return code === undefined ? { message } : { code, message };
}

test("getApiErrorStatus：取 HTTP 狀態碼，非物件回 null", () => {
  assert.equal(getApiErrorStatus(httpError(404, {})), 404);
  assert.equal(getApiErrorStatus(transportError("ERR_NETWORK", "x")), null);
  assert.equal(getApiErrorStatus(null), null);
  assert.equal(getApiErrorStatus("boom"), null);
});

test("getApiErrorCode：取後端錯誤碼，空字串視為沒有", () => {
  assert.equal(
    getApiErrorCode(codedError("REGISTRATION_NOT_CONFIRMED")),
    "REGISTRATION_NOT_CONFIRMED",
  );
  assert.equal(
    getApiErrorCode({ response: { status: 400, data: { error: { code: "" } } } }),
    null,
  );
  assert.equal(getApiErrorCode(null), null);
});

test("getApiErrorMessage：優先用後端 message，否則回 fallback", () => {
  const withMessage = {
    response: { status: 400, data: { error: { message: "  票券已作廢  " } } },
  };
  assert.equal(getApiErrorMessage(withMessage, "FALLBACK"), "  票券已作廢  ");

  const blankMessage = {
    response: { status: 400, data: { error: { message: "   " } } },
  };
  assert.equal(getApiErrorMessage(blankMessage, "FALLBACK"), "FALLBACK");
  assert.equal(getApiErrorMessage(null, "FALLBACK"), "FALLBACK");
});

test("isNetworkError：有 response 一律不算網路錯誤", () => {
  assert.equal(isNetworkError(httpError(500, {})), false);
  // 即使 code 落在網路碼集合內，只要伺服器有回應就不是網路錯誤。
  assert.equal(
    isNetworkError({
      response: { status: 500, data: {} },
      code: "ECONNABORTED",
    }),
    false,
  );
});

test("isNetworkError：無 response 時以 error.code 為唯一依據", () => {
  for (const code of [
    "ECONNABORTED",
    "ERR_NETWORK",
    "ETIMEDOUT",
    "ENETUNREACH",
  ]) {
    assert.equal(isNetworkError(transportError(code, "whatever")), true, code);
  }

  // code 存在且不在集合內 → 不進 message 猜測，直接判為非網路錯誤。
  assert.equal(isNetworkError(transportError("ERR_BAD_REQUEST", "x")), false);

  /**
   * 已知邊界（本次未擴大集合，僅鎖定現況）：`ECONNREFUSED` 未列入
   * `NETWORK_ERROR_CODES` → 回 false。React Native 的 axios 在連線失敗時
   * 一般給 `ERR_NETWORK`／`ECONNABORTED`，故實務上不易觸發；
   * 但若日後出現「伺服器主動拒絕」而被顯示成「找不到此報名」，原因在這裡。
   */
  assert.equal(isNetworkError({ code: "ECONNREFUSED" }), false);
});

test("isNetworkError：沒有任何 code 時才退回 message 特徵", () => {
  assert.equal(isNetworkError({ message: "Network Error" }), true);
  assert.equal(isNetworkError({ message: "Failed to fetch" }), true);
  assert.equal(isNetworkError({ message: "socket hang up" }), true);
  assert.equal(isNetworkError({ message: "timeout of 3000ms exceeded" }), true);
  assert.equal(isNetworkError({ message: "Request failed with status 404" }), false);
  assert.equal(isNetworkError(null), false);
});

test("isServerError：只認 5xx", () => {
  assert.equal(isServerError(httpError(500, {})), true);
  assert.equal(isServerError(httpError(503, {})), true);
  assert.equal(isServerError(httpError(404, {})), false);
  assert.equal(isServerError(transportError("ERR_NETWORK", "x")), false);
});

test("getTerminalAuthReason：401 過期、403 停用、其餘 null", () => {
  assert.equal(getTerminalAuthReason(httpError(401, {})), "expired");
  assert.equal(
    getTerminalAuthReason(codedError("USER_SUSPENDED")),
    null,
    "403 以外的狀態碼不算",
  );
  assert.equal(
    getTerminalAuthReason(httpError(403, { error: { code: "USER_SUSPENDED" } })),
    "suspended",
  );
  assert.equal(
    getTerminalAuthReason(httpError(403, { error: { code: "INVALID_TOKEN" } })),
    "suspended",
  );
  assert.equal(
    getTerminalAuthReason(httpError(403, { error: { code: "FORBIDDEN" } })),
    null,
  );
  assert.equal(getTerminalAuthReason(httpError(200, {})), null);
});
