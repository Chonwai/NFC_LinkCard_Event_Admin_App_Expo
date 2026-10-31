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

/** 下一次 `get` 要回什麼。 */
let nextGet = () => ({ data: { data: {} } });

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return nextGet();
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

// ---------------------------------------------------------------------------
// claim email（activation-link）—— 這一段的主軸是 `readonly=1`
// ---------------------------------------------------------------------------

/**
 * ⚠️ **這個 `?readonly=1` 是本輪最危險的一行。**
 *
 * 同一條 `GET …/activation-link` 的預設行為是「當場簽發一顆 activation token」。
 * 批次寄送面板要對整頁每一筆各打一次；少了 `readonly=1`，開一次面板就會把每個
 * `pending_claim` 變成 `has_token`，於是面板的預設收件人（有帳號、未 claim、
 * 無有效 token）在第二次開啟時歸零（`AA-F-01`）。
 *
 * 下面三條就是為了讓「有人把 `?readonly=1` 拿掉」立刻變紅——因為它拿掉之後
 * 其他任何測試都不會失敗，症狀只會在活動當天以「怎麼都沒有人被勾選」出現。
 */
test("getActivationLinkStatus 的 URL 一定帶 ?readonly=1（拿掉它會當場簽發 token）", async () => {
  calls.length = 0;
  nextGet = () => ({
    data: {
      data: {
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        isActivated: false,
        userId: "u-1",
        activationToken: null,
        activationUrl: null,
        issued: false,
      },
    },
  });

  await registrationService.getActivationLinkStatus("evt-1", "reg-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt-1/registrations/reg-1/activation-link?readonly=1",
  );
  assert.ok(
    calls[0].url.endsWith("?readonly=1"),
    `尾端必須剛好是 ?readonly=1（BE 只認字串 '1'）：${calls[0].url}`,
  );
});

test("getActivationLinkStatus 沒有參數可以傳錯（唯讀是唯一的呼叫形狀）", () => {
  // 簽章長度＝(eventId, registrationId)。多一個 boolean 就等於給了下一個人
  // 一個「傳 false」的機會，而那條路正好是會簽發 token 的那條。
  assert.equal(registrationService.getActivationLinkStatus.length, 2);
});

test("getActivationLinkStatus 原樣回傳狀態（含既有 token，故 has_token 判定仍成立）", async () => {
  calls.length = 0;
  nextGet = () => ({
    data: {
      data: {
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        isActivated: false,
        userId: "u-1",
        activationToken: "tok-existing",
        activationUrl: "/events/activation/claim?token=tok-existing",
        issued: false,
      },
    },
  });

  const info = await registrationService.getActivationLinkStatus(
    "evt-1",
    "reg-1",
  );

  assert.equal(info.activationToken, "tok-existing");
  assert.equal(info.issued, false);
});

test("resendActivationEmail POST 到同一條 path（GET 讀狀態、POST 寄信）且不帶 body", async () => {
  calls.length = 0;
  nextPost = () => ({
    data: {
      data: {
        email: "a@b.com",
        activationEmailSentAt: "2026-11-01T00:00:00.000Z",
      },
    },
  });

  const result = await registrationService.resendActivationEmail(
    "evt 1",
    "reg 2",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt%201/registrations/reg%202/activation-link",
  );
  assert.equal(calls[0].body, undefined);
  assert.equal(result.activationEmailSentAt, "2026-11-01T00:00:00.000Z");
});
