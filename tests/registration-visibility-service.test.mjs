/**
 * `registrationService.hide` / `.unhide` 的 **wire 契約**鎖定。
 *
 * 為什麼需要它：這兩條端點是 2026-10-29 產品決定（全面功能對齊）之後才接到
 * App 的，對應 Web `lib/events/registrations.ts` 的 `hideRegistration` /
 * `unhideRegistration`。TypeScript 抓不到網址字串寫錯——`apiClient.post()`
 * 的 path 只是字串，型別系統無從得知它是否存在。2026-10-22 的對等審計就是在
 * 這種縫隙裡發現 App 一直在呼叫一條後端從來沒有的路由。
 *
 * 對應後端（`BE:src/events/routes/registrations.routes.ts:168-169`）：
 *   POST /:registrationId/hide   ← `{ reason }`（trim 後寫入稽核）
 *   POST /:registrationId/unhide ← 無 body
 *
 * 只 mock `@/services/api`。`registration.service.ts` 對 `@/types/api.types`
 * 是 `import type`（編譯期抹除），純 Node 不需要載入型別模組。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 下一次 `post` 要回什麼；測試用它模擬成功／失敗。 */
let nextPost = () => ({
  data: { data: { registration: { id: "reg-1" } } },
});

/** 下一次 `get` 要回什麼。 */
let nextGet = () => ({ data: { data: {} } });

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ url, body: undefined });
        return nextGet();
      },
      post: async (url, body) => {
        calls.push({ url, body });
        return nextPost();
      },
    },
  },
});

const { registrationService } = await import("@/services/registration.service");

test("hide POST 到 /registrations/:id/hide（eventId 與 registrationId 都需 URL-encode）", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.hide("evt 1/2", "reg 3/4", "重複報名");

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt%201%2F2/registrations/reg%203%2F4/hide",
  );
});

test("hide 的 body 逐字為 BE 契約：{ reason }，不多不少", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.hide("evt-1", "reg-1", "重複報名");

  assert.deepEqual(calls[0].body, { reason: "重複報名" });
});

test("hide 回傳後端附掛的 registration 本體（呼叫端靠它同步畫面）", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: { data: { registration: { id: "reg-9", isHidden: true } } },
  });

  const result = await registrationService.hide("evt-1", "reg-9", "測試資料");

  assert.equal(result.registration.id, "reg-9");
  assert.equal(result.registration.isHidden, true);
});

test("unhide POST 到 /registrations/:id/unhide，且不帶 body", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.unhide("evt-1", "reg-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/v1/events/evt-1/registrations/reg-1/unhide");
  // 後端不需要理由；送空物件會讓「這條端點收什麼」變得含糊。
  assert.equal(calls[0].body, undefined);
});

test("後端錯誤往上拋（403 由呼叫端轉成權限文案，這裡不吞）", async () => {
  calls.length = 0;
  nextPost = () => {
    const err = new Error("forbidden");
    err.response = {
      status: 403,
      data: { error: { code: "INSUFFICIENT_PERMISSION" } },
    };
    throw err;
  };

  await assert.rejects(
    () => registrationService.hide("evt-1", "reg-1", "原因"),
    (err) => err.response?.status === 403,
  );
});

test("archive POST 到 /registrations/:id/archive，body 為 { reason }", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.archive("evt-1", "reg-1", "重複報名");

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt-1/registrations/reg-1/archive",
  );
  assert.deepEqual(calls[0].body, { reason: "重複報名" });
});

test("unarchive POST 到 /registrations/:id/unarchive，且不帶 body", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.unarchive("evt 1/2", "reg 3/4");

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt%201%2F2/registrations/reg%203%2F4/unarchive",
  );
  assert.equal(calls[0].body, undefined);
});

test("updateStatus POST 到 /registrations/:id/status，body 為 { targetStatus, reason }", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: { data: { registration: { id: "reg-1", status: "CHECKED_IN" } } },
  });

  await registrationService.updateStatus("evt-1", "reg-1", {
    targetStatus: "CHECKED_IN",
    reason: "現場人工報到",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/v1/events/evt-1/registrations/reg-1/status");
  assert.deepEqual(calls[0].body, {
    targetStatus: "CHECKED_IN",
    reason: "現場人工報到",
  });
});

test("updateStatus 回傳的是白名單 6 欄，不是整筆 registration", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: {
      data: {
        registration: {
          id: "reg-1",
          registrationCode: "ABC123",
          status: "CONFIRMED",
          checkedInAt: null,
          checkedInBy: null,
          updatedAt: "2026-11-01T00:00:00.000Z",
        },
      },
    },
  });

  const { registration } = await registrationService.updateStatus(
    "evt-1",
    "reg-1",
    { targetStatus: "CONFIRMED", reason: "撤銷誤掃" },
  );

  assert.deepEqual(Object.keys(registration).sort(), [
    "checkedInAt",
    "checkedInBy",
    "id",
    "registrationCode",
    "status",
    "updatedAt",
  ]);
});

test("markDepositRefund POST 到 /registrations/:id/deposit-refund，body 為 { amount, reference, note }", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.markDepositRefund("evt-1", "reg-1", {
    amount: 500,
    reference: "TX-1",
    note: "銀行轉賬退回",
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt-1/registrations/reg-1/deposit-refund",
  );
  assert.deepEqual(calls[0].body, {
    amount: 500,
    reference: "TX-1",
    note: "銀行轉賬退回",
  });
});

test("markDepositRefund 只帶 amount 時不硬塞空字串（BE 的 optional 欄位）", async () => {
  calls.length = 0;
  nextPost = () => ({ data: { data: { registration: { id: "reg-1" } } } });

  await registrationService.markDepositRefund("evt-1", "reg-1", {
    amount: 0.01,
  });

  assert.deepEqual(calls[0].body, { amount: 0.01 });
});

test("exportAttendeesCsv GET /events/:eventId/export/attendees 並回傳 csv 字串", async () => {
  calls.length = 0;
  // 這支走 apiClient.get，不是 post。
  nextGet = () => ({ data: { data: { csv: "name,email\nA,a@x.com" } } });

  const csv = await registrationService.exportAttendeesCsv("evt 1/2");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/v1/events/evt%201%2F2/export/attendees");
  assert.equal(csv, "name,email\nA,a@x.com");
});
