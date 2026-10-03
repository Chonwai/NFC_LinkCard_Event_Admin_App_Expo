/**
 * `src/utils/nfc-exchange.ts` 的行為鎖定（Loop AB · WP-20）。
 *
 * 這個模組持有交換流程的三條規則：**讀到卡之後怎麼走**（`decideCapture`）、
 * **要不要送出**（`decideSubmit`）、**失敗是哪一種**（`classifyExchangeError`）。
 * 三條都直接決定現場看到的處置指示；例如把「對方的卡沒綁」講成「你的卡沒綁」，
 * 工作人員就會去重寫錯的那一張。
 *
 * 載入鏈：`nfc-exchange` → `nfc-utils` → `react-native`。純 Node 載不起
 * `react-native`，因此只 mock `react-native`，**不** mock `nfc-utils`——
 * 這樣 `NfcFlowError` 才是真的類別、`normalizeTagUid` 才是真的實作，
 * `instanceof` 與 UID 正規化的斷言才有意義（同 `nfc-bind-errors.test.mjs` 的做法）。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const { classifyExchangeError, decideCapture, decideSubmit, exchangePairKey } =
  await import("@/utils/nfc-exchange");
const { NfcFlowError } = await import("@/utils/nfc-utils");

/** 後端錯誤 envelope（有 response ＝ 伺服器有回應） */
function apiError(status, code) {
  return { response: { status, data: { error: { code } } } };
}

// ---------------------------------------------------------------------------
// decideCapture — 兩次感應的狀態機（AC-20-1／AC-20-5）
// ---------------------------------------------------------------------------

test("第一張卡尚未讀到時，任何卡都成為 initiator", () => {
  assert.deepEqual(decideCapture({ initiatorUid: null }, "04A1B2C3"), {
    action: "set-initiator",
    uid: "04A1B2C3",
  });
});

test("已有 initiator 時，不同的卡成為 receiver", () => {
  assert.deepEqual(decideCapture({ initiatorUid: "04A1B2C3" }, "04D4E5F6"), {
    action: "set-receiver",
    uid: "04D4E5F6",
  });
});

test("AC-20-5：同一張卡再感應一次 → reject-same-badge（前端先擋，不消耗第一張卡）", () => {
  assert.deepEqual(decideCapture({ initiatorUid: "04A1B2C3" }, "04A1B2C3"), {
    action: "reject-same-badge",
  });
});

test("AC-20-5：自換的判定與大小寫／分隔符無關（與後端同一套 normalizeTagUid）", () => {
  // 讀卡層回的是正規化值，但這裡仍以「非正規化輸入」驗證比較語意是共用實作。
  assert.deepEqual(decideCapture({ initiatorUid: "04A1B2C3" }, "04:a1:b2:c3"), {
    action: "reject-same-badge",
  });
  assert.deepEqual(decideCapture({ initiatorUid: "04a1b2c3" }, "04A1B2C3"), {
    action: "reject-same-badge",
  });
});

// ---------------------------------------------------------------------------
// decideSubmit — 送不送 POST /nfc/exchange（AC-20-2／AC-20-4）
// ---------------------------------------------------------------------------

test("AC-20-2：兩張卡都就位且非同一張 → submit，並原樣帶出兩個 UID", () => {
  assert.deepEqual(decideSubmit("uid-A", "uid-B"), {
    action: "submit",
    initiatorUid: "uid-A",
    receiverUid: "uid-B",
  });
});

test("缺任何一張卡 → incomplete（不得送出半筆交換）", () => {
  assert.deepEqual(decideSubmit(null, "uid-B"), { action: "incomplete" });
  assert.deepEqual(decideSubmit("uid-A", null), { action: "incomplete" });
  assert.deepEqual(decideSubmit(null, null), { action: "incomplete" });
  assert.deepEqual(decideSubmit("", ""), { action: "incomplete" });
});

test("submit 前再擋一次自換（不依賴 UI 是否已擋）", () => {
  assert.deepEqual(decideSubmit("uid-A", "uid-A"), {
    action: "reject-same-badge",
  });
  // 同一個 UID 的大小寫變體經 normalizeTagUid 後相同 ⇒ 仍是自換。
  assert.deepEqual(decideSubmit("uid-A", "uid-a"), {
    action: "reject-same-badge",
  });
});

test("AC-20-4：同一組配對已送出過 → duplicate（後端冪等之外，前端也少打一次）", () => {
  const pair = exchangePairKey("uid-A", "uid-B");
  assert.deepEqual(decideSubmit("uid-A", "uid-B", pair), {
    action: "duplicate",
  });
});

test("配對鍵是無序的：A↔B 與 B↔A 必須是同一個鍵（反向重按也應被視為重複）", () => {
  assert.equal(
    exchangePairKey("uid-A", "uid-B"),
    exchangePairKey("uid-B", "uid-A"),
  );
  assert.notEqual(
    exchangePairKey("uid-A", "uid-B"),
    exchangePairKey("uid-A", "uid-C"),
  );
});

test("不同的配對不受前一次影響 → 仍可 submit", () => {
  const pair = exchangePairKey("uid-A", "uid-B");
  assert.deepEqual(decideSubmit("uid-A", "uid-C", pair), {
    action: "submit",
    initiatorUid: "uid-A",
    receiverUid: "uid-C",
  });
});

// ---------------------------------------------------------------------------
// classifyExchangeError — 每一類都要對應一句可行動的指示（AC-20-6／AC-20-7）
// ---------------------------------------------------------------------------

test("讀卡例外：unsupported 與 invalid-uid 各自對應，其餘收斂成讀取失敗", () => {
  assert.equal(
    classifyExchangeError(new NfcFlowError("unsupported", "web")),
    "unsupported",
  );
  assert.equal(
    classifyExchangeError(new NfcFlowError("invalid-uid", "bad uid")),
    "invalid-uid",
  );
  // 只讀不寫的流程裡，逾時／取消／寫入失敗都代表「這次沒讀到卡」。
  assert.equal(
    classifyExchangeError(new NfcFlowError("timeout", "20s")),
    "invalid-uid",
  );
  assert.equal(
    classifyExchangeError(new NfcFlowError("cancelled", "user")),
    "invalid-uid",
  );
  assert.equal(
    classifyExchangeError(new NfcFlowError("write-failed", "boom")),
    "invalid-uid",
  );
});

test("AC-20-6：哪一張卡沒綁必須指對邊（先判 RECEIVER，再判 INITIATOR／泛用 NOT_BOUND）", () => {
  assert.equal(
    classifyExchangeError(apiError(404, "RECEIVER_BADGE_NOT_BOUND")),
    "receiver-not-bound",
  );
  assert.equal(
    classifyExchangeError(apiError(404, "INITIATOR_BADGE_NOT_BOUND")),
    "initiator-not-bound",
  );
  // 讀卡階段的公開 lookup 走的是這個泛用碼（lookupNfcBadge）。
  assert.equal(
    classifyExchangeError(apiError(404, "NFC_BADGE_NOT_BOUND")),
    "card-not-bound",
  );
});

test("自換與停用各有專屬分類（不得被 NOT_BOUND 蓋掉）", () => {
  assert.equal(
    classifyExchangeError(apiError(400, "SAME_BADGE_EXCHANGE")),
    "same-badge",
  );
  assert.equal(
    classifyExchangeError(apiError(400, "BADGE_DEACTIVATED")),
    "deactivated",
  );
  assert.equal(
    classifyExchangeError(apiError(400, "RECEIVER_BADGE_DEACTIVATED")),
    "deactivated",
  );
});

test("WP-19 硬化後的 422 VALIDATION_ERROR → rejected（欄名／值域不符，屬工程問題）", () => {
  assert.equal(
    classifyExchangeError(apiError(422, "VALIDATION_ERROR")),
    "rejected",
  );
});

test("identifier-missing：帶了 request 但沒帶 uid／qr", () => {
  assert.equal(
    classifyExchangeError(apiError(400, "INITIATOR_IDENTIFIER_MISSING")),
    "identifier-missing",
  );
  assert.equal(
    classifyExchangeError(apiError(400, "RECEIVER_IDENTIFIER_MISSING")),
    "identifier-missing",
  );
});

test("憑證與伺服器錯誤各有專屬分類（不得混成 failed）", () => {
  assert.equal(classifyExchangeError(apiError(401, "ANY")), "unauthorized");
  assert.equal(classifyExchangeError(apiError(403, "ANY")), "unauthorized");
  assert.equal(classifyExchangeError(apiError(500, "ANY")), "server");
  assert.equal(classifyExchangeError(apiError(503, "ANY")), "server");
});

test("斷網／逾時 → network，且**不依賴** response envelope（axios 沒有 response）", () => {
  // 這條是回歸鎖：分類器先前只看 `response.data.error.code`，而 axios 在斷網時
  // 根本沒有 `response` ⇒ 會被誤報成「讀取失敗（請靠近卡片）」，把工程問題
  // 講成現場操作問題。現在改走 `api-error.ts` 的 `isNetworkError`（單一真相來源）。
  assert.equal(classifyExchangeError({ code: "ECONNABORTED" }), "network");
  assert.equal(classifyExchangeError({ code: "ERR_NETWORK" }), "network");
  assert.equal(classifyExchangeError({ code: "ETIMEDOUT" }), "network");
  assert.equal(classifyExchangeError({ message: "Network Error" }), "network");
});

test("沒有可辨識碼時退回 HTTP 狀態碼，仍不可回成功態", () => {
  assert.equal(
    classifyExchangeError(apiError(404, "SOMETHING")),
    "receiver-not-bound",
  );
  assert.equal(
    classifyExchangeError(apiError(400, "SOMETHING")),
    "invalid-uid",
  );
  assert.equal(classifyExchangeError(apiError(422, "SOMETHING")), "rejected");
  assert.equal(classifyExchangeError(apiError(418, "SOMETHING")), "failed");
});

test("無法分類的錯誤 → failed（永遠不得當成成功）", () => {
  assert.equal(classifyExchangeError(new Error("boom")), "failed");
  assert.equal(
    classifyExchangeError({ message: "something unexpected" }),
    "failed",
  );
  assert.equal(classifyExchangeError(null), "failed");
  assert.equal(classifyExchangeError(undefined), "failed");
  assert.equal(classifyExchangeError("oops"), "failed");
});
