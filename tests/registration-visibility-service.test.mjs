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

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ url, body: undefined });
        return { data: { data: {} } };
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
