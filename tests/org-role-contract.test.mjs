/**
 * 組織角色（`org-roles`）的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 為什麼要另一份鎖
 *
 * `tests/org-role-service.test.mjs` 測的是**語意**（payload 恰好兩個鍵、email
 * 原樣透傳、`orgRoleId` 不是 `invitationId`）；
 * `tests/org-role-invite-confirm.test.mjs` 與
 * `tests/org-role-remove-confirm.test.mjs` 測的是**確認閘門**；
 * `tests/org-role-display.test.mjs` 測的是**顯示規則**。
 *
 * 這一支只問兩件更窄的事：
 *
 * 1. **地址沒搬家、守備範圍沒變大**：`org-role.service.ts` 的呼叫形狀恰好是
 *    那四條，而且都真的存在於 `scripts/backend-routes.snapshot.json`。
 * 2. **畫面不直接打後端**：`org-roles.tsx` 只用 `orgRoleService`。
 *
 * ## 為什麼「恰好四條」值得單獨釘
 *
 * 後端 `engagement.routes.ts:43-46` 在 `org-roles` 底下恰好有四條路由，而 App
 * 四條都接（1 讀 3 寫）。多接一條就是 App 多出一條 Web 沒有的寫入路徑；少接
 * 一條就做不到「不增不減」。
 *
 * 全域閘門 `npm run check:contract` 的盲點正是**不會紅在「多呼叫了什麼」**
 * ——只要那條路由真的存在，它照樣是綠的。所以範圍要由這一支自己鎖。
 *
 * ## 為什麼 `accept` 要單獨一條測試
 *
 * 這是整個模組唯一一個**後端與 Web 不一致**的 method：
 *
 * | 誰 | method | 結果 |
 * | --- | --- | --- |
 * | 後端 `engagement.routes.ts:45` | `POST` | 真相 |
 * | Web `lib/events/engagement.ts:157` | `PATCH` | **404** |
 *
 * Web 那支函式**零呼叫點**，所以那個錯誤從來沒有人回報過——死碼不會喊痛。
 * 下面那條測試存在的唯一目的，就是不讓 `PATCH` 版本回流。
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
 * 四條呼叫的期望形狀。`*` 代表路徑參數（eventId／orgRoleId）。
 *
 * 這四條 = 1 讀 3 寫，與 `engagement.routes.ts:43-46` 一一對應。
 * **它們是這個能力的全部。**
 */
const EXPECTED = [
  "GET */org-roles",
  "POST */org-roles/accept",
  "POST */org-roles/invite",
  "DELETE */org-roles/*",
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
    (call) => call.file === "org-role.service.ts",
  );
}

// ---------------------------------------------------------------------------
// 一、地址鎖
// ---------------------------------------------------------------------------

test("org-role.service.ts 恰好有四條呼叫", () => {
  const calls = serviceCalls();

  assert.equal(
    calls.length,
    4,
    `org-role.service.ts 應該有 4 條呼叫（1 讀 3 寫），實際 ${calls.length}`,
  );
});

test("四條呼叫的 method + 路徑形狀與後端 org-roles 路由逐一對上", () => {
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

test("四個 method 恰好是 GET / POST / POST / DELETE", () => {
  assert.deepEqual(
    serviceCalls()
      .map((call) => call.method)
      .sort(),
    ["DELETE", "GET", "POST", "POST"],
  );
});

// ---------------------------------------------------------------------------
// 二、accept 是 POST，不是 Web 的 PATCH
// ---------------------------------------------------------------------------

test("accept 是 POST 不是 PATCH（後端 engagement.routes.ts:45 只掛 router.post）", () => {
  const accept = serviceCalls().find((call) =>
    callShape(call).endsWith("*/org-roles/accept"),
  );

  assert.ok(accept != null, "org-role.service.ts 找不到 accept 的呼叫");
  assert.equal(
    accept.method,
    "POST",
    "accept 用了 PATCH——那是 LinkCard_Frontend/lib/events/engagement.ts:157 的錯誤寫法，會 404",
  );
});

test("整個 service 沒有出現 PATCH（這個模組沒有任何 PATCH 路由）", () => {
  assert.equal(
    serviceCalls().some((call) => call.method === "PATCH"),
    false,
    "org-roles 底下沒有 PATCH 路由，出現 PATCH 就是照抄了 Web 的死碼",
  );
});

// ---------------------------------------------------------------------------
// 三、範圍鎖：畫面只能透過 service，不得直接打後端
// ---------------------------------------------------------------------------

const SCREEN = join(
  HERE,
  "..",
  "src",
  "app",
  "(auth)",
  "[eventId]",
  "org-roles.tsx",
);

/** 從原始碼抓出 `orgRoleService.<method>` 的方法名集合。 */
function orgRoleServiceMethodsIn(filePath) {
  const source = stripBlockComments(readFileSync(filePath, "utf8"));
  const found = new Set();
  for (const match of source.matchAll(/orgRoleService\s*\.\s*(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

/**
 * 去掉區塊註解。
 *
 * 為什麼要做這件事：這個檔的檔頭就在解釋「為什麼沒有接受邀請的畫面」，而那段
 * 說明必須寫出 `accept` 這個名字。第一版沒有去註解，於是**檔頭自己的說明**被
 * 當成一個呼叫，測試紅在一個「它其實沒被呼叫」的方法上。
 *
 * 一個掃原始碼的鎖應該鎖的是**程式碼**，不是散文。
 *
 * ⚠️ 只去區塊註解（`/* … *\/`）。`//` 行註解沒有處理——本檔的行註解都不含呼叫
 * 字面，而處理 `//` 要考慮字串裡的 `https://`，那是另一種容易出錯的事。若日後
 * 有人把呼叫寫進行註解，測試會紅，而錯誤訊息會直接指出是哪個方法。
 */
function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("org-roles.tsx 對 orgRoleService 的呼叫集合恰好是那三個方法", () => {
  // `accept` 不在裡面是**刻意的**：邀請 token 沒有任何送達管道，所以沒有接受
  // 畫面（理由見 org-roles.tsx 檔頭）。service 仍保留那一支，因為它是後端真實
  // 存在的第四條路由，而且 method 要正確。
  assert.deepEqual([...orgRoleServiceMethodsIn(SCREEN)].sort(), [
    "invite",
    "list",
    "remove",
  ]);
});

test("org-roles.tsx 只透過 service 打後端，沒有直接拿 apiClient", () => {
  const source = stripBlockComments(readFileSync(SCREEN, "utf8"));

  assert.equal(
    /apiClient\./.test(source),
    false,
    "org-roles.tsx 直接用了 apiClient，繞過了 service 層的契約",
  );
  assert.equal(
    /from "@\/services\/api"/.test(source),
    false,
    "org-roles.tsx 直接 import 了 apiClient 模組",
  );
});

test("org-roles.tsx 沒有自己去組 /api/v1/events 路徑", () => {
  const source = stripBlockComments(readFileSync(SCREEN, "utf8"));

  assert.equal(
    /\/api\/v1\/events/.test(source),
    false,
    "畫面上出現了硬寫的 API 路徑——那條路徑不會被契約閘門掃到（它只掃 services/）",
  );
});
