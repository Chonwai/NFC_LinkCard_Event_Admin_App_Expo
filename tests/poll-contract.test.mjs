/**
 * 投票（`polls`）的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 為什麼要另一份鎖
 * `tests/poll-service.test.mjs` 測的是**語意**（body 欄位集合、信封怎麼解、
 * 哪幾支不該帶 body），`tests/poll-results.test.mjs` 測的是**算術**。
 * 這一支只問兩件更窄的事：
 *
 * 1. **地址沒搬家、守備範圍沒變大**：`poll.service.ts` 的呼叫形狀恰好是那四條，
 *    而且每一條都真的存在於 `scripts/backend-routes.snapshot.json`。
 * 2. **畫面不打沒人 review 過的呼叫**：`polls.tsx` 用到的 `pollService` 方法
 *    恰好是這四個。
 *
 * ## 為什麼「恰好四條」值得單獨釘
 *
 * 後端在 `/polls` 底下有**六條**路由（`sessions-polls.routes.ts:53-58`），
 * Web 的投票頁只用四條。另外兩條不是壞東西：
 *
 * - `POST …/polls/:pollId/vote` 是**參加者**行為（`badgeTagUid` 去重）。
 *   後台加一根「替人投票」的按鈕就變成一個 Web 沒有的功能。
 * - `GET …/polls/:pollId/results` 存在，但 Web 刻意不呼叫它——计票在 client 端
 *   數 `votes[]`，逐筆打 results 就是 N+1。
 *
 * 全域閘門 `npm run check:contract` 驗的是「`src/services/` 裡每一條呼叫都存在
 * 於後端快照」。它的盲點是**不會紅在「多呼叫了什麼」**：上面兩條都真的存在於
 * 快照，加進來全域閘門照樣是綠的。所以範圍要由這一支自己鎖。
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
 * 四條呼叫的期望形狀。`*` 代表路徑參數（eventId／pollId）。
 *
 * 這四條 = 1 讀 3 寫，與 `LinkCard_Frontend/lib/events/sessions.ts:65-120` 的
 * 事件層呼叫一一對應。**它們是這個能力的全部**；後端另外兩條
 *（`vote`、`results`）刻意不在這裡，理由見檔頭。
 */
const EXPECTED = [
  "GET */polls",
  "POST */polls",
  "PATCH */polls/*/activate",
  "PATCH */polls/*/close",
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
// 一、地址鎖：service 的四條呼叫，形狀恰好是那四個，且後端真的有
// ---------------------------------------------------------------------------

test("poll.service.ts 恰好有四條呼叫", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "poll.service.ts",
  );
  assert.equal(
    calls.length,
    4,
    `poll.service.ts 應該有 4 條 apiClient 呼叫（1 讀 3 寫），實際 ${calls.length}`,
  );
});

test("四條呼叫的 method + 路徑形狀與後端 polls 路由逐一對上", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "poll.service.ts",
  );

  assert.deepEqual(
    calls.map(callShape).sort(),
    [...EXPECTED].sort(),
    "poll.service.ts 的呼叫形狀變了——請確認是真的要改契約，而不是打錯字",
  );
});

test("四條呼叫每一條都存在於後端路由快照（不是自創的路徑）", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "poll.service.ts",
  );

  for (const call of calls) {
    const key = callShape(call);
    assert.ok(
      BACKEND_KEYS.has(key),
      `${call.method} ${call.raw}（形狀 ${key}）不在後端路由快照裡——這是一條死路徑`,
    );
  }
});

test("沒有呼叫 vote 或 results：那兩條是後端有、但 Web 投票頁沒用的", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "poll.service.ts",
  );

  for (const call of calls) {
    assert.equal(
      /\/vote\b/.test(call.raw),
      false,
      `${call.method} ${call.raw} 打了投票端點——後台不替人投票`,
    );
    assert.equal(
      /\/results\b/.test(call.raw),
      false,
      `${call.method} ${call.raw} 打了結果端點——計票在 client 端數 votes[]，不是 N+1`,
    );
  }
});

test("activate 與 close 是 PATCH，不是 POST（後端只掛 PATCH）", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "poll.service.ts",
  );
  const lifecycle = calls.filter((call) =>
    /\/(activate|close)$/.test(call.raw),
  );

  assert.equal(lifecycle.length, 2, "啟用與關閉應該各有一條");
  for (const call of lifecycle) {
    assert.equal(call.method, "PATCH", `${call.raw} 的 method 變了`);
  }
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：polls.tsx 只能呼叫這四個 service 方法
// ---------------------------------------------------------------------------

const SCREEN = join(
  HERE,
  "..",
  "src",
  "app",
  "(auth)",
  "[eventId]",
  "polls.tsx",
);

/** 從原始碼抓出 `pollService.<method>` 的方法名集合。 */
function pollServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/pollService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("polls.tsx 對 pollService 的呼叫集合恰好是那四個方法", () => {
  const allowed = new Set([
    "listPolls",
    "createPoll",
    "activatePoll",
    "closePoll",
  ]);

  assert.deepEqual(
    [...pollServiceMethodsIn(SCREEN)].sort(),
    [...allowed].sort(),
    "polls.tsx 的 pollService 呼叫集合變了——新增寫入路徑請先更新這份清單",
  );
});

test("polls.tsx 只透過 pollService 打後端，沒有直接拿 apiClient", () => {
  const source = readFileSync(SCREEN, "utf8");

  assert.equal(
    /apiClient\./.test(source),
    false,
    "polls.tsx 直接用了 apiClient，繞過了 service 層的契約",
  );
  assert.equal(
    /from "@\/services\/api"/.test(source),
    false,
    "polls.tsx 直接 import 了 apiClient 模組",
  );
});
