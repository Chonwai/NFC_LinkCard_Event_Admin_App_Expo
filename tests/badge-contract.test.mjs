/**
 * `badges` 能力的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 這一支與其他測試的分工
 *
 * | 檔案 | 問的問題 |
 * | --- | --- |
 * | `tests/badge-service.test.mjs` | 四支新呼叫的**語意**（body 恰好幾個鍵、UID 原樣透傳） |
 * | `tests/badge-inventory.test.mjs` | 統計與批次聚合的**算法**（written 看 writtenAt、bound 看 registrationId） |
 * | `tests/badge-batch.test.mjs` | 表單驗證與確認內容（1–500、色碼集合、重複 badgeId） |
 * | **本檔** | **地址與範圍**：呼叫的形狀對不對、有沒有多接一條、畫面有沒有繞過 service |
 *
 * 全域閘門 `npm run check:contract` 的盲點正是**不會紅在「多呼叫了什麼」**
 * ——只要那條路由真的存在，它照樣是綠的。所以範圍要由這一支自己鎖。
 *
 * ## 為什麼要釘住「沒有 PATCH／DELETE」
 *
 * Web 的徽章管理頁**沒有**改狀態、也沒有作廢／刪除，後端
 * `event-ops.routes.ts:84-88` 的 nfc 路由也只有「讀、建批次、完成批次、
 * 指派、匯出」五條。所以對齊 `badges` 時，那兩個能力本來就不該被實作
 * ——這不是漏做，是**兩邊都沒有**。
 *
 * 但「沒有做」不會留下任何痕跡，下一次有人看到「狀態欄」就會想補一個
 * PATCH。下面那兩條斷言讓那個補動作為紅：它會強迫動手的人先回答
 * 「後端有這條路由嗎」。答案是没有。
 *
 * ## 為什麼要釘住檔案清單
 *
 * `badges` 的四個寫入 dialog 住在 `src/components/badges/`。若有人在裡面
 * 直接寫 `fetch('/api/v1/events/…')`，`check:contract` 掃不到（它只掃
 * `src/services/*.ts`）。所以這裡自己掃一次。
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

/** 後端快照裡所有 nfc 路由。 */
const NFC_BACKEND = SNAPSHOT.eventRoutes.filter((route) =>
  route.path.includes("nfc"),
);

/**
 * `nfc.service.ts` 的全部呼叫（不是只有 badge）。
 *
 * 這個 service 同時承載門禁與名片交換，那些是別的 commit 的守備範圍；
 * 這裡只要求「剛好是這八條」——多一條就是能力漂移，少一條就是接線斷了。
 */
const EXPECTED_SERVICE_CALLS = [
  "GET */nfc/lookup",
  "POST */nfc/bind",
  "POST */nfc/exchange",
  "GET */nfc/badges",
  "GET */nfc/badges/export",
  "POST */nfc/batch",
  "POST */nfc/batch/*/complete",
  "POST */nfc/batch/claim",
];

/** badge 管理相關的五條（本能力的全部寫入面）。 */
const EXPECTED_BADGE_CALLS = [
  "GET */nfc/badges",
  "GET */nfc/badges/export",
  "POST */nfc/batch",
  "POST */nfc/batch/*/complete",
  "POST */nfc/batch/claim",
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
  return extractAppCalls().filter((call) => call.file === "nfc.service.ts");
}

function badgeCalls() {
  return serviceCalls().filter(
    (call) =>
      callShape(call).includes("/nfc/batch") ||
      callShape(call).startsWith("GET */nfc/badges"),
  );
}

// ---------------------------------------------------------------------------
// 一、地址鎖
// ---------------------------------------------------------------------------

test("nfc.service.ts 恰好有八條呼叫（3 條既有 + 5 條 badge）", () => {
  const calls = serviceCalls();

  assert.equal(
    calls.length,
    EXPECTED_SERVICE_CALLS.length,
    `應該有 8 條呼叫，實際 ${calls.length}：${calls.map(callShape).join("、")}`,
  );
});

test("八條呼叫的 method + 路徑形狀與後端 nfc 路由逐一對上", () => {
  assert.deepEqual(
    serviceCalls().map(callShape).sort(),
    [...EXPECTED_SERVICE_CALLS].sort(),
  );
});

test("badge 相關的五條呼叫形狀恰好是那五條", () => {
  assert.deepEqual(
    badgeCalls().map(callShape).sort(),
    [...EXPECTED_BADGE_CALLS].sort(),
  );
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

test("badge 的五條恰好是 3 POST + 2 GET（沒有 PUT／PATCH／DELETE）", () => {
  assert.deepEqual(
    badgeCalls()
      .map((call) => call.method)
      .sort(),
    ["GET", "GET", "POST", "POST", "POST"],
  );
});

// ---------------------------------------------------------------------------
// 二、能力範圍：改狀態／作廢在兩邊都不存在
// ---------------------------------------------------------------------------

test("nfc.service.ts 沒有 PATCH／DELETE（badges 兩邊都沒有這兩個能力）", () => {
  const offenders = serviceCalls()
    .filter((call) => call.method === "PATCH" || call.method === "DELETE")
    .map(callShape);

  assert.deepEqual(
    offenders,
    [],
    `後端 event-ops.routes.ts:84-88 的 nfc 路由沒有任何 PATCH／DELETE，出現這兩種 method 就是憑空發明了一條死路徑：${offenders.join("、")}`,
  );
});

test("後端快照的 nfc 路由也沒有 PATCH／DELETE（證明不是 App 漏接）", () => {
  const writeMethods = NFC_BACKEND.filter(
    (route) => route.method === "PATCH" || route.method === "DELETE",
  ).map((route) => `${route.method} ${route.path}`);

  assert.deepEqual(
    writeMethods,
    [],
    `後端 nfc 底下出現了 App 沒接的寫入路由，請重新評估對齊範圍：${writeMethods.join("、")}`,
  );
});

test("後端快照的 nfc POST 路由恰好是六條，且多出來的那一條是已知的 exchanges", () => {
  const posts = NFC_BACKEND.filter((route) => route.method === "POST").map(
    (route) => pathShape(route.path).join("/"),
  );

  // App 沒有接 `nfc/exchanges`（自助交換，見 api.types.ts 的 ExchangeType 註解），
  // 所以後端多一條不算漂移；但**多出來的必須是已知的那一條**。
  assert.deepEqual(posts.sort(), [
    "*/nfc/batch",
    "*/nfc/batch/*/complete",
    "*/nfc/batch/claim",
    "*/nfc/bind",
    "*/nfc/exchange",
    "*/nfc/exchanges",
  ]);
});

// ---------------------------------------------------------------------------
// 三、範圍鎖：畫面只能透過 service
// ---------------------------------------------------------------------------

const SCREEN_DIR = join(HERE, "..", "src", "app", "(auth)", "[eventId]");
const SCREEN = join(SCREEN_DIR, "badges.tsx");
const COMPONENT_DIR = join(HERE, "..", "src", "components", "badges");

/** 去掉區塊註解（理由同 `org-role-contract.test.mjs`：鎖程式碼，不鎖散文）。 */
function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 從原始碼抓出 `nfcService.<method>(` 的方法名集合。 */
function nfcServiceMethodsIn(source) {
  const found = new Set();
  for (const match of source.matchAll(/nfcService\s*\.\s*(\w+)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
}

test("badges.tsx 對 nfcService 的呼叫集合恰好是那六個方法", () => {
  const methods = nfcServiceMethodsIn(
    stripBlockComments(readFileSync(SCREEN, "utf8")),
  );

  assert.deepEqual([...methods].sort(), [
    "claimBadges",
    "completeBatch",
    "createBatch",
    "exportBadges",
    "listBadges",
    "lookup",
  ]);
});

test("badges.tsx 只透過 service 打後端，沒有直接拿 apiClient", () => {
  const source = stripBlockComments(readFileSync(SCREEN, "utf8"));

  assert.equal(
    /apiClient\./.test(source),
    false,
    "badges.tsx 直接用了 apiClient，繞過了 service 層的契約",
  );
  assert.equal(
    /from "@\/services\/api"/.test(source),
    false,
    "badges.tsx 直接 import 了 apiClient 模組",
  );
});

test("badges.tsx 沒有自己去組 /api/v1/events 路徑", () => {
  const source = stripBlockComments(readFileSync(SCREEN, "utf8"));

  assert.equal(
    /\/api\/v1\/events/.test(source),
    false,
    "畫面上出現了硬寫的 API 路徑——那條路徑不會被契約閘門掃到（它只掃 services/）",
  );
});

test("src/components/badges/ 底下沒有任何直接打後端的程式碼", () => {
  const files = readdirSync(COMPONENT_DIR).filter((name) =>
    name.endsWith(".tsx"),
  );

  assert.ok(files.length > 0, "components/badges 應該是空的？");

  for (const file of files) {
    const source = stripBlockComments(
      readFileSync(join(COMPONENT_DIR, file), "utf8"),
    );
    assert.equal(
      /apiClient\./.test(source),
      false,
      `${file} 直接用了 apiClient，繞過了 service 層`,
    );
    assert.equal(
      /\/api\/v1\/events/.test(source),
      false,
      `${file} 硬寫了 API 路徑，契約閘門掃不到它`,
    );
  }
});

// ---------------------------------------------------------------------------
// 四、統計失敗不得靜默（R4）
// ---------------------------------------------------------------------------

/**
 * 統計請求失敗時，`badges.tsx` 必須**保留**舊數字並標記成過期。
 *
 * 為什麼用原始碼切片而不是元件渲染：這個 repo 沒有 jsdom／RN renderer
 * （同 `check-in-write-handoff.test.mjs` 檔頭），畫面行為只能靠靜態鎖。
 *
 * 為什麼要鎖「不可以清空」：`catch { }` 與 `catch { setAllBadges([]) }` 在畫面上
 * 都「沒有錯誤訊息」，但後者會讓一次網路抽動把庫存總覽變成 0，而操作員分不出
 * 「總數真的是 0」與「這次讀不到」。前者才是對的，這條測試就是釘住它。
 *
 * 切片用**函式錨點**（`async function loadAll` → `void loadAll();`），不靠 JSX
 * 換行位置，所以 prettier 重排不會讓它變紅。
 */
test("badges.tsx：統計失敗時保留舊數字、標記過期，而不是清空或沉默", () => {
  const source = stripBlockComments(readFileSync(SCREEN, "utf8"));

  const start = source.indexOf("async function loadAll()");
  assert.ok(start >= 0, "找不到 loadAll（錨點失效會讓這條變成空轉）");
  const end = source.indexOf("void loadAll();", start);
  assert.ok(end > start, "找不到 loadAll 的結束錨點");
  const loadAll = source.slice(start, end);

  assert.match(
    loadAll,
    /setStatsStale\(true\)/,
    "統計失敗沒有標記過期 ⇒ 操作員拿過期數字下判斷",
  );
  assert.equal(
    /setAllBadges\(\s*\[\]\s*\)/.test(loadAll),
    false,
    "統計失敗清空了舊資料 ⇒ 一次網路抽動就讓庫存總覽變成 0",
  );
  // 成功一次之後必須把標記收回去，否則註記會永遠掛在畫面上。
  assert.match(loadAll, /setStatsStale\(false\)/, "成功後沒有清掉過期標記");

  // 註記本身：有渲染、有 guard（`statsReady` 之前沒有數字可標，不該先說它過期）。
  assert.ok(
    source.includes('testID="badge-stats-stale"'),
    "畫面上沒有過期註記",
  );
  assert.match(
    source,
    /statsReady\s*&&\s*statsStale/,
    "過期註記沒有 statsReady 守衛 ⇒ 首次載入失敗時會同時顯示「—」與「以上是上次的數字」",
  );
  assert.ok(
    source.includes("copy.badges.statsStale"),
    "註記用了硬編字串而不是 copy.badges.statsStale",
  );
});
