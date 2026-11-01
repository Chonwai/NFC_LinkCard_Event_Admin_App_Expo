/**
 * 票種（`ticket-types`）的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 為什麼要另一份鎖
 *
 * `tests/ticket-type-service.test.mjs` 測的是**語意**（第二個參數是不是
 * `undefined`、DELETE 有沒有回傳 body、payload 有沒有被改寫）；
 * `tests/ticket-type-payload.test.mjs` 測的是**錢與欄位**。
 * 這一支只問兩件更窄的事：
 *
 * 1. **地址沒搬家、守備範圍沒變大**：`ticket-type.service.ts` 的呼叫形狀恰好是
 *    那四條，而且每一條都真的存在於 `scripts/backend-routes.snapshot.json`。
 * 2. **畫面不直接打後端**：`ticket-types.tsx` 只用 `ticketTypeService`，
 *    不碰 `apiClient`。
 *
 * ## 為什麼「恰好四條」值得單獨釘
 *
 * 後端在 `/ticket-types` 底下剛好四條（`events.routes.ts:41-55`），Web 四條全用。
 * 多接一條（例如 `POST …/ticket-types/:id/duplicate`）就會變成 App 有、Web 沒有
 * 的寫入路徑；少接一條就做不到「不增不減」。
 *
 * 全域閘門 `npm run check:contract` 驗的是「`src/services/` 裡每一條呼叫都存在
 * 於後端快照」。它的盲點是**不會紅在「多呼叫了什麼」**——只要那條路由真的存在，
 * 全域閘門照樣是綠的。所以範圍要由這一支自己鎖。
 *
 * 背景：2026-10-22 的對等審計發現 App 一直在打 `checkin/override` 這條後端
 * 從來沒有的路由，而 `tsc` 與當時全部測試都是綠的（呼叫網址只是字串，
 * 型別系統看不到）。
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
 * 四條呼叫的期望形狀。`*` 代表路徑參數（eventId／ticketTypeId）。
 *
 * 這四條 = 1 讀 3 寫，與 `LinkCard_Frontend/lib/events/ticket-types.ts` 的
 * 事件層呼叫一一對應。**它們是這個能力的全部。**
 */
const EXPECTED = [
  "GET */ticket-types",
  "POST */ticket-types",
  "PATCH */ticket-types/*",
  "DELETE */ticket-types/*",
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

function serviceCalls() {
  return extractAppCalls().filter(
    (call) => call.file === "ticket-type.service.ts",
  );
}

// ---------------------------------------------------------------------------
// 一、地址鎖
// ---------------------------------------------------------------------------

test("ticket-type.service.ts 恰好有四條呼叫", () => {
  const calls = serviceCalls();
  assert.equal(
    calls.length,
    4,
    `ticket-type.service.ts 應該有 4 條 apiClient 呼叫（1 讀 3 寫），實際 ${calls.length}`,
  );
});

test("四條呼叫的 method + 路徑形狀與後端 ticket-types 路由逐一對上", () => {
  assert.deepEqual(
    serviceCalls().map(callShape).sort(),
    [...EXPECTED].sort(),
    "ticket-type.service.ts 的呼叫形狀變了——請確認是真的要改契約，而不是打錯字",
  );
});

test("四條呼叫每一條都存在於後端路由快照（不是自創的路徑）", () => {
  for (const call of serviceCalls()) {
    const key = callShape(call);
    assert.ok(
      BACKEND_KEYS.has(key),
      `${call.method} ${call.raw}（形狀 ${key}）不在後端路由快照裡——這是一條死路徑`,
    );
  }
});

test("停用是 DELETE，不是 POST／PATCH", () => {
  const calls = serviceCalls();
  const deleteCalls = calls.filter((call) => call.method === "DELETE");

  assert.equal(deleteCalls.length, 1, "停用應該恰好有一條");
  assert.match(
    deleteCalls[0].raw,
    /\/ticket-types\/\$\{/,
    "停用打的不是 /ticket-types/:id——後端只在那條路徑上掛 DELETE",
  );
});

test("列表是 GET，建立是 POST，修改是 PATCH（三種動詞各一）", () => {
  const methods = serviceCalls()
    .map((call) => call.method)
    .sort();

  assert.deepEqual(methods, ["DELETE", "GET", "PATCH", "POST"]);
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：畫面只能透過 service，不得直接打後端
// ---------------------------------------------------------------------------

const SCREEN = join(
  HERE,
  "..",
  "src",
  "app",
  "(auth)",
  "[eventId]",
  "ticket-types.tsx",
);

/** 從原始碼抓出 `ticketTypeService.<method>` 的方法名集合。 */
function ticketTypeServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/ticketTypeService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("ticket-types.tsx 對 ticketTypeService 的呼叫集合恰好是那四個方法", () => {
  assert.deepEqual(
    [...ticketTypeServiceMethodsIn(SCREEN)].sort(),
    [
      "createTicketType",
      "deactivateTicketType",
      "listAdminTicketTypes",
      "updateTicketType",
    ],
    "ticket-types.tsx 的 ticketTypeService 呼叫集合變了——新增寫入路徑請先更新這份清單",
  );
});

test("ticket-types.tsx 只透過 service 打後端，沒有直接拿 apiClient", () => {
  const source = readFileSync(SCREEN, "utf8");

  assert.equal(
    /apiClient\./.test(source),
    false,
    "ticket-types.tsx 直接用了 apiClient，繞過了 service 層的契約",
  );
  assert.equal(
    /from "@\/services\/api"/.test(source),
    false,
    "ticket-types.tsx 直接 import 了 apiClient 模組",
  );
});

test("ticket-types.tsx 沒有自己去組 /api/v1/events 路徑", () => {
  const source = readFileSync(SCREEN, "utf8");

  assert.equal(
    /\/api\/v1\/events/.test(source),
    false,
    "畫面上出現了硬寫的 API 路徑——那條路徑不會被契約閘門掃到（它只掃 services/）",
  );
});
