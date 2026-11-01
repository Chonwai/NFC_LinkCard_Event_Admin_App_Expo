/**
 * 匯款覆核（`bank-transfers`）的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 為什麼要另一份鎖
 *
 * `tests/bank-transfer-service.test.mjs` 測的是**語意**（清單只送 status、
 * `reviewNote` 為 `undefined` 時不帶鍵、金額原樣透傳）；
 * `tests/bank-transfer-review-confirm.test.mjs` 測的是**確認閘門**。
 * 這一支只問兩件更窄的事：
 *
 * 1. **地址沒搬家、守備範圍沒變大**：`bank-transfer.service.ts` 的呼叫形狀恰好
 *    是那兩條，而且都真的存在於 `scripts/backend-routes.snapshot.json`。
 * 2. **畫面不直接打後端**：`bank-transfers.tsx` 只用 `bankTransferService`。
 *
 * ## 為什麼「恰好兩條」值得單獨釘
 *
 * 後端 `bank-transfers` 底下有三條路由（`event-ops.routes.ts:62-74`）：
 *
 * | 路由 | 誰用 | App |
 * | --- | --- | --- |
 * | `GET  …/bank-transfers` | 後台清單 | ✅ |
 * | `PATCH …/bank-transfers/:approvalId/review` | 後台覆核 | ✅ |
 * | `POST …/bank-transfers/submit` | **參加者**送匯款證明 | ❌ 刻意不接 |
 *
 * 多接第三條，App 就多出一條「後台替人送匯款證明」的寫入路徑（Web 後台沒有
 * 這件事）；少接一條就做不到「不增不減」。全域閘門
 * `npm run check:contract` 的盲點正是**不會紅在「多呼叫了什麼」**——只要那條
 * 路由真的存在，它照樣是綠的。所以範圍要由這一支自己鎖。
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
 * 兩條呼叫的期望形狀。`*` 代表路徑參數（eventId／approvalId）。
 *
 * 這兩條 = 1 讀 1 寫，與 `LinkCard_Frontend/lib/events/registrations.ts:360`
 * 與 `:376` 一一對應。**它們是這個能力的全部。**
 */
const EXPECTED = ["GET */bank-transfers", "PATCH */bank-transfers/*/review"];

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
    (call) => call.file === "bank-transfer.service.ts",
  );
}

// ---------------------------------------------------------------------------
// 一、地址鎖
// ---------------------------------------------------------------------------

test("bank-transfer.service.ts 恰好有兩條呼叫", () => {
  const calls = serviceCalls();
  assert.equal(
    calls.length,
    2,
    `bank-transfer.service.ts 應該有 2 條呼叫（1 讀 1 寫），實際 ${calls.length}`,
  );
});

test("兩條呼叫的 method + 路徑形狀與後端 bank-transfers 路由逐一對上", () => {
  assert.deepEqual(serviceCalls().map(callShape).sort(), [...EXPECTED].sort());
});

test("每一條呼叫都真的存在於後端路由快照裡（不是死路徑）", () => {
  for (const call of serviceCalls()) {
    const key = callShape(call);
    assert.ok(
      BACKEND_KEYS.has(key),
      `${call.method} ${call.raw}（形狀 ${key}）不在後端路由快照裡——這是一條死路徑`,
    );
  }
});

test("清單是 GET、覆核是 PATCH（覆核不是 POST：後端只在那條路徑上掛 PATCH）", () => {
  const calls = serviceCalls();

  assert.deepEqual(calls.map((call) => call.method).sort(), ["GET", "PATCH"]);
});

test("沒有接參加者的 submit（後台不替報名者送匯款證明）", () => {
  const calls = serviceCalls();

  assert.equal(
    calls.some((call) => call.method === "POST"),
    false,
    "bank-transfer.service.ts 出現了 POST——`…/bank-transfers/submit` 是報名者動作，後台不該有這條寫入路徑",
  );
  assert.equal(
    calls.some((call) => callShape(call) === "POST */bank-transfers/submit"),
    false,
    "service 直接打到了 submit 端點",
  );
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
  "bank-transfers.tsx",
);

/** 從原始碼抓出 `bankTransferService.<method>` 的方法名集合。 */
function bankTransferServiceMethodsIn(filePath) {
  const source = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const match of source.matchAll(/bankTransferService\.(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("bank-transfers.tsx 對 bankTransferService 的呼叫集合恰好是那兩個方法", () => {
  assert.deepEqual(
    [...bankTransferServiceMethodsIn(SCREEN)].sort(),
    ["listApprovals", "review"],
    "bank-transfers.tsx 的 bankTransferService 呼叫集合變了——新增呼叫請先更新這份清單",
  );
});

test("bank-transfers.tsx 只透過 service 打後端，沒有直接拿 apiClient", () => {
  const source = readFileSync(SCREEN, "utf8");

  assert.equal(
    /apiClient\./.test(source),
    false,
    "bank-transfers.tsx 直接用了 apiClient，繞過了 service 層的契約",
  );
  assert.equal(
    /from "@\/services\/api"/.test(source),
    false,
    "bank-transfers.tsx 直接 import 了 apiClient 模組",
  );
});

test("bank-transfers.tsx 沒有自己去組 /api/v1/events 路徑", () => {
  const source = readFileSync(SCREEN, "utf8");

  assert.equal(
    /\/api\/v1\/events/.test(source),
    false,
    "畫面上出現了硬寫的 API 路徑——那條路徑不會被契約閘門掃到（它只掃 services/）",
  );
});
