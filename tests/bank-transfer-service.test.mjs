/**
 * `bankTransferService` 的**語意測試**（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 *
 * 匯款覆核是「會動到錢」的兩支呼叫，而它們有四個 TypeScript 看不到的坑：
 *
 * 1. **清單只送 `status`**。後端有分頁（預設 `limit=20`），Web 的頁面從不送
 *    `page` / `limit`。若有人在這裡「順手補齊」分頁，App 就多了一個 Web
 *    沒有的行為；反過來若有人把 `status` 拿掉，四個頁籤會全部顯示同一份清單。
 * 2. **沒有參數時查詢字串是空的，但 `?` 還在**。這照 Web 的模板字串
 *    （`/${eventId}/bank-transfers?${query}`）。有人在這裡改成「沒參數就不接
 *    `?`」不會壞，但會讓這個檔與 Web 的形狀分岔，而下一次「順手」就會是
 *    加參數。
 * 3. **`reviewNote` 為 `undefined` 時整個欄位不送**（不是送 `null`、不是送
 *    `""`）。後端 DTO 是 `@IsOptional() @IsString()`，送 `null` 會被打成
 *    `VALIDATION_ERROR`。
 * 4. **金額原樣透傳**。`amount` 是後端**重算後**的十進位字串；在這裡
 *    `Number()` 一下就會把 `"1500.50"` 變成 `1500.5`，覆核畫面顯示的金額就
 *    與後端算的不一致——那是錯在最貴的地方。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是
 *   `tests/bank-transfer-contract.test.mjs` 與全域 `npm run check:contract`
 *   的事。
 * - **不驗**「按下確認前有沒有先問」——那是 `utils/bank-transfer-review.ts`
 *   與 `tests/bank-transfer-review-confirm.test.mjs` 的事（本支只管 service
 *   原樣透傳）。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, payload, config) 都記在這裡，供斷言觀察。 */
const calls = [];

const APPROVAL = {
  id: "ap-1",
  eventId: "evt-1",
  registrationId: "reg-1",
  proofUrl: "https://cdn.example.com/proofs/ap-1.jpg",
  // Decimal 序列化後是字串——不是 number，也不是「分」。
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

const PAGINATION = { page: 1, limit: 20, total: 1, totalPages: 1 };

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url, config) => {
        calls.push({ method: "GET", url, config });
        return {
          data: { data: { approvals: [APPROVAL], pagination: PAGINATION } },
        };
      },
      patch: async (url, payload) => {
        calls.push({ method: "PATCH", url, payload });
        return {
          data: {
            data: {
              approval: { ...APPROVAL, status: "APPROVED" },
            },
          },
        };
      },
    },
  },
});

const { bankTransferService } =
  await import("@/services/bank-transfer.service");

const BASE = "/api/v1/events/evt-1/bank-transfers";

// ---------------------------------------------------------------------------
// 一、清單：只送 status，其餘照 Web 的模板字串
// ---------------------------------------------------------------------------

test("listApprovals: GET /bank-transfers?status=PENDING，恰好一次", async () => {
  calls.length = 0;
  const res = await bankTransferService.listApprovals("evt-1", {
    status: "PENDING",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, `${BASE}?status=PENDING`);
  assert.deepEqual(res.pagination, PAGINATION);
  assert.equal(res.approvals.length, 1);
});

test("listApprovals: 沒有參數時查詢字串為空，但 `?` 仍在（照 Web 的形狀）", async () => {
  calls.length = 0;
  await bankTransferService.listApprovals("evt-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${BASE}?`);
});

test("listApprovals: 不自己補 page／limit（Web 的頁面只送 status）", async () => {
  calls.length = 0;
  await bankTransferService.listApprovals("evt-1", { status: "APPROVED" });

  const url = calls[0].url;
  assert.ok(!url.includes("page="), `不該出現 page，實際：${url}`);
  assert.ok(!url.includes("limit="), `不該出現 limit，實際：${url}`);
});

test("listApprovals: undefined 的參數整個不送（不會變成 status=undefined）", async () => {
  calls.length = 0;
  await bankTransferService.listApprovals("evt-1", {
    status: undefined,
    page: undefined,
  });

  assert.equal(calls[0].url, `${BASE}?`);
});

test("listApprovals: 呼叫端真的給了 page／limit 才透傳（與 Web lib 同構）", async () => {
  calls.length = 0;
  await bankTransferService.listApprovals("evt-1", {
    status: "REJECTED",
    page: 2,
    limit: 50,
  });

  assert.equal(calls[0].url, `${BASE}?status=REJECTED&page=2&limit=50`);
});

test("listApprovals: 金額與狀態原樣透傳（不做 Number／不做排序）", async () => {
  calls.length = 0;
  const res = await bankTransferService.listApprovals("evt-1", {
    status: "PENDING",
  });

  const approval = res.approvals[0];
  assert.equal(approval.amount, "1500.50");
  assert.equal(typeof approval.amount, "string");
  assert.equal(approval.status, "PENDING");
  assert.equal(approval.registration.registrationCode, "LKC-202611-AB12CD");
});

// ---------------------------------------------------------------------------
// 二、覆核：PATCH ＋ 條件式 reviewNote
// ---------------------------------------------------------------------------

test("review: 核可時 body 只有 decision（沒有 reviewNote 這個鍵）", async () => {
  calls.length = 0;
  const res = await bankTransferService.review("evt-1", "ap-1", "APPROVED");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, `${BASE}/ap-1/review`);
  assert.deepEqual(
    calls[0].payload,
    { decision: "APPROVED" },
    "後端 DTO 的 reviewNote 是 @IsOptional() @IsString()；送 undefined 以外的值都可能被打回",
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(calls[0].payload, "reviewNote"),
    "reviewNote 這個鍵不該存在（不是 null，也不是空字串）",
  );
  assert.equal(res.approval.status, "APPROVED");
});

test("review: 明確傳 undefined 與不傳等價", async () => {
  calls.length = 0;
  await bankTransferService.review("evt-1", "ap-1", "APPROVED", undefined);

  assert.deepEqual(calls[0].payload, { decision: "APPROVED" });
});

test("review: 退回時帶上原因（原樣透傳，不 trim、不改寫）", async () => {
  calls.length = 0;
  await bankTransferService.review(
    "evt-1",
    "ap-1",
    "REJECTED",
    "  匯款金額與報名金額不符  ",
  );

  assert.deepEqual(calls[0].payload, {
    decision: "REJECTED",
    reviewNote: "  匯款金額與報名金額不符  ",
  });
});

test("review: 退回時原因為空字串＝有送、但內容是空的（與 Web 的 prompt 空輸入一致）", async () => {
  calls.length = 0;
  await bankTransferService.review("evt-1", "ap-1", "REJECTED", "");

  assert.deepEqual(calls[0].payload, { decision: "REJECTED", reviewNote: "" });
});

test("review: 路徑參數有做 encode（approvalId 不是可以拼進 URL 的原始字串）", async () => {
  calls.length = 0;
  await bankTransferService.review("evt-1", "ap 1/2", "APPROVED");

  assert.equal(calls[0].url, `${BASE}/ap%201%2F2/review`);
});
