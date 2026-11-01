/**
 * 場次（`sessions`）的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 為什麼要另一份鎖
 *
 * `tests/session-service.test.mjs` 測的是**語意**（body 欄位集合、信封怎麼解、
 * 哪些欄位送 `null`）。這一支只問三件更窄、也更難靠 review 抓到的事：
 *
 * 1. **地址沒搬家、守備範圍沒變大**：`session.service.ts` 的呼叫形狀恰好是
 *    那四條，而且每一條都真的存在於 `scripts/backend-routes.snapshot.json`。
 * 2. **沒有人偷偷把「刪除」加回來**。後端沒有 `DELETE /sessions/:sessionId`
 *    （`sessions-polls.routes.ts:27-49` 唯一的 `router.delete` 是
 *    `…/sessions/:sessionId/register`，那是**參加者**取消報名用的）。
 *    Web 的 `deleteSession` 打的就是那條不存在的路由，按下去是 404。
 *    App 刻意不重現它——所以要釘住「不存在」（見 12 §12.3.2 `ESC-CRA-001`）。
 * 3. **畫面只打 review 過的呼叫**：`sessions.tsx` 與名冊頁用到的 service 方法
 *    恰好是那四個。
 *
 * ## 為什麼「恰好四條」值得單獨釘
 *
 * 後端在 `/sessions` 底下有**七條**路由，Web 管理頁只用四條。另外三條不是壞東西：
 *
 * - `GET  …/sessions/:sessionId`：Web 不用（列表已經有全部欄位）。
 * - `POST …/sessions/:sessionId/register`：**參加者**行為。
 * - `DELETE …/sessions/:sessionId/register`：同上。
 * - `POST …/sessions/:sessionId/checkin`：場次現場報到。**Web 沒有任何 UI**
 *   （`grep -rn 'sessions/.*checkin' app components lib hooks` 為空），
 *   所以 App 也沒有——沒有可對齊的對象。這條在兩邊都無人使用，
 *   已記在 `03-capability-matrix.md:204-205`。
 *
 * 全域閘門 `npm run check:contract` 驗的是「`src/services/` 裡每一條呼叫都存在
 * 於後端快照」。它的盲點是**不會紅在「多呼叫了什麼」**：上面那幾條都真的存在於
 * 快照，加進來全域閘門照樣是綠的。所以範圍要由這一支自己鎖。
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
 * 四條呼叫的期望形狀。`*` 代表路徑參數（eventId／sessionId）。
 *
 * 這四條 = 2 讀 2 寫，與 `LinkCard_Frontend/lib/events/sessions.ts` 的事件層
 * 呼叫一一對應（扣除那條打不存在的 `deleteSession`）。
 */
const EXPECTED = [
  "GET */sessions",
  "POST */sessions",
  "PATCH */sessions/*",
  "GET */sessions/*/registrations",
];

const SERVICE = "session.service.ts";

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
  return extractAppCalls().filter((call) => call.file === SERVICE);
}

// ---------------------------------------------------------------------------
// 一、地址鎖：service 的四條呼叫，形狀恰好是那四個，且後端真的有
// ---------------------------------------------------------------------------

test("session.service.ts 恰好有四條呼叫", () => {
  const calls = serviceCalls();
  assert.equal(
    calls.length,
    4,
    `session.service.ts 應該有 4 條 apiClient 呼叫（2 讀 2 寫），實際 ${calls.length}`,
  );
});

test("四條呼叫的 method + 路徑形狀與後端 sessions 路由逐一對上", () => {
  assert.deepEqual(
    serviceCalls().map(callShape).sort(),
    [...EXPECTED].sort(),
    "session.service.ts 的呼叫形狀變了——請確認是真的要改契約，而不是打錯字",
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

// ---------------------------------------------------------------------------
// 二、負向鎖：刪除、報到、參加者行動都不該出現
// ---------------------------------------------------------------------------

test("session.service.ts 沒有任何 DELETE 呼叫——後端沒有 DELETE /sessions/:sessionId", () => {
  const deletes = serviceCalls().filter((call) => call.method === "DELETE");

  assert.deepEqual(
    deletes.map((call) => `${call.method} ${call.raw}`),
    [],
    "後端沒有 DELETE /sessions/:sessionId（Web 那顆按下去是 404）。App 不得重現它，也不得用 PATCH status=DELETED 假裝對齊（見 12 §12.3.2 ESC-CRA-001）",
  );
});

test("沒有人打 checkin／register 這兩條——那是現場報到與參加者行為", () => {
  for (const call of serviceCalls()) {
    assert.equal(
      /\/checkin\b/.test(call.raw),
      false,
      `${call.method} ${call.raw} 打了場次報到端點——Web 沒有這個 UI，本輪不接`,
    );
    assert.equal(
      /\/register\b/.test(call.raw),
      false,
      `${call.method} ${call.raw} 打了報名端點——那是參加者行為，不是後台動作`,
    );
  }
});

test("單筆 GET /sessions/:sessionId 不在守備範圍（列表已含全部欄位）", () => {
  const singleGets = serviceCalls().filter(
    (call) => call.method === "GET" && callShape(call) === "GET */sessions/*",
  );

  assert.deepEqual(
    singleGets.map((call) => call.raw),
    [],
    "多接一條單筆 GET 就是一個 Web 沒有的呼叫；列表回應已經有全部欄位",
  );
});

// ---------------------------------------------------------------------------
// 三、範圍鎖：畫面只能呼叫這四個 service 方法
// ---------------------------------------------------------------------------

const SCREEN = join(
  HERE,
  "..",
  "src",
  "app",
  "(auth)",
  "[eventId]",
  "sessions.tsx",
);

const ROSTER = join(
  HERE,
  "..",
  "src",
  "app",
  "(auth)",
  "[eventId]",
  "session-roster",
  "[sessionId].tsx",
);

/** 從原始碼抓出 `sessionService.<method>` 的方法名集合。 */
function sessionServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/sessionService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("sessions.tsx 對 sessionService 的呼叫集合恰好是那三個方法", () => {
  const allowed = new Set(["createSession", "listSessions", "updateSession"]);

  assert.deepEqual(
    [...sessionServiceMethodsIn(SCREEN)].sort(),
    [...allowed].sort(),
    "sessions.tsx 的 sessionService 呼叫集合變了——新增寫入路徑請先更新這份清單",
  );
});

test("名冊頁只呼叫 listSessionRegistrations", () => {
  assert.deepEqual(
    [...sessionServiceMethodsIn(ROSTER)].sort(),
    ["listSessionRegistrations"],
    "名冊頁變成了讀寫混合的頁面——名冊目前是唯讀的",
  );
});

test("兩個畫面都只透過 sessionService 打後端，沒有直接拿 apiClient", () => {
  for (const filePath of [SCREEN, ROSTER]) {
    const source = readFileSync(filePath, "utf8");
    assert.equal(
      /apiClient\s*\./.test(source),
      false,
      `${filePath} 直接用了 apiClient——所有呼叫都要經過 service，否則契約鎖看不到`,
    );
  }
});
