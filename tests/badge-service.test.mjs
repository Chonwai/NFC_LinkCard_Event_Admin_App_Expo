/**
 * `nfcService` 的 **badge 批次四支呼叫**語意測試（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 *
 * 這四支是這次「`badges` 能力對齊」新增的全部寫入面，而每一支都有一個
 * TypeScript 看不到的坑：
 *
 * 1. **`createBatch` 的 body 只能是那四個鍵，而且 `undefined` 要整鍵消失。**
 *    後端 `CreateNfcBatchDto` 是 `@IsOptional()`；送 `badgeType: undefined` 經
 *    `JSON.stringify` 會消失（無害），但送 `colorCode: ""` 會被
 *    `@IsHexColor()` 打成 422。所以「沒填就不送」是契約，不是風格。
 * 2. **`completeBatch` 的 `updated` 一定是陣列，且 `realTagUid` 原樣透傳。**
 *    這一步把手環寫成一次性資產；任何人「順手」把 UID 轉大小寫或去空白，
 *    現場就有一批手環永遠對不上。後端大小寫敏感，本地一律不動。
 * 3. **`claimBadges` 的鍵名是 `badgeIds`／`exhibitorId`**（複數 s），
 *    對照 Web 的 `claimNfcBadge(eventId, { badgeIds, exhibitorId })`。
 * 4. **`exportBadges` 沒參數時仍帶 `?`**（`.../nfc/badges/export?`），與同檔
 *    `listBadges` 一致而**與 Web 的"有 query 才接 `?`"不同**。這一條不是風格偏好：
 *    條件式版本只能寫成嵌套模板字串，而全域契約掃描器抽呼叫的方式是「定位
 *    動詞後往後抓第一個字串字面」，内層反引號會把比對截斷、造成誤紅（見
 *    `src/services/nfc.service.ts` 裡面那一段說明）。兩者刻意不同，寫在同一支
 *    測試裡才不會有人「統一」掉其中一個。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是全域 `npm run check:contract` 與
 *   `tests/badge-contract.test.mjs` 的事。
 * - **不驗**「按下確認前有沒有先問」——那是 `badges.tsx` 的 dialog 與
 *   `src/utils/badge-inventory.ts` 純函式的事。
 * - **不驗**權限。App 不自行猜權限，一律讓後端回 403。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, payload) 都記在這裡，供斷言觀察。 */
const calls = [];

const BADGE = {
  id: "bd-1",
  eventId: "evt-1",
  tagUid: "TAG-0001",
  qrCode: "QR-0001",
  badgeType: "WRISTBAND",
  status: "UNASSIGNED",
  registrationId: null,
  assignedExhibitorId: null,
  batchId: "bt-1",
  batchLabel: "StartupFest 第一批",
  boundAt: null,
  writtenAt: "2026-11-01T02:00:00.000Z",
  createdAt: "2026-11-01T01:00:00.000Z",
};

const PAGINATION = { total: 120, page: 1, pageSize: 20, pages: 6 };

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url });
        if (url.includes("/nfc/badges/export")) {
          return {
            data: { data: { csv: "tagUid,status\nTAG-0001,UNASSIGNED" } },
          };
        }
        return {
          data: { data: { badges: [BADGE], pagination: PAGINATION } },
        };
      },
      post: async (url, payload) => {
        calls.push({ method: "POST", url, payload });
        if (url.endsWith("/nfc/batch/claim")) {
          return { data: { data: { claimedCount: payload.badgeIds.length } } };
        }
        if (url.includes("/complete")) {
          return {
            data: {
              data: {
                updatedCount: payload.updated.length,
                failures: [],
              },
            },
          };
        }
        return {
          data: {
            data: {
              batchId: "bt-9",
              batchLabel: payload.batchLabel ?? null,
              count: payload.count,
              badges: [{ id: "bd-9", tagUid: "TAG-0009", qrCode: null }],
            },
          },
        };
      },
    },
  },
});

const { nfcService } = await import("@/services/nfc.service");

const BASE = "/api/v1/events/evt-1";

// ---------------------------------------------------------------------------
// 一、清單：分頁形狀照 Web，且 `all` 是獨立旗標
// ---------------------------------------------------------------------------

test("listBadges: 帶 page／pageSize，路徑是 /nfc/badges", async () => {
  calls.length = 0;
  const res = await nfcService.listBadges("evt-1", { page: 2, pageSize: 20 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, `${BASE}/nfc/badges?page=2&pageSize=20`);
  assert.equal(res.pagination.total, 120);
  assert.equal(res.badges[0].id, "bd-1");
});

test("listBadges: `all: true` 送 all=true（統計／批次聚合用，與 Web 同義）", async () => {
  calls.length = 0;
  await nfcService.listBadges("evt-1", { all: true });

  assert.equal(calls[0].url, `${BASE}/nfc/badges?all=true`);
});

test("listBadges: status 篩選原樣透傳（不轉大寫、不映射）", async () => {
  calls.length = 0;
  await nfcService.listBadges("evt-1", {
    page: 1,
    pageSize: 50,
    status: "UNASSIGNED",
  });

  assert.equal(
    calls[0].url,
    `${BASE}/nfc/badges?page=1&pageSize=50&status=UNASSIGNED`,
  );
});

test("listBadges: 沒有參數時仍帶 `?`（既有形狀，不改）", async () => {
  calls.length = 0;
  await nfcService.listBadges("evt-1");

  assert.equal(calls[0].url, `${BASE}/nfc/badges?`);
});

test("listBadges: 回傳列保留 writtenAt／batchId／assignedExhibitorId（畫面要靠它們算統計）", async () => {
  calls.length = 0;
  const res = await nfcService.listBadges("evt-1", { all: true });

  const row = res.badges[0];
  assert.equal(row.writtenAt, "2026-11-01T02:00:00.000Z");
  assert.equal(row.batchId, "bt-1");
  assert.equal(row.assignedExhibitorId, null);
  assert.equal(row.badgeType, "WRISTBAND");
});

// ---------------------------------------------------------------------------
// 二、建立批次：body 恰好四個鍵，沒填的不送
// ---------------------------------------------------------------------------

test("createBatch: 只有 count 時 body 恰好一個鍵（badgeType／colorCode／batchLabel 不送）", async () => {
  calls.length = 0;
  await nfcService.createBatch("evt-1", { count: 50 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, `${BASE}/nfc/batch`);
  assert.deepEqual(Object.keys(calls[0].payload), ["count"]);
  assert.equal(calls[0].payload.count, 50);
});

test("createBatch: 四個鍵都給時原樣透傳（含 batchLabel 的中文與空白）", async () => {
  calls.length = 0;
  await nfcService.createBatch("evt-1", {
    count: 120,
    badgeType: "WRISTBAND",
    colorCode: "#7C3AED",
    batchLabel: "  StartupFest 第一批  ",
  });

  assert.deepEqual(Object.keys(calls[0].payload).sort(), [
    "badgeType",
    "batchLabel",
    "colorCode",
    "count",
  ]);
  assert.equal(calls[0].payload.batchLabel, "  StartupFest 第一批  ");
  assert.equal(calls[0].payload.colorCode, "#7C3AED");
});

test("createBatch: 空字串的 colorCode 不送（避免後端 @IsHexColor 打成 422）", async () => {
  calls.length = 0;
  await nfcService.createBatch("evt-1", { count: 10, colorCode: "" });

  assert.deepEqual(Object.keys(calls[0].payload), ["count"]);
});

// ---------------------------------------------------------------------------
// 三、完成批次：realTagUid 原樣透傳
// ---------------------------------------------------------------------------

test("completeBatch: 路徑含 batchId，body 是 { updated }", async () => {
  calls.length = 0;
  const res = await nfcService.completeBatch("evt-1", "bt-1", {
    updated: [{ badgeId: "bd-1", realTagUid: "04a2b3c4" }],
  });

  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, `${BASE}/nfc/batch/bt-1/complete`);
  assert.deepEqual(calls[0].payload, {
    updated: [{ badgeId: "bd-1", realTagUid: "04a2b3c4" }],
  });
  assert.equal(res.updatedCount, 1);
  assert.deepEqual(res.failures, []);
});

test("completeBatch: realTagUid 不轉大小寫、不 trim（後端大小寫敏感，手環一次性）", async () => {
  calls.length = 0;
  await nfcService.completeBatch("evt-1", "bt-1", {
    updated: [{ badgeId: "bd-1", realTagUid: "  04A2B3c4  " }],
  });

  assert.equal(calls[0].payload.updated[0].realTagUid, "  04A2B3c4  ");
});

test("completeBatch: 多筆維持原順序（後端逐筆套用，順序即錯誤回報的順序）", async () => {
  calls.length = 0;
  const updated = [
    { badgeId: "bd-2", realTagUid: "U2" },
    { badgeId: "bd-1", realTagUid: "U1" },
  ];
  await nfcService.completeBatch("evt-1", "bt-1", { updated });

  assert.deepEqual(
    calls[0].payload.updated.map((u) => u.badgeId),
    ["bd-2", "bd-1"],
  );
});

test("completeBatch: batchId 會被 URL 編碼（不會拼出雙斜線或空白路徑）", async () => {
  calls.length = 0;
  await nfcService.completeBatch("evt-1", "bt/1", { updated: [] });

  assert.equal(calls[0].url, `${BASE}/nfc/batch/bt%2F1/complete`);
});

// ---------------------------------------------------------------------------
// 四、指派展商：鍵名是 badgeIds（複數）
// ---------------------------------------------------------------------------

test("claimBadges: POST /nfc/batch/claim，body 恰好 badgeIds + exhibitorId", async () => {
  calls.length = 0;
  const res = await nfcService.claimBadges("evt-1", {
    badgeIds: ["bd-1", "bd-2"],
    exhibitorId: "ex-1",
  });

  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, `${BASE}/nfc/batch/claim`);
  assert.deepEqual(Object.keys(calls[0].payload).sort(), [
    "badgeIds",
    "exhibitorId",
  ]);
  assert.deepEqual(calls[0].payload.badgeIds, ["bd-1", "bd-2"]);
  assert.equal(res.claimedCount, 2);
});

test("claimBadges: 空陣列照送（後端會回 claimedCount: 0，不在前端假裝成功）", async () => {
  calls.length = 0;
  const res = await nfcService.claimBadges("evt-1", {
    badgeIds: [],
    exhibitorId: "ex-1",
  });

  assert.deepEqual(calls[0].payload.badgeIds, []);
  assert.equal(res.claimedCount, 0);
});

// ---------------------------------------------------------------------------
// 五、匯出：沒參數就不帶 `?`（與 listBadges 刻意不同）
// ---------------------------------------------------------------------------

test("exportBadges: 沒有參數時仍帶 `?`（與同檔 listBadges 一致；空 query 等於沒有 query）", async () => {
  calls.length = 0;
  await nfcService.exportBadges("evt-1");

  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, `${BASE}/nfc/badges/export?`);
});

test("exportBadges: status 篩選透傳，csv 原樣回傳（不解析、不加 BOM）", async () => {
  calls.length = 0;
  const res = await nfcService.exportBadges("evt-1", { status: "BOUND" });

  assert.equal(calls[0].url, `${BASE}/nfc/badges/export?status=BOUND`);
  assert.equal(res.csv, "tagUid,status\nTAG-0001,UNASSIGNED");
});
