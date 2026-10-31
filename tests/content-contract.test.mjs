/**
 * 落地頁內容（`content`）的**呼叫契約鎖**：method + path 逐條釘住。
 *
 * ## 為什麼要另一份鎖
 * `tests/content-service.test.mjs` 測的是**語意**（body 形狀、信封怎麼解、
 * 哪幾個欄位不能出現）。這一支只問兩件更窄的事：
 *
 * 1. **地址沒搬家**：七條呼叫的 (method, 路徑形狀) 是否還對得上
 *    `scripts/backend-routes.snapshot.json` 裡後端真的有的路由。
 * 2. **守備範圍沒破洞**：`content.tsx` 這頁能用的 service 方法**恰好**是那七個。
 *
 * 兩者失敗訊息不同：前者說「App 開始打一條後端沒有的路」，
 * 後者說「這一頁多了一條沒有人 review 過的寫入路徑」。
 *
 * ## 為什麼第 2 點值得單獨釘
 * 全域閘門 `npm run check:contract` 驗的是「`src/services/` 裡每一條呼叫都存在
 * 於後端快照」。它有一個盲點：**它不會紅在「多呼叫了什麼」**，只會紅在
 * 「呼叫了不存在的東西」。有人在這一頁加一條 `PATCH …/page-sections/reorder`
 * （後端真的有這條，只是 Web 這頁沒用），全域閘門照樣是綠的。
 * 那個 reorder 端點確實存在——但它不屬於 `content` 這個能力，
 * 加進來就是「比 Web 多一個功能」。所以這裡把範圍鎖在七條。
 *
 * 背景：2026-10-22 的對等審計發現 App 一直在打 `checkin/override` 這條後端
 * 從來沒有的路由，而 `tsc` 與當時全部測試都是綠的（`apiClient` 的網址只是
 * 字串，型別系統看不到）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { describeAppCall, extractAppCalls, pathShape } =
  await import("../scripts/check-backend-contract.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = JSON.parse(
  readFileSync(
    join(HERE, "..", "scripts", "backend-routes.snapshot.json"),
    "utf8",
  ),
);

/** 後端快照裡所有 events 路由的形狀鍵（`METHOD 路徑形狀`）。 */
const BACKEND_KEYS = new Set(
  SNAPSHOT.eventRoutes.map(
    (route) => `${route.method} ${pathShape(route.path).join("/")}`,
  ),
);

/**
 * 七條呼叫的期望形狀。`*` 代表路徑參數（eventId／sectionId／cardId）。
 *
 * 這七條 = 1 讀 6 寫，與 `LinkCard_Frontend/lib/events/page-content.ts` 的事件層
 * 呼叫一一對應。**它們是這個能力的全部**；不是這個清單裡的，就不屬於這裡。
 */
const EXPECTED = [
  "GET */page-sections",
  "POST */page-sections",
  "PATCH */page-sections/*",
  "DELETE */page-sections/*",
  "POST */page-sections/*/cards",
  "PATCH */page-sections/*/cards/*",
  "DELETE */page-sections/*/cards/*",
];

function callShape(call) {
  const described = describeAppCall(call.raw);
  assert.ok(
    described != null,
    `${call.method} ${call.raw} 的基底不在契約閘門的守備範圍`,
  );
  assert.equal(
    described.scope,
    "event",
    `${call.method} ${call.raw} 不在 /api/v1/events 之下`,
  );
  return `${call.method} ${pathShape(described.path).join("/")}`;
}

// ---------------------------------------------------------------------------
// 一、地址鎖：service 的七條呼叫，形狀恰好是那七個，且後端真的有
// ---------------------------------------------------------------------------

test("content.service.ts 恰好有七條呼叫", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "content.service.ts",
  );
  assert.equal(
    calls.length,
    7,
    `content.service.ts 應該有 7 條 apiClient 呼叫（1 讀 6 寫），實際 ${calls.length}`,
  );
});

test("七條呼叫的 method + 路徑形狀與後端 page-sections 路由逐一對上", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "content.service.ts",
  );

  assert.deepEqual(
    calls.map(callShape).sort(),
    [...EXPECTED].sort(),
    "content.service.ts 的呼叫形狀變了——請確認是真的要改契約，而不是打錯字",
  );
});

test("七條呼叫每一條都存在於後端路由快照（不是自創的路徑）", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "content.service.ts",
  );

  for (const call of calls) {
    const key = callShape(call);
    assert.ok(
      BACKEND_KEYS.has(key),
      `${call.method} ${call.raw}（形狀 ${key}）不在後端路由快照裡——這是一條死路徑`,
    );
  }
});

test("區塊與卡片是兩層路徑：卡片一定掛在某個區塊之下", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "content.service.ts",
  );
  const cardCalls = calls.filter((call) => call.raw.includes("/cards"));

  assert.equal(cardCalls.length, 3, "卡片應該有三條（新增／修改／刪除）");
  for (const call of cardCalls) {
    assert.match(
      call.raw,
      /page-sections\/\$\{[^}]+\}\/cards/,
      `${call.method} ${call.raw} 少了 sectionId 那一層`,
    );
  }
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：content.tsx 只能呼叫這七個 service 方法
// ---------------------------------------------------------------------------

const SCREEN = join(
  HERE,
  "..",
  "src",
  "app",
  "(auth)",
  "[eventId]",
  "content.tsx",
);

/** 從原始碼抓出 `contentService.<method>` 的方法名集合。 */
function contentServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/contentService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("content.tsx 對 contentService 的呼叫集合恰好是那七個方法", () => {
  const allowed = new Set([
    "listSections",
    "createSection",
    "updateSection",
    "deleteSection",
    "createCard",
    "updateCard",
    "deleteCard",
  ]);

  assert.deepEqual(
    [...contentServiceMethodsIn(SCREEN)].sort(),
    [...allowed].sort(),
    "content.tsx 的 contentService 呼叫集合變了——新增寫入路徑請先更新這份清單",
  );
});

test("content.tsx 只透過 contentService 打後端，沒有直接拿 apiClient", () => {
  const source = readFileSync(SCREEN, "utf8");

  assert.equal(
    /apiClient\./.test(source),
    false,
    "content.tsx 直接用了 apiClient，繞過了 service 層的契約",
  );
  assert.equal(
    /from "@\/services\/api"/.test(source),
    false,
    "content.tsx 直接 import 了 apiClient 模組",
  );
});
