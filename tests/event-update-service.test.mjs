/**
 * `eventService.updateEvent` 的語意測試（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 * 這條 PATCH 是「活動資料」與「活動設定」兩頁唯一的寫入路徑（Web 也是同一條
 * `updateEvent`）。它有三個容易靜默出錯的地方，而且**都不會被 TypeScript 抓到**：
 *
 * 1. **`null` vs `""`**：後端 `UpdateEventDto.externalLandingUrl` 是 `@IsUrl()`，
 *    送空字串會被 class-validator 擋成 400；送 `null` 則被 `@IsOptional()` 跳過。
 *    所以「使用者清空欄位」必須送 `null`。這支把該規則釘在 service 邊界上。
 * 2. **信封解包**：回傳是 `{ data: { data: { event } } }`，少解一層就會拿到
 *    `undefined`，畫面會變成空白表單而不是報錯。
 * 3. **只打一次**：曾經有「先 PATCH 再補一次 GET」的寫法，導致慢網路下舊資料
 *    覆蓋新資料。後端回傳整筆活動，不該再補 GET。
 *
 * 路徑與 method 的契約另有 `tests/profile-settings-contract.test.mjs` 專門釘；
 * 這一支管語意。兩支都要綠才算完整。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/**
 * 一律回一筆「什麼欄位都有」的活動。這支測試不關心回傳語意，只關心
 * 「有沒有原樣把 `event` 交出去」。
 */
const UPDATE_RESULT = {
  id: "evt-1",
  slug: "startup-fest",
  name: "新名稱",
  description: null,
  eventType: "EXHIBITION",
  status: "PUBLISHED",
  landingPageMode: "BUILT_IN",
  externalLandingUrl: null,
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-11-02T00:00:00.000Z",
  venueName: null,
  venueAddress: null,
  isPublic: true,
  configJson: null,
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      // 只要有任何非 PATCH 的呼叫，就讓測試以「多打了不該打的請求」失敗，
      // 而不是靜默通過。
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return { data: { data: {} } };
      },
      post: async (url) => {
        calls.push({ method: "POST", url, body: undefined });
        return { data: { data: {} } };
      },
      patch: async (url, body) => {
        calls.push({ method: "PATCH", url, body });
        return { data: { data: { event: UPDATE_RESULT } } };
      },
    },
  },
});

const { eventService } = await import("@/services/event.service");

/** Web `profile/page.tsx` 送出的九個欄位（清空者為 `null`）。 */
const PROFILE_PAYLOAD = {
  name: "新名稱",
  description: null,
  eventType: "EXHIBITION",
  status: "PUBLISHED",
  venueName: null,
  venueAddress: null,
  isPublic: true,
  landingPageMode: "BUILT_IN",
  externalLandingUrl: null,
};

test("updateEvent 只打一次 PATCH，且路徑是 /api/v1/events/{eventId}", async () => {
  calls.length = 0;
  await eventService.updateEvent("evt-1", PROFILE_PAYLOAD);

  assert.equal(calls.length, 1, "updateEvent 應該恰好打一次（不得補一次 GET）");
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, "/api/v1/events/evt-1");
});

test("updateEvent 把 payload 原樣送出（含以 null 表示清空）", async () => {
  calls.length = 0;
  await eventService.updateEvent("evt-1", PROFILE_PAYLOAD);

  assert.deepEqual(calls[0].body, PROFILE_PAYLOAD);
});

test("updateEvent 不會把清空欄位轉成空字串（後端 @IsUrl() 會擋）", async () => {
  calls.length = 0;
  await eventService.updateEvent("evt-1", PROFILE_PAYLOAD);

  const body = calls[0].body;
  for (const key of [
    "description",
    "venueName",
    "venueAddress",
    "externalLandingUrl",
  ]) {
    assert.equal(body[key], null, `${key} 清空時必須是 null，不是 ""`);
    assert.notEqual(body[key], "");
  }
});

test("updateEvent 解開 envelopes，回傳 data.data.event", async () => {
  calls.length = 0;
  const result = await eventService.updateEvent("evt-1", PROFILE_PAYLOAD);

  assert.deepEqual(result.event, UPDATE_RESULT);
});

test("updateEvent 對 eventId 做 URL 編碼（slug 含空格或非 ASCII 時不留破口）", async () => {
  calls.length = 0;
  await eventService.updateEvent("startup fest 2026", PROFILE_PAYLOAD);

  assert.equal(calls[0].url, "/api/v1/events/startup%20fest%202026");
});

test("updateEvent 支援 configJson（活動設定兩頁走同一條路由）", async () => {
  calls.length = 0;
  const payload = {
    configJson: { bankDetails: { accountName: "LinkCard Ltd" } },
  };
  await eventService.updateEvent("evt-1", payload);

  assert.deepEqual(calls[0].body, payload);
  assert.equal(calls[0].method, "PATCH");
});
