/**
 * 「建立活動」的**呼叫契約鎖**（method + path + 範圍）。
 *
 * ## 為什麼要另一份鎖
 * `tests/event-create-service.test.mjs` 測的是 `createEvent` 的**語意**
 * （body 怎麼組、信封怎麼解）。這一支只問兩件更窄的事：
 *
 * 1. **這條地址有沒有搬家**——`POST /api/v1/events`。`apiClient.post()` 的
 *    路徑只是一個字串，TypeScript 完全看不到。2026-10-22 的對等審計就是
 *    這樣發現 App 一直在打一條後端從來沒有的 `checkin/override`。
 *    `npm run check:contract` 驗「路徑存在於後端快照」，但它不驗呼叫端的
 *    寫法；這一支補上那一半。
 * 2. **表單頁只能呼叫這一支**。只釘一條指令還不夠——未來有人在
 *    `new-event.tsx` 加第二個寫入（例如建立時順手打 `/events/:id/publish`），
 *    上面那段仍然會綠。所以下面再靜態掃原始碼，斷言 `eventService.*` 的
 *    呼叫集合**恰好**是 `{ createEvent }`。要加新的寫入路徑，得先改這份清單。
 *
 * ## 為什麼「只能一次」也要鎖
 * Web 建立成功後只呼叫一次 `createEvent`，然後用**回傳的**活動去導頁。
 * 若哪天有人寫成「POST 之後再 GET 一次 by-id」，慢網路下就會出現舊資料
 * 覆蓋新資料（`event-update-service.test.mjs` 的檔頭記載過同一個坑）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mock, test } from "node:test";

// ---------------------------------------------------------------------------
// 一、行為鎖：攔 apiClient，看實際打出去的 method 與 URL
// ---------------------------------------------------------------------------

/** 每次呼叫的 (method, url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 後端建立成功回 201 與 `{ event }`；這支不關心活動內容。 */
const okResponse = () => ({
  data: {
    data: {
      event: {
        id: "evt-new",
        slug: "startup-fest-2027",
        name: "StartupFest 2027",
      },
    },
  },
});

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return okResponse();
      },
      post: async (url, body) => {
        calls.push({ method: "POST", url, body });
        return okResponse();
      },
      patch: async (url, body) => {
        calls.push({ method: "PATCH", url, body });
        return okResponse();
      },
    },
  },
});

const { eventService } = await import("@/services/event.service");

/** Web `CreateEventModal.handleSubmit` 送出的七個欄位。 */
const PAYLOAD = {
  name: "StartupFest 2027",
  slug: "startup-fest-2027",
  description: "年度新創展會",
  startDate: "2027-11-01T01:00:00.000Z",
  endDate: "2027-11-02T10:00:00.000Z",
  timezone: "Asia/Macau",
  eventType: "EXHIBITION",
};

test("createEvent: POST /api/v1/events（路徑與 method 都不得搬家）", async () => {
  calls.length = 0;
  await eventService.createEvent(PAYLOAD);

  assert.equal(calls.length, 1, "createEvent 應該恰好打一次");
  assert.equal(calls[0].method, "POST", "createEvent 的 method 變了");
  assert.equal(calls[0].url, "/api/v1/events", "createEvent 的路徑搬家了");
});

test("URL 帶版本前綴與 events 段（不是相對路徑、也沒有尾斜線）", async () => {
  calls.length = 0;
  await eventService.createEvent(PAYLOAD);

  assert.ok(
    calls[0].url.startsWith("/api/v1/events"),
    `URL 是 ${calls[0].url}`,
  );
  assert.equal(calls[0].url.endsWith("/"), false, "尾斜線會走到 404");
});

test("body 恰好是七個欄位（不多送、不改名）", async () => {
  calls.length = 0;
  await eventService.createEvent(PAYLOAD);

  assert.deepEqual(Object.keys(calls[0].body).sort(), [
    "description",
    "endDate",
    "eventType",
    "name",
    "slug",
    "startDate",
    "timezone",
  ]);
});

test("送的是欄位的原值，service 不加工（時間轉換是呼叫端的責任）", async () => {
  calls.length = 0;
  await eventService.createEvent(PAYLOAD);

  assert.equal(calls[0].body.startDate, PAYLOAD.startDate);
  assert.equal(calls[0].body.endDate, PAYLOAD.endDate);
});

test("成功後不會補一次 GET（後端已回整筆活動）", async () => {
  calls.length = 0;
  await eventService.createEvent(PAYLOAD);

  const nonPost = calls.filter((call) => call.method !== "POST");
  assert.deepEqual(
    nonPost,
    [],
    `不該有非 POST 的請求：${JSON.stringify(nonPost)}`,
  );
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：這一頁只能呼叫 createEvent
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const CREATE_PAGE = join(HERE, "..", "src", "app", "(auth)", "new-event.tsx");
const HOME_PAGE = join(HERE, "..", "src", "app", "(auth)", "home.tsx");

/** 從原始碼抓出 `eventService.<method>` 的方法名集合。 */
function eventServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/eventService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("建立活動頁對 eventService 的呼叫集合恰好是 createEvent", () => {
  assert.deepEqual(
    [...eventServiceMethodsIn(CREATE_PAGE)].sort(),
    ["createEvent"],
    "new-event.tsx 的 eventService 呼叫集合變了——新增寫入路徑請先更新這份清單",
  );
});

test("建立活動頁不直接拿 apiClient（一律走 service）", () => {
  const source = readFileSync(CREATE_PAGE, "utf8");
  assert.equal(
    /apiClient\./.test(source),
    false,
    "new-event.tsx 直接用了 apiClient——路徑就繞過了 check:contract 的快照",
  );
});

test("清單頁仍然不自己打後端（入口只導航，資料走 event.store）", () => {
  const source = readFileSync(HOME_PAGE, "utf8");
  assert.equal(
    /eventService\.|apiClient\./.test(source),
    false,
    "home.tsx 開始直接打 eventService／apiClient 了——這一輪的入口只負責導航",
  );
});
