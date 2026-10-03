/**
 * `nfcService.recordExchange` 的 **wire 契約**鎖定（Loop AB · WP-20）。
 *
 * 這一支存在的理由與 `FE:__tests__/events/nfc.test.ts` 的 `recordNfcExchange` 段相同：
 * 交換端點的欄名漂移（`initiatorTagUid` vs `initiatorUid`，`R-DK-01`）在整個系統裡
 * 存活了很久，因為**沒有任何一處觀察得到送出去的 body**。ADM 這邊補上同一個觀察點。
 *
 * 只 mock `@/services/api`（axios 實例）。`nfc.service.ts` 對 `@/types/api.types`
 * 是 `import type`（編譯期抹除），所以純 Node 不需要載入型別模組。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ url, body: undefined });
        return { data: { data: {} } };
      },
      post: async (url, body) => {
        calls.push({ url, body });
        return {
          data: { data: { alreadyExchanged: false, contactsExchanged: 2 } },
        };
      },
    },
  },
});

const { nfcService } = await import("@/services/nfc.service");

test("POST 到 /api/v1/events/:eventId/nfc/exchange（eventId 需 URL-encode）", async () => {
  calls.length = 0;
  await nfcService.recordExchange("evt 1/2", {
    initiatorUid: "uid-A",
    receiverUid: "uid-B",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/v1/events/evt%201%2F2/nfc/exchange");
});

test("body 欄名逐字為 BE DTO 契約：initiatorUid / receiverUid / exchangeType", async () => {
  calls.length = 0;
  await nfcService.recordExchange("evt-1", {
    initiatorUid: "uid-A",
    receiverUid: "uid-B",
    exchangeType: "PEER_TO_PEER",
  });

  const { body } = calls[0];
  assert.equal(body.initiatorUid, "uid-A");
  assert.equal(body.receiverUid, "uid-B");
  assert.equal(body.exchangeType, "PEER_TO_PEER");
  assert.deepEqual(Object.keys(body).sort(), [
    "exchangeType",
    "initiatorUid",
    "receiverUid",
  ]);
});

test("body 不得含 WP-19 之前的舊欄名（initiatorTagUid / receiverTagUid）", async () => {
  // 舊欄名在 `forbidNonWhitelisted` 之後會被 422 指名拒絕；這裡把它擋在更前面。
  calls.length = 0;
  await nfcService.recordExchange("evt-1", {
    initiatorUid: "uid-A",
    receiverUid: "uid-B",
  });

  const { body } = calls[0];
  assert.equal(Object.hasOwn(body, "initiatorTagUid"), false);
  assert.equal(Object.hasOwn(body, "receiverTagUid"), false);
});

test("exchangeType 未指定時不得自行補預設值（預設在後端，前端不猜）", async () => {
  calls.length = 0;
  await nfcService.recordExchange("evt-1", {
    initiatorUid: "uid-A",
    receiverUid: "uid-B",
  });

  assert.equal(Object.hasOwn(calls[0].body, "exchangeType"), false);
});

test("回傳值為 envelope 內層 data（兩個成功分支的形狀原樣透出）", async () => {
  calls.length = 0;
  const result = await nfcService.recordExchange("evt-1", {
    initiatorUid: "uid-A",
    receiverUid: "uid-B",
  });

  assert.equal(result.alreadyExchanged, false);
  assert.equal(result.contactsExchanged, 2);
});
