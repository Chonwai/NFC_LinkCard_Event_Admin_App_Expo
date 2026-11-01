/**
 * `eventService.createEvent` 的語意測試。
 *
 * ## 為什麼要這一支
 * App 在此之前**沒有任何建立活動的呼叫**（`event.service.ts` 只有 6 個 GET +
 * 1 個 PATCH）。新補的這條 POST 有三個容易靜默出錯的地方，而且
 * **TypeScript 全都抓不到**——`apiClient.post()` 的網址只是一個字串：
 *
 * 1. **路徑**：Web 在 `eventFetch` 內以 `/` 為相對於 events 根的路徑
 *    （`lib/events/events.ts:48`）。若這裡寫成 `/api/v1/events/`（尾斜線）或
 *    漏掉版本前綴，後端會 404，而型別系統不會有任何意見。
 * 2. **信封解包**：回傳是 `{ data: { data: { event } } }`，少解一層就拿到
 *    `undefined`，畫面會停在表單而不報錯。
 * 3. **時間欄位必須是 ISO 字串**：後端 `CreateEventDto` 是
 *    `@IsDateString()`。若把使用者在 App 打的 `"2026-11-05 09:00"` 原樣送出，
 *    後端回 400。這一支因此把「service 只負責轉發，時間的轉換與驗證都是
 *    呼叫端的責任」釘在邊界上。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 後端建立成功回 201 與整筆活動；這支不關心活動內容，只關心有沒有原樣交出。 */
const CREATE_RESULT = {
  id: "evt-new",
  slug: "startup-fest-2027",
  name: "StartupFest 2027",
  description: null,
  eventType: "EXHIBITION",
  status: "DRAFT",
  landingPageMode: "BUILT_IN",
  externalLandingUrl: null,
  startDate: "2027-11-01T01:00:00.000Z",
  endDate: "2027-11-02T01:00:00.000Z",
  timezone: "Asia/Macau",
  venueName: null,
  venueAddress: null,
  isPublic: true,
  configJson: null,
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      // 任何非 POST 的呼叫都記錄下來，讓「多打了不該打的請求」變成可見的失敗，
      // 而不是靜默通過。
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return { data: { data: {} } };
      },
      post: async (url, body) => {
        calls.push({ method: "POST", url, body });
        return { data: { data: { event: CREATE_RESULT } } };
      },
      patch: async (url, body) => {
        calls.push({ method: "PATCH", url, body });
        return { data: { data: {} } };
      },
    },
  },
});

const { eventService } = await import("@/services/event.service");

/** Web `CreateEventModal.handleSubmit` 送出的七個欄位（`events/page.tsx:79-87`）。 */
const CREATE_PAYLOAD = {
  name: "StartupFest 2027",
  slug: "startup-fest-2027",
  description: "年度新創展會",
  startDate: "2027-11-01T01:00:00.000Z",
  endDate: "2027-11-02T01:00:00.000Z",
  timezone: "Asia/Macau",
  eventType: "EXHIBITION",
};

test("createEvent 只打一次 POST，且路徑是 /api/v1/events", async () => {
  calls.length = 0;
  await eventService.createEvent(CREATE_PAYLOAD);

  assert.equal(calls.length, 1, "createEvent 應該恰好打一次（不得補一次 GET）");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "/api/v1/events");
});

test("createEvent 把 payload 原樣送出（不偷偷補欄位、不改名）", async () => {
  calls.length = 0;
  await eventService.createEvent(CREATE_PAYLOAD);

  assert.deepEqual(calls[0].body, CREATE_PAYLOAD);
});

test("createEvent 解開 envelopes，回傳 data.data.event", async () => {
  calls.length = 0;
  const result = await eventService.createEvent(CREATE_PAYLOAD);

  assert.deepEqual(result.event, CREATE_RESULT);
});

test("createEvent 不會替呼叫端補上缺席的欄位", async () => {
  // 這一條守的是「service 不做驗證、不做預設值」這個邊界。
  // 若哪天有人在 service 裡塞了 `startDate ?? new Date()` 之類的預設值，
  // 使用者按下去就會建立出一個日期不是他打的那個活動。
  calls.length = 0;
  const minimal = {
    name: "A",
    slug: "a",
    startDate: "2027-11-01T00:00:00.000Z",
    endDate: "2027-11-02T00:00:00.000Z",
  };
  await eventService.createEvent(minimal);

  assert.deepEqual(calls[0].body, minimal);
});
