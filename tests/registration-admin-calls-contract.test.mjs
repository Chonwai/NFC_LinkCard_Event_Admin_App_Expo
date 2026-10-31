/**
 * 名單管理七條呼叫的 **method + path 契約鎖**（單一表格式清單）。
 *
 * ## 為什麼要另一份鎖
 * `tests/registration-visibility-service.test.mjs` 已經逐條測了這些方法的
 * body 與回傳語意——它測的是「這條呼叫對不對」。這一支只問一件更窄的事：
 * **「這七條地址有沒有搬家」**。兩者的失敗訊息不一樣：前者會說「body 不對」，
 * 後者會說「第 3 條從 POST …/archive 變成別的東西了」。
 *
 * 為什麼值得單獨釘：`apiClient.post()` 的路徑只是字串，TypeScript 完全看不到。
 * 2026-10-22 的對等審計就是這樣發現 App 一直在呼叫一條後端從來沒有的路由
 * （`checkin/override`），而且只有活動當天才會炸。`npm run check:contract`
 * 驗的是「路徑存在於後端快照」，但它**不驗 method 與呼叫端的寫法**；
 * 這一支補上那一半。
 *
 * ## 它不會抓到什麼（誠實邊界）
 * 只驗 method + path。body 形狀、回傳欄位、錯誤碼對應**不在這裡**——
 * 那些在 `registration-visibility-service.test.mjs`。兩支都要綠才算完整。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 一律回一個「什麼欄位都有」的成功 envelope，這支測試不關心語意。 */
const okResponse = () => ({
  data: {
    data: {
      registration: { id: "reg-1" },
      csv: "registrationCode\nLC-1\n",
    },
  },
});

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url });
        return okResponse();
      },
      post: async (url) => {
        calls.push({ method: "POST", url });
        return okResponse();
      },
    },
  },
});

const { registrationService } = await import("@/services/registration.service");

/**
 * 七條呼叫的**期望值**。`{id}` 代表報名 id、`{eventId}` 代表活動 id；
 * 路徑一律相對於 `/api/v1/events/`。
 */
const EXPECTED = [
  { name: "hide", method: "POST", path: "{eventId}/registrations/{id}/hide" },
  {
    name: "unhide",
    method: "POST",
    path: "{eventId}/registrations/{id}/unhide",
  },
  {
    name: "archive",
    method: "POST",
    path: "{eventId}/registrations/{id}/archive",
  },
  {
    name: "unarchive",
    method: "POST",
    path: "{eventId}/registrations/{id}/unarchive",
  },
  {
    name: "updateStatus",
    method: "POST",
    path: "{eventId}/registrations/{id}/status",
  },
  {
    name: "markDepositRefund",
    method: "POST",
    path: "{eventId}/registrations/{id}/deposit-refund",
  },
  {
    name: "exportAttendeesCsv",
    method: "GET",
    path: "{eventId}/export/attendees",
  },
  {
    name: "previewGuestImport",
    method: "POST",
    path: "{eventId}/registrations/import/preview",
  },
  {
    name: "confirmGuestImport",
    method: "POST",
    path: "{eventId}/registrations/import/confirm",
  },
  {
    name: "notifyGuestImport",
    method: "POST",
    path: "{eventId}/registrations/import/notify",
  },
  {
    name: "downloadGuestImportTemplate",
    method: "GET",
    path: "{eventId}/registrations/import/template",
  },
];

/** 選檔在 service 層只收三個欄位；測試用一組固定值。 */
const FILE = {
  uri: "file:///tmp/guests.csv",
  name: "guests.csv",
  mimeType: "text/csv",
};

/** 依名字派出對應的呼叫（參數刻意填最小可用的值）。 */
const invoke = {
  hide: () => registrationService.hide("evt-1", "reg-1", "理由"),
  unhide: () => registrationService.unhide("evt-1", "reg-1"),
  archive: () => registrationService.archive("evt-1", "reg-1", "理由"),
  unarchive: () => registrationService.unarchive("evt-1", "reg-1"),
  updateStatus: () =>
    registrationService.updateStatus("evt-1", "reg-1", {
      targetStatus: "CHECKED_IN",
      reason: "理由",
    }),
  markDepositRefund: () =>
    registrationService.markDepositRefund("evt-1", "reg-1", { amount: 500 }),
  exportAttendeesCsv: () => registrationService.exportAttendeesCsv("evt-1"),
  previewGuestImport: () =>
    registrationService.previewGuestImport("evt-1", FILE),
  confirmGuestImport: () =>
    registrationService.confirmGuestImport("evt-1", FILE, "create"),
  notifyGuestImport: () =>
    registrationService.notifyGuestImport("evt-1", ["reg-1"]),
  downloadGuestImportTemplate: () =>
    registrationService.downloadGuestImportTemplate("evt-1"),
};

for (const expected of EXPECTED) {
  test(`${expected.name}: ${expected.method} /api/v1/events/${expected.path}`, async () => {
    calls.length = 0;
    await invoke[expected.name]();

    assert.equal(calls.length, 1, `${expected.name} 應該恰好打一次`);
    assert.equal(
      calls[0].method,
      expected.method,
      `${expected.name} 的 method`,
    );

    const relative = calls[0].url.replace(/^\/api\/v1\/events\//, "");
    const wanted = expected.path
      .replace("{eventId}", "evt-1")
      .replace("{id}", "reg-1");
    assert.equal(relative, wanted, `${expected.name} 的路徑搬家了`);
  });
}

test("十一條全部只落在 /api/v1/events/ 之下（沒有漏掉版本前綴或掉了 events 段）", async () => {
  for (const expected of EXPECTED) {
    calls.length = 0;
    await invoke[expected.name]();
    assert.ok(
      calls[0].url.startsWith("/api/v1/events/"),
      `${expected.name} → ${calls[0].url}`,
    );
  }
});
