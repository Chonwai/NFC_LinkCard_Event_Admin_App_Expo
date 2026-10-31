/**
 * 「活動資料」與「活動設定」兩頁的**呼叫契約鎖**（method + path）。
 *
 * ## 為什麼要另一份鎖
 * `tests/event-update-service.test.mjs` 測的是 `updateEvent` 的**語意**
 * （body 形狀、`null` 而不是 `""`、信封怎麼解）。這一支只問一件更窄的事：
 * **「這兩條地址有沒有搬家」**。兩者失敗訊息不同：前者說「body 不對」，
 * 後者說「App 開始打一條後端沒有的路」。
 *
 * 為什麼值得單獨釘：`apiClient.patch()` 的路徑只是字串，TypeScript 完全看不到。
 * 2026-10-22 的對等審計就是這樣發現 App 一直在打 `checkin/override`
 * ——一條後端從來沒有的路由，而且只有活動當天才會炸。
 * `npm run check:contract` 驗「路徑存在於後端快照」，但它不驗呼叫端的寫法；
 * 這一支補上那一半。
 *
 * ## 後半段是「範圍鎖」
 * 只釘兩條指令還不夠——未來有人在這些頁面加第三條 `/events/:id/archive`，
 * 上面那段仍然會綠。所以下面再靜態掃兩頁的原始碼，斷言 `eventService.*` 的
 * 呼叫集合**恰好**是這兩個方法。要加新的寫入路徑，就得先改這份清單。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mock, test } from "node:test";

// ---------------------------------------------------------------------------
// 一、行為鎖：攔 apiClient，看實際打出去的 method 與 URL
// ---------------------------------------------------------------------------

/** 每次呼叫的 (method, url) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 一律回一個形狀齊全的成功 envelope；這支不關心語意。 */
const okResponse = () => ({
  data: {
    data: {
      event: { id: "evt-1", slug: "startup-fest", name: "Startup Fest" },
    },
  },
});

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url });
        return okResponse();
      },
      post: async (url) => {
        calls.push({ method: "POST", url });
        return okResponse();
      },
      patch: async (url) => {
        calls.push({ method: "PATCH", url });
        return okResponse();
      },
    },
  },
});

const { eventService } = await import("@/services/event.service");

/**
 * 本批新增／新用到的呼叫。`{eventId}` 代表活動 id（路徑相對於
 * `/api/v1/events/`）。
 */
const EXPECTED = [
  {
    name: "getEventById",
    method: "GET",
    path: "by-id/{eventId}",
    invoke: () => eventService.getEventById("evt-1"),
  },
  {
    name: "updateEvent",
    method: "PATCH",
    path: "{eventId}",
    invoke: () => eventService.updateEvent("evt-1", { name: "新名稱" }),
  },
];

for (const expected of EXPECTED) {
  test(`${expected.name}: ${expected.method} /api/v1/events/${expected.path}`, async () => {
    calls.length = 0;
    await expected.invoke();

    assert.equal(calls.length, 1, `${expected.name} 應該恰好打一次`);
    assert.equal(
      calls[0].method,
      expected.method,
      `${expected.name} 的 method 變了`,
    );

    const relative = calls[0].url.replace(/^\/api\/v1\/events\//, "");
    const wanted = expected.path.replace("{eventId}", "evt-1");
    assert.equal(relative, wanted, `${expected.name} 的路徑搬家了`);
  });
}

test("兩條呼叫都落在 /api/v1/events/ 之下（沒有掉版本前綴或 events 段）", async () => {
  for (const expected of EXPECTED) {
    calls.length = 0;
    await expected.invoke();
    assert.ok(
      calls[0].url.startsWith("/api/v1/events/"),
      `${expected.name} 的 URL 是 ${calls[0].url}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：兩頁只能呼叫這兩個 service 方法
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const EVENT_PAGES = [
  join(HERE, "..", "src", "app", "(auth)", "[eventId]", "profile.tsx"),
  join(HERE, "..", "src", "app", "(auth)", "[eventId]", "settings.tsx"),
];

/** 從原始碼抓出 `eventService.<method>` 的方法名集合。 */
function eventServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/eventService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("兩頁對 eventService 的呼叫集合恰好是 getEventById + updateEvent", () => {
  const allowed = new Set(["getEventById", "updateEvent"]);

  for (const filePath of EVENT_PAGES) {
    const found = eventServiceMethodsIn(filePath);
    assert.deepEqual(
      [...found].sort(),
      [...allowed].sort(),
      `${filePath} 的 eventService 呼叫集合變了——新增寫入路徑請先更新這份清單`,
    );
  }
});

test("兩頁都只透過 eventService 打後端，沒有直接拿 apiClient", () => {
  for (const filePath of EVENT_PAGES) {
    const source = readFileSync(filePath, "utf8");
    assert.equal(
      /apiClient\./.test(source),
      false,
      `${filePath} 直接用了 apiClient，繞過了 service 層的契約`,
    );
  }
});
