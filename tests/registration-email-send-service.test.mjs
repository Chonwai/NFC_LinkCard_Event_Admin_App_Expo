/**
 * 「寄信」相關呼叫的 **wire 契約**鎖定（重寄確認信）。
 *
 * 為什麼需要它：`apiClient.post()` 的 path 只是字串，TypeScript 無從得知那條
 * 路由是否存在。2026-10-22 的對等審計就是在這個縫隙裡發現 App 一直在呼叫
 * 一條後端從來沒有的路由（`checkin/override`）。寄信這類動作更糟：
 * 打錯路徑不會有人看到錯誤，只會「什麼都沒發生」。
 *
 * 對應後端（`BE:src/events/routes/registrations.routes.ts:160-164`）：
 *   POST /:registrationId/resend-confirmation  ← 無 body
 *
 * 只 mock `@/services/api`。`registration.service.ts` 對 `@/types/api.types`
 * 是 `import type`（編譯期抹除），純 Node 不需要載入型別模組。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 下一次 `post` 要回什麼。 */
let nextPost = () => ({ data: { data: {} } });

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return { data: { data: {} } };
      },
      post: async (url, body) => {
        calls.push({ method: "POST", url, body });
        return nextPost();
      },
    },
  },
});

const { registrationService } = await import("@/services/registration.service");

test("resendConfirmation POST 到 /registrations/:id/resend-confirmation（兩個 id 都需 encode）", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: { data: { outboxId: "ob-1", created: true, email: "a@b.com" } },
  });

  await registrationService.resendConfirmation("evt 1/2", "reg 3/4");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt%201%2F2/registrations/reg%203%2F4/resend-confirmation",
  );
});

test("resendConfirmation 不帶 body（後端沒有 DTO 可收；多送只會讓人猜它收什麼）", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: { data: { outboxId: "ob-1", created: false, email: "a@b.com" } },
  });

  await registrationService.resendConfirmation("evt-1", "reg-1");

  assert.equal(calls[0].body, undefined);
});

test("resendConfirmation 原樣回傳後端結果（只保證已排入佇列，不是已寄出）", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: { data: { outboxId: "ob-9", created: true, email: "a@b.com" } },
  });

  const result = await registrationService.resendConfirmation("evt-1", "reg-9");

  assert.deepEqual(result, {
    outboxId: "ob-9",
    created: true,
    email: "a@b.com",
  });
});
