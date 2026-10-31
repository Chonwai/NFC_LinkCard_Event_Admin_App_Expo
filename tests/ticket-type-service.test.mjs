/**
 * `ticketTypeService` 的**語意測試**（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 *
 * 票種這四支呼叫有兩個「TypeScript 看不到」的坑：
 *
 * 1. **列表絕對不能帶 `limit`**。`exhibitors` 那邊的教訓是相反的——後端預設
 *    20 會靜默截斷，所以每次都要帶滿。票種**沒有分頁**（後端是 `findMany`，
 *    無 `take`/`skip`，回應也沒有 `pagination`）。在這裡多帶一個 `limit`，
 *    TypeScript 不會紅、後端也不會壞，但下一個人會以為「這裡有分頁而且我們
 *    處理了」。所以反向釘住：第二個參數必須是 `undefined`。
 * 2. **`deactivateTicketType` 是有 body 的回應**。Web 宣告 `Promise<void>`，
 *    但那只是把它丟掉。若有人照 Web 的型別改回來，畫面就得自己猜停用後的
 *    狀態。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是 `tests/ticket-type-contract.test.mjs`
 *   與全域 `npm run check:contract` 的事。
 * - **不驗** payload 的欄位集合——那是 `tests/ticket-type-payload.test.mjs`
 *   （畫面層）的事。這裡只驗「service 原樣透傳，沒有偷偷加減」。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, payload, config) 都記在這裡，供斷言觀察。 */
const calls = [];

const TICKET = {
  id: "tt-1",
  eventId: "evt-1",
  name: "standard",
  displayName: "標準票",
  description: null,
  // Decimal 序列化後是字串——不是 number，也不是「分」。
  price: "1500.50",
  currency: "MOP",
  capacity: null,
  soldCount: 7,
  registrantType: "ATTENDEE",
  formFieldsJson: { fields: [] },
  isHidden: false,
  initialTokens: 0,
  allowedPaymentMethods: ["FREE"],
  isActive: true,
  capabilities: ["EXHIBITOR_DIRECTORY", "WALLET"],
  capabilitiesOverride: null,
  accessCode: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url, config) => {
        calls.push({ method: "GET", url, config });
        return { data: { data: { ticketTypes: [TICKET] } } };
      },
      post: async (url, payload) => {
        calls.push({ method: "POST", url, payload });
        return { data: { data: { ticketType: TICKET } } };
      },
      patch: async (url, payload) => {
        calls.push({ method: "PATCH", url, payload });
        return { data: { data: { ticketType: TICKET } } };
      },
      delete: async (url) => {
        calls.push({ method: "DELETE", url });
        return {
          data: { data: { ticketType: { ...TICKET, isActive: false } } },
        };
      },
    },
  },
});

const { ticketTypeService } = await import("@/services/ticket-type.service");

const BASE = "/api/v1/events/evt-1/ticket-types";

// ---------------------------------------------------------------------------
// 一、方法、路徑與 payload（每支都恰好打一次）
// ---------------------------------------------------------------------------

test("listAdminTicketTypes: GET /ticket-types，且**不帶** params（這條沒有分頁）", async () => {
  calls.length = 0;
  const res = await ticketTypeService.listAdminTicketTypes("evt-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, BASE);
  assert.equal(
    calls[0].config,
    undefined,
    "這條端點沒有分頁；帶 limit/page 會讓人以為有，而後端根本不讀",
  );
  assert.equal(res.ticketTypes.length, 1);
  assert.equal(res.ticketTypes[0].id, "tt-1");
});

test("listAdminTicketTypes: 原樣透出 price 字串，不做「元→分」換算", async () => {
  calls.length = 0;
  const res = await ticketTypeService.listAdminTicketTypes("evt-1");

  // 後端 Decimal(10,2) 序列化就是這個字串。任何數字化／乘 100 都是 App 自己
  // 發明的語意，會讓畫面顯示與 DB 不一致。
  assert.equal(res.ticketTypes[0].price, "1500.50");
  assert.equal(typeof res.ticketTypes[0].price, "string");
});

test("createTicketType: POST /ticket-types，payload 原樣透傳", async () => {
  calls.length = 0;
  const payload = { name: "standard", displayName: "標準票", price: "0" };
  await ticketTypeService.createTicketType("evt-1", payload);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, BASE);
  assert.equal(
    calls[0].payload,
    payload,
    "service 不得自行增刪欄位——欄位集合由畫面決定並在 payload 測試裡釘住",
  );
});

test("updateTicketType: PATCH /ticket-types/:id，payload 原樣透傳", async () => {
  calls.length = 0;
  const payload = { displayName: "改名" };
  await ticketTypeService.updateTicketType("evt-1", "tt-1", payload);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, `${BASE}/tt-1`);
  assert.equal(calls[0].payload, payload);
});

test("deactivateTicketType: DELETE /ticket-types/:id，且回傳停用後的票種", async () => {
  calls.length = 0;
  const res = await ticketTypeService.deactivateTicketType("evt-1", "tt-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, `${BASE}/tt-1`);
  // 後端回的是 { ticketType }，不是 204 空 body。宣告 void 會讓下一個人
  // 以為這條沒有回應。
  assert.equal(res.ticketType.isActive, false);
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：恰好四支，不多不少
// ---------------------------------------------------------------------------

test("四支呼叫都存在，而且只有四支", () => {
  const names = Object.keys(ticketTypeService).sort();
  assert.deepEqual(names, [
    "createTicketType",
    "deactivateTicketType",
    "listAdminTicketTypes",
    "updateTicketType",
  ]);
});

// ---------------------------------------------------------------------------
// 三、路徑組裝：eventId／ticketTypeId 必須被 encode
// ---------------------------------------------------------------------------

test("路徑參數有 encode——id 含斜線時不會多開一層路徑", async () => {
  calls.length = 0;
  await ticketTypeService.updateTicketType("evt/1", "tt/1", {});

  assert.equal(calls[0].url, "/api/v1/events/evt%2F1/ticket-types/tt%2F1");
});
