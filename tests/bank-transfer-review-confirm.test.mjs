/**
 * 匯款覆核的**確認閘門**與錯誤分類（`utils/bank-transfer-review.ts`）。
 *
 * ## 為什麼這一支是這個模組最重要的測試
 *
 * 批准一筆匯款會讓一筆錢被放行，而**後端沒有反向操作**：對非 `PENDING` 一律
 * 回 `BANK_TRANSFER_ALREADY_REVIEWED`。Web 在那顆按鈕上**沒有任何確認**，
 * 一按就送。App 多了一道確認，但「多一道確認」如果只是畫面上一顆好看的按鈕，
 * 就等於沒有——所以送出路徑收斂成唯一一支 `buildReviewRequest`，
 * 並在這裡釘住：
 *
 * 1. `intent == null`（還沒選任何一列）→ `null`
 * 2. `confirmed === false`（按下「批准」、確認框還沒確認）→ `null`
 * 3. `confirmed === true` → 才組出 body
 *
 * 畫面的 `requestReview()` 只建立意圖，`submitReview()` 是唯一的送出點；
 * 兩者之間隔著這支函式。
 *
 * ## 也釘住確認框顯示的三件事
 *
 * 「誰、多少錢、哪一筆」是按下確認前唯一能發現「點錯列」的資訊。三者都是
 * **原樣**資料（人名走列表同一支組法、金額不換算、報名碼不縮寫）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildReviewConfirmation,
  buildReviewRequest,
  classifyBankTransferReviewError,
} from "@/utils/bank-transfer-review";

const APPROVAL = {
  id: "ap-1",
  eventId: "evt-1",
  registrationId: "reg-1",
  proofUrl: "https://cdn.example.com/proofs/ap-1.jpg",
  amount: "1500.50",
  currency: "MOP",
  bankRef: "TRX-9981",
  status: "PENDING",
  reviewedAt: null,
  submittedAt: "2026-10-31T03:04:05.000Z",
  registration: {
    firstName: "小明",
    lastName: "陳",
    email: "ming@example.com",
    company: null,
    registrationCode: "LKC-202611-AB12CD",
  },
};

const APPROVE_INTENT = {
  approval: APPROVAL,
  decision: "APPROVED",
  reason: "",
};

// ---------------------------------------------------------------------------
// 一、確認前不送出（本檔的核心）
// ---------------------------------------------------------------------------

test("沒有意圖（還沒選任何一列）→ 不組出請求", () => {
  assert.equal(buildReviewRequest(null, { confirmed: false }), null);
  assert.equal(buildReviewRequest(null, { confirmed: true }), null);
});

test("有意圖但**尚未確認** → 不組出請求（確認前的狀態不會被送出）", () => {
  assert.equal(
    buildReviewRequest(APPROVE_INTENT, { confirmed: false }),
    null,
    "按下批准只建立意圖；未確認就送出＝這道確認不存在",
  );
});

test("確認之後才組出請求，而且只帶 approvalId 與 decision", () => {
  assert.deepEqual(buildReviewRequest(APPROVE_INTENT, { confirmed: true }), {
    approvalId: "ap-1",
    decision: "APPROVED",
  });
});

test("批准不帶 reviewNote（與 Web 的批准請求同一個 body）", () => {
  const request = buildReviewRequest(
    { ...APPROVE_INTENT, reason: "這行字不該被送出去" },
    { confirmed: true },
  );

  assert.deepEqual(request, { approvalId: "ap-1", decision: "APPROVED" });
  assert.ok(
    !Object.prototype.hasOwnProperty.call(request, "reviewNote"),
    "批准的 body 不該有 reviewNote 這個鍵",
  );
});

test("退回：確認後帶上原因（空字串也照送，與 Web 的 prompt 空輸入一致）", () => {
  assert.deepEqual(
    buildReviewRequest(
      { approval: APPROVAL, decision: "REJECTED", reason: "金額不符" },
      { confirmed: true },
    ),
    { approvalId: "ap-1", decision: "REJECTED", reviewNote: "金額不符" },
  );

  assert.deepEqual(
    buildReviewRequest(
      { approval: APPROVAL, decision: "REJECTED", reason: "" },
      { confirmed: true },
    ),
    { approvalId: "ap-1", decision: "REJECTED", reviewNote: "" },
  );
});

test("退回：未確認時也不送出（取消≠無理由退回）", () => {
  assert.equal(
    buildReviewRequest(
      { approval: APPROVAL, decision: "REJECTED", reason: "金額不符" },
      { confirmed: false },
    ),
    null,
  );
});

// ---------------------------------------------------------------------------
// 二、確認框顯示什麼
// ---------------------------------------------------------------------------

test("確認框：誰、多少錢、哪一筆，全部是原樣資料", () => {
  const confirmation = buildReviewConfirmation(APPROVE_INTENT);

  assert.equal(confirmation.decision, "APPROVED");
  assert.equal(confirmation.person, "小明 陳");
  assert.equal(
    confirmation.amount,
    "MOP 1500.50",
    "金額是後端重算後的字串，不能四捨五入成 1500.5",
  );
  assert.equal(confirmation.registrationCode, "LKC-202611-AB12CD");
  assert.equal(confirmation.reason, null, "批准沒有「原因」這件事要顯示");
});

test("確認框：缺姓名時退回 email（與列表同一支組法）", () => {
  const confirmation = buildReviewConfirmation({
    approval: {
      ...APPROVAL,
      registration: {
        ...APPROVAL.registration,
        firstName: "",
        lastName: "",
      },
    },
    decision: "APPROVED",
    reason: "",
  });

  assert.equal(confirmation.person, "ming@example.com");
});

test("確認框：退回時原因原樣顯示（空字串照實回空，placeholder 屬畫面層）", () => {
  assert.equal(
    buildReviewConfirmation({
      approval: APPROVAL,
      decision: "REJECTED",
      reason: " 匯款金額與報名金額不符 ",
    }).reason,
    " 匯款金額與報名金額不符 ",
  );

  assert.equal(
    buildReviewConfirmation({
      approval: APPROVAL,
      decision: "REJECTED",
      reason: "",
    }).reason,
    "",
  );
});

// ---------------------------------------------------------------------------
// 三、錯誤分類（只讀 code / status，不看 message）
// ---------------------------------------------------------------------------

/** 造一個 axios 風格的錯誤（與 `utils/api-error` 的讀法一致）。 */
function apiError({ status, code, message }) {
  return {
    isAxiosError: true,
    message,
    response: { status, data: { error: { code, message } } },
  };
}

test("分類：BANK_TRANSFER_ALREADY_REVIEWED → alreadyReviewed（即使 status 是 400）", () => {
  assert.deepEqual(
    classifyBankTransferReviewError(
      apiError({
        status: 400,
        code: "BANK_TRANSFER_ALREADY_REVIEWED",
        message: "此轉賬已完成審批",
      }),
    ),
    { kind: "alreadyReviewed" },
  );
});

test("分類：BANK_TRANSFER_APPROVAL_NOT_FOUND → notFound", () => {
  assert.deepEqual(
    classifyBankTransferReviewError(
      apiError({
        status: 404,
        code: "BANK_TRANSFER_APPROVAL_NOT_FOUND",
        message: "轉賬審批記錄不存在",
      }),
    ),
    { kind: "notFound" },
  );
});

test("分類：INSUFFICIENT_PERMISSION → forbidden", () => {
  assert.deepEqual(
    classifyBankTransferReviewError(
      apiError({
        status: 403,
        code: "INSUFFICIENT_PERMISSION",
        message: "你沒有權限審批轉賬",
      }),
    ),
    { kind: "forbidden" },
  );
});

test("分類：認不得 code 時退回 status（403／404／400）", () => {
  assert.deepEqual(classifyBankTransferReviewError(apiError({ status: 403 })), {
    kind: "forbidden",
  });
  assert.deepEqual(classifyBankTransferReviewError(apiError({ status: 404 })), {
    kind: "notFound",
  });
  assert.deepEqual(classifyBankTransferReviewError(apiError({ status: 400 })), {
    kind: "validation",
  });
});

test("分類：網路錯誤／沒有回應 → failed（不謊報成權限或驗證問題）", () => {
  assert.deepEqual(
    classifyBankTransferReviewError(new Error("Network Error")),
    {
      kind: "failed",
    },
  );
  assert.deepEqual(classifyBankTransferReviewError(apiError({ status: 500 })), {
    kind: "failed",
  });
});
