/**
 * 展商（`exhibitors`）的**呼叫契約鎖**：method + 路徑形狀逐條釘住。
 *
 * ## 為什麼要另一份鎖
 * `tests/exhibitor-service.test.mjs` 測的是**語意**（body 欄位集合、`mode` 的
 * 字面值、哪幾支不帶 body）。這一支只問兩件更窄的事：
 *
 * 1. **地址沒搬家、守備範圍沒變大**：`exhibitor.service.ts` 的呼叫形狀恰好是
 *    那六條，而且每一條都真的存在於 `scripts/backend-routes.snapshot.json`。
 * 2. **畫面不打沒人 review 過的呼叫**：兩個畫面用到的 `exhibitorService` 方法
 *    恰好是這六個。
 *
 * ## 為什麼「恰好六條」值得單獨釘
 *
 * 後端在 `/exhibitors` 底下有 **28 條**路由。Web 的管理頁與匯入頁只用六條，
 * 其餘的是展商入口（`page-sections`／`members`／`company-page`）、公開名錄
 *（單筆 `GET …/exhibitors/:slug`）與 kiosk 匯出（`GET …/export/exhibitors`）。
 *
 * 那些端點不是壞東西——多接一條就是**在 App 上開一條 Web 主辦端沒有的寫入
 * 路徑**。最危險的兩條是：
 *
 * - 改公司資料那一條（`PATCH …/exhibitors/:id`）：一次送錯欄位就能清掉
 *   Logo／橫幅，而且它沒有 `status` 那條的 DTO 白名單。
 * - 重發邀請那一條（`POST …/members/:memberId/resend`）：這正是 Web 邀請徽章
 *   旁邊那顆「重發邀請」在打的端點，但那個入口在展商入口頁，不在管理頁。
 *
 * 全域閘門 `npm run check:contract` 驗的是「App 每一條呼叫都存在於後端快照」。
 * 它的盲點是**不會紅在「多呼叫了什麼」**——上面那些都真的存在，加進來照樣是
 * 綠的。所以範圍要由這一支自己鎖。
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
const APP_ROOT = join(HERE, "..");
const SNAPSHOT = JSON.parse(
  readFileSync(
    join(APP_ROOT, "scripts", "backend-routes.snapshot.json"),
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
 * 六條呼叫的期望形狀。`*` 代表路徑參數（eventId／exhibitorId）。
 *
 * 1 讀 + 1 覆核 + 4 匯入，與
 * `LinkCard_Frontend/lib/events/exhibitors.ts:247` 的 `listAllExhibitorsAdmin`、
 * `:93` 的 `updateExhibitorStatus`、以及 `lib/events/exhibitorImport.ts` 的
 * 四支匯入呼叫一一對應。**它們是這個能力的全部**；理由見檔頭。
 */
const EXPECTED = [
  "GET */exhibitors",
  "PATCH */exhibitors/*/status",
  "POST */exhibitors/import/preview",
  "POST */exhibitors/import/confirm",
  "POST */exhibitors/import/notify",
  "GET */exhibitors/import/template",
];

/** 呼叫端（畫面）引用到的 service 方法名。 */
const ALLOWED_METHODS = new Set([
  "listExhibitors",
  "updateExhibitorStatus",
  "previewImport",
  "confirmImport",
  "notifyImport",
  "downloadImportTemplate",
]);

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

function exhibitorCalls() {
  return extractAppCalls().filter(
    (call) => call.file === "exhibitor.service.ts",
  );
}

// ---------------------------------------------------------------------------
// 一、地址鎖：service 的六條呼叫，形狀恰好是那六個，且後端真的有
// ---------------------------------------------------------------------------

test("exhibitor.service.ts 恰好有六條呼叫", () => {
  assert.equal(
    exhibitorCalls().length,
    6,
    `exhibitor.service.ts 應該有 6 條 apiClient 呼叫（1 讀 1 覆核 4 匯入），實際 ${exhibitorCalls().length}`,
  );
});

test("六條呼叫的 method + 路徑形狀與後端 exhibitors 路由逐一對上", () => {
  assert.deepEqual(
    exhibitorCalls().map(callShape).sort(),
    [...EXPECTED].sort(),
    "exhibitor.service.ts 的呼叫形狀變了——請確認是真的要改契約，而不是打錯字",
  );
});

test("六條呼叫每一條都存在於後端路由快照（不是自創的路徑）", () => {
  for (const call of exhibitorCalls()) {
    const key = callShape(call);
    assert.ok(
      BACKEND_KEYS.has(key),
      `${call.method} ${call.raw}（形狀 ${key}）不在後端路由快照裡——這是一條死路徑`,
    );
  }
});

test("沒有打展商入口的端點：page-sections／members／company-page／export", () => {
  for (const call of exhibitorCalls()) {
    for (const forbidden of [
      "page-sections",
      "members",
      "company-page",
      "export",
      "my-access",
    ]) {
      assert.equal(
        call.raw.includes(forbidden),
        false,
        `${call.method} ${call.raw} 打了展商入口的 ${forbidden}——那不是主辦管理頁的能力`,
      );
    }
  }
});

test("PATCH 只打 /status，沒有打「改公司資料」那一條", () => {
  const patches = exhibitorCalls().filter((call) => call.method === "PATCH");
  assert.equal(patches.length, 1, "只該有一條 PATCH（覆核狀態）");
  assert.equal(
    callShape(patches[0]),
    "PATCH */exhibitors/*/status",
    "PATCH */exhibitors/* 沒有 DTO 白名單，一次送錯欄位就能清掉 Logo／橫幅",
  );
});

// ---------------------------------------------------------------------------
// 二、呼叫端鎖：畫面只用到這六個方法
// ---------------------------------------------------------------------------

test("展商畫面與匯入面板只呼叫這六個 service 方法", () => {
  const files = [
    join(APP_ROOT, "src", "app", "(auth)", "[eventId]", "exhibitors.tsx"),
    join(APP_ROOT, "src", "components", "roster", "ExhibitorImportModal.tsx"),
  ];

  const used = new Set();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/exhibitorService\.(\w+)/g)) {
      used.add(match[1]);
    }
  }

  assert.ok(used.size > 0, "掃描器沒抓到任何呼叫——空轉守衛");
  for (const method of used) {
    assert.ok(
      ALLOWED_METHODS.has(method),
      `畫面呼叫了 exhibitorService.${method}，它不在鎖定的六支裡`,
    );
  }
});
