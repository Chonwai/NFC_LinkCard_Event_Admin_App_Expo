/**
 * 批次寄送 claim email 的**規則**鎖定。
 *
 * 這幾條規則決定「預設勾誰」「為什麼那一列不能寄」「失敗是哪一種」。它們錯了
 * **不會有任何錯誤訊息**：只會寄錯人、該寄的人沒寄，或把「沒有帳號」誤報成
 * 「寄送失敗」讓操作員一直重試。逐字對齊 Web
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/registrations/page.tsx:712-770`。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  batchClaimCandidates,
  batchSummary,
  claimReason,
  classifySendError,
  isDefaultClaimRecipient,
} = await import("@/utils/registration-claim-batch");

/** 最小可用的 registration。 */
function reg(overrides = {}) {
  return {
    id: "reg-1",
    registrationCode: "ABC123",
    status: "CONFIRMED",
    ...overrides,
  };
}

/** 最小可用的 activation-link 狀態。 */
function info(overrides = {}) {
  return {
    email: "a@b.com",
    firstName: "A",
    lastName: "B",
    isActivated: false,
    userId: "u-1",
    activationToken: null,
    activationUrl: null,
    ...overrides,
  };
}

/** 模擬後端錯誤（與 `apiClient` 失敗時的形狀一致）。 */
function apiError(status, code) {
  const error = new Error("boom");
  error.response = { status, data: { error: { code, message: "…" } } };
  return error;
}

test("只有 CONFIRMED 的報名是候選（未確認的人沒有「已確認」可以寄）", () => {
  const rows = [
    reg({ id: "a", status: "CONFIRMED" }),
    reg({ id: "b", status: "PENDING_PAYMENT" }),
    reg({ id: "c", status: "CHECKED_IN" }),
    reg({ id: "d", status: "CANCELLED" }),
    reg({ id: "e", status: "confirmed" }),
  ];
  assert.deepEqual(
    batchClaimCandidates(rows).map((item) => item.id),
    ["a", "e"],
  );
});

test("預設收件人＝有帳號、未 claim、且沒有有效 token", () => {
  assert.equal(isDefaultClaimRecipient(info()), true);
});

test("沒有帳號 ⇒ 不是預設收件人（補發會建帳號＋寄信，需逐一 opt-in）", () => {
  assert.equal(isDefaultClaimRecipient(info({ userId: null })), false);
});

test("已 claim ⇒ 不是預設收件人", () => {
  assert.equal(isDefaultClaimRecipient(info({ isActivated: true })), false);
});

test("已有有效 token ⇒ 不是預設收件人（再寄只會製造第二封同內容的信）", () => {
  assert.equal(
    isDefaultClaimRecipient(info({ activationToken: "tok-1" })),
    false,
  );
});

test("claimReason 四態各自正確", () => {
  assert.equal(claimReason(info()), "pending_claim");
  assert.equal(claimReason(info({ userId: null })), "no_account");
  assert.equal(claimReason(info({ isActivated: true })), "activated");
  assert.equal(claimReason(info({ activationToken: "tok-1" })), "has_token");
});

test("錯誤碼 → 分類：409 已 claim、403 無權限、404 找不到、422 建帳號失敗、502 寄送失敗", () => {
  assert.deepEqual(classifySendError(apiError(409, "TOKEN_ALREADY_CLAIMED")), {
    status: "claimed",
  });
  assert.deepEqual(
    classifySendError(apiError(403, "INSUFFICIENT_PERMISSION")),
    {
      status: "forbidden",
    },
  );
  assert.deepEqual(classifySendError(apiError(404, "REGISTRATION_NOT_FOUND")), {
    status: "not_found",
  });
  assert.deepEqual(
    classifySendError(apiError(422, "REGISTRATION_ACCOUNT_MISSING")),
    { status: "account_missing" },
  );
  assert.deepEqual(
    classifySendError(apiError(502, "ACTIVATION_EMAIL_SEND_FAILED")),
    { status: "send_failed" },
  );
});

test("只看 status 也能分類（後端沒回 code 時不會全落到『失敗』）", () => {
  assert.deepEqual(classifySendError(apiError(409, undefined)), {
    status: "claimed",
  });
  assert.deepEqual(classifySendError(apiError(422, undefined)), {
    status: "account_missing",
  });
});

test("非物件／空錯誤 ⇒ failed，不丟例外", () => {
  assert.deepEqual(classifySendError(null), { status: "failed" });
  assert.deepEqual(classifySendError(undefined), { status: "failed" });
  assert.deepEqual(classifySendError("nope"), { status: "failed" });
});

test("結果摘要：failed ＝ 已選 − 成功（中斷時沒有 outcome 的也要算失敗）", () => {
  const summary = batchSummary(["a", "b", "c"], {
    a: { status: "sent", sentAt: "t" },
    b: { status: "claimed" },
    // c 完全沒有 outcome（例如流程被中斷）—— 仍要算失敗
  });
  assert.deepEqual(summary, { success: 1, failed: 2 });
});

test("結果摘要：全成功時 failed 為 0", () => {
  assert.deepEqual(
    batchSummary(["a"], { a: { status: "sent", sentAt: "t" } }),
    { success: 1, failed: 0 },
  );
});
