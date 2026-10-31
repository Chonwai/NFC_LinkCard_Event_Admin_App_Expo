/**
 * `exhibitorService` 的**語意測試**（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 * 展商這六支呼叫有兩個「TypeScript 看不到」的坑：
 *
 * 1. **body 的欄位集合**。後端 `ReviewExhibitorStatusDto` 只有 `status` 一個
 *    欄位；多送的鍵會被忽略——這一點比內容服務安全（那邊是 `hasOwn` 語意，
 *    多送 `null` 會清空）。但「App 送了 Web 沒送的欄位」仍然是能力漂移，
 *    所以照樣釘住確切的 key 集合。
 * 2. **`mode` 這個字串**。後端 `EventExhibitorImportController.confirm` 對
 *    「有送 `mode` 但不等於 `skip_existing`」是**明確拒絕**（400），不是靜默
 *    降級。打錯一個字就是整個匯入失敗，而 `tsc` 只會看到它是一個 `string`。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是 `tests/exhibitor-contract.test.mjs`
 *   與全域 `npm run check:contract` 的事。
 * - **不驗** CSV 內容、逐列錯誤的呈現——那是畫面與 util 的事。
 *
 * 兩支都要綠才算這個能力完整。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, payload) 都記在這裡，供斷言觀察。 */
const calls = [];

/**
 * 列表回傳的廠商。刻意帶一個**非 ACTIVE** 的狀態與非 null 的 `boothNumber`：
 * 只有這樣才驗得出來「篩選狀態有沒有被轉發」與「回傳值有沒有被改寫」。
 */
const EXHIBITOR = {
  id: "exh-1",
  eventId: "evt-1",
  companyName: "範例科技",
  slug: "example-tech",
  description: null,
  logo: null,
  banner: null,
  isPublic: true,
  exhibitorType: "ENTERPRISE",
  status: "PENDING_APPROVAL",
  boothNumber: "B12",
  boothLocation: "2 號館",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const PAGINATION = { total: 1, page: 1, limit: 100, pages: 1 };

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url, config) => {
        calls.push({ method: "GET", url, payload: config });
        // 模板端點回的是純文字，不是信封——分流回傳才驗得出 `responseType`。
        if (url.endsWith("/template")) {
          return { data: "\uFEFF公司名稱,Email" };
        }
        return {
          data: { data: { exhibitors: [EXHIBITOR], pagination: PAGINATION } },
        };
      },
      post: async (url, payload, config) => {
        calls.push({ method: "POST", url, payload, config });
        return { data: { data: { ok: true } } };
      },
      patch: async (url, payload) => {
        calls.push({ method: "PATCH", url, payload });
        return {
          data: { data: { exhibitor: { id: "exh-1", status: "ACTIVE" } } },
        };
      },
    },
  },
});

const { exhibitorService } = await import("@/services/exhibitor.service");
const { EXHIBITOR_IMPORT_CONFIRM_MODE } =
  await import("@/types/exhibitor.types");

const BASE = "/api/v1/events/evt-1/exhibitors";

/** 選好的一個檔案（Node 沒有真的 URI，值只需可辨識）。 */
const FILE = {
  uri: "file:///tmp/exhibitors.csv",
  name: "exhibitors.csv",
  mimeType: "text/csv",
};

// ---------------------------------------------------------------------------
// 一、方法、路徑與 payload（每支都恰好打一次）
// ---------------------------------------------------------------------------

test("listExhibitors: GET /exhibitors 並把 status 與 limit 轉發到 params", async () => {
  calls.length = 0;
  await exhibitorService.listExhibitors("evt-1", {
    status: "PENDING_APPROVAL",
    limit: 100,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, BASE);
  assert.deepEqual(calls[0].payload, {
    params: { status: "PENDING_APPROVAL", limit: 100 },
  });
});

test("updateExhibitorStatus: PATCH /:id/status，body 恰好一個鍵 status", async () => {
  calls.length = 0;
  await exhibitorService.updateExhibitorStatus("evt-1", "exh-1", "ACTIVE");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, `${BASE}/exh-1/status`);
  assert.deepEqual(Object.keys(calls[0].payload), ["status"]);
  assert.equal(calls[0].payload.status, "ACTIVE");
});

test("previewImport: POST /import/preview，multipart 只帶 file（不帶 mode）", async () => {
  calls.length = 0;
  await exhibitorService.previewImport("evt-1", FILE);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, `${BASE}/import/preview`);
  assert.ok(calls[0].payload instanceof FormData, "payload 必須是 FormData");
  assert.equal(calls[0].payload.has("file"), true);
  assert.equal(
    calls[0].payload.has("mode"),
    false,
    "預覽不該帶 mode——後端 preview 不解讀它，送了就是多餘欄位",
  );
  assert.deepEqual(calls[0].config.headers, {
    "Content-Type": "multipart/form-data",
  });
});

test("confirmImport: POST /import/confirm，multipart 帶 file 與 mode=skip_existing", async () => {
  calls.length = 0;
  await exhibitorService.confirmImport("evt-1", FILE);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, `${BASE}/import/confirm`);
  assert.ok(calls[0].payload instanceof FormData);
  assert.equal(calls[0].payload.has("file"), true);
  assert.equal(
    calls[0].payload.get("mode"),
    "skip_existing",
    "mode 打錯一個字，後端就是 400 明確拒絕（不是靜默降級）",
  );
  assert.equal(EXHIBITOR_IMPORT_CONFIRM_MODE, "skip_existing");
});

test("notifyImport: POST /import/notify，body 恰好一個鍵 memberIds", async () => {
  calls.length = 0;
  await exhibitorService.notifyImport("evt-1", ["mem-1", "mem-2"]);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, `${BASE}/import/notify`);
  assert.deepEqual(Object.keys(calls[0].payload), ["memberIds"]);
  assert.deepEqual(calls[0].payload.memberIds, ["mem-1", "mem-2"]);
});

test("downloadImportTemplate: GET /import/template，responseType 必須是 text", async () => {
  calls.length = 0;
  const csv = await exhibitorService.downloadImportTemplate("evt-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, `${BASE}/import/template`);
  assert.equal(
    calls[0].payload.responseType,
    "text",
    "少了 responseType，axios 會嘗試 JSON 解析 CSV 而爆掉",
  );
  // 回傳值原樣透出（含 BOM），不 trim、不重新編碼。
  assert.equal(csv, "\uFEFF公司名稱,Email");
});

// ---------------------------------------------------------------------------
// 二、範圍鎖：恰好六支，不多不少
// ---------------------------------------------------------------------------

test("六支呼叫都存在，而且只有六支", () => {
  const names = Object.keys(exhibitorService).sort();
  assert.deepEqual(names, [
    "confirmImport",
    "downloadImportTemplate",
    "listExhibitors",
    "notifyImport",
    "previewImport",
    "updateExhibitorStatus",
  ]);
});
