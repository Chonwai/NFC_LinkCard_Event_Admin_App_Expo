/**
 * `src/utils/nfc-bind-errors.ts` 的行為鎖定（`R-06`／`H1-6`）。
 *
 * 這個模組把「寫卡例外」與「後端 bind 錯誤」收斂成互斥的畫面分類；分類錯了，
 * 現場看到的處置指示就是錯的（例如把「這張卡已綁給別人」講成「UID 格式錯誤」）。
 *
 * 載入鏈：`nfc-bind-errors` → `nfc-utils` → `react-native`。純 Node 載不起
 * `react-native`，因此只 mock `react-native`，**不** mock `nfc-utils`——
 * 這樣 `NfcFlowError` 才是真的類別，`instanceof` 的斷言才有意義。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const { NFC_WRITE_TIMEOUT_MS, NfcFlowError } = await import("@/utils/nfc-utils");
const { classifyNfcBindError } = await import("@/utils/nfc-bind-errors");

/** 後端錯誤 envelope（有 response ＝ 伺服器有回應） */
function apiError(status, code) {
  return { response: { status, data: { error: { code } } } };
}

test("寫卡例外：4 個既有 kind 各自對應到互斥的分類", () => {
  assert.equal(
    classifyNfcBindError(new NfcFlowError("unsupported", "web")),
    "unsupported",
  );
  assert.equal(
    classifyNfcBindError(new NfcFlowError("invalid-uid", "bad uid")),
    "invalid-uid",
  );
  assert.equal(
    classifyNfcBindError(new NfcFlowError("uri-mismatch", "read-back differs")),
    "uri-mismatch",
  );
  assert.equal(
    classifyNfcBindError(new NfcFlowError("write-failed", "write blew up")),
    "write-failed",
  );
});

test("後端錯誤碼：UID 類 → invalid-uid", () => {
  assert.equal(classifyNfcBindError(apiError(400, "INVALID_TAG_UID")), "invalid-uid");
  assert.equal(classifyNfcBindError(apiError(400, "TAG_UID_INVALID")), "invalid-uid");
  assert.equal(classifyNfcBindError(apiError(400, "TAG_UID_MISSING")), "invalid-uid");
});

test("後端錯誤碼：「報名已有卡」→ bound-other，優先於「UID 重複」", () => {
  assert.equal(
    classifyNfcBindError(apiError(409, "REGISTRATION_ALREADY_BOUND")),
    "bound-other",
  );
  assert.equal(
    classifyNfcBindError(apiError(409, "REGISTRATION_HAS_BADGE")),
    "bound-other",
  );
  assert.equal(
    classifyNfcBindError(apiError(409, "BADGE_ALREADY_ASSIGNED")),
    "bound-other",
  );
});

test("後端錯誤碼：「這張 UID 已被佔用」→ duplicate", () => {
  assert.equal(
    classifyNfcBindError(apiError(409, "TAG_UID_ALREADY_EXISTS")),
    "duplicate",
  );
  assert.equal(
    classifyNfcBindError(apiError(409, "TAG_ALREADY_BOUND")),
    "duplicate",
  );
  assert.equal(
    classifyNfcBindError(apiError(409, "DUPLICATE_TAG_UIDS")),
    "duplicate",
  );
});

test("沒有可辨識錯誤碼時，退回 HTTP 狀態碼", () => {
  assert.equal(classifyNfcBindError(apiError(409, "SOMETHING")), "duplicate");
  assert.equal(classifyNfcBindError(apiError(400, "SOMETHING")), "invalid-uid");
  assert.equal(classifyNfcBindError(apiError(500, "SOMETHING")), "bind-failed");
});

test("無法分類的錯誤 → bind-failed（不得當成成功）", () => {
  assert.equal(classifyNfcBindError(new Error("boom")), "bind-failed");
  assert.equal(classifyNfcBindError({ message: "Network Error" }), "bind-failed");
  assert.equal(classifyNfcBindError(null), "bind-failed");
  assert.equal(classifyNfcBindError(undefined), "bind-failed");
});

test("CRA-V1-009：逾時與取消有專屬分類，不與 write-failed 混用", () => {
  assert.equal(
    classifyNfcBindError(
      new NfcFlowError("timeout", "NFC write timed out after 20000ms"),
    ),
    "timeout",
  );
  assert.equal(
    classifyNfcBindError(new NfcFlowError("cancelled", "NFC write cancelled")),
    "cancelled",
  );
});

test("CRA-V1-009：寫卡逾時為 20s（D9 預設）", () => {
  assert.equal(NFC_WRITE_TIMEOUT_MS, 20000);
});
