/**
 * `GET /:eventId/manage-stats` 的 wire 契約 + overview 的推導規則（parity §G-10）。
 *
 * 兩件事一起鎖在這裡，因為它們是同一個缺陷的兩半：
 *
 * 1. **服務層**：overview 原本為了「報名總數」與「已報到」各打一次
 *    `getRegistrations({limit: 1})` 讀 `pagination.total`——兩支請求換兩個整數。
 *    現在改成一支 `manage-stats`。端點路徑與 unwrap 方式要能被觀察，否則哪天
 *    又有人「順手」加回列表請求，沒有東西會叫。
 * 2. **推導層**：`deriveRegistrationCounts` 的「缺 key ≠ 0」規則。畫面檔驗不到
 *    邊界行為（AdminApp 是 `node:test`，無 jsdom／RN renderer），所以規則住在
 *    `src/utils/manage-stats.ts`，由這裡守。
 *
 * 只 mock `@/services/api`。`event.service.ts` 對 `@/types/api.types` 是
 * `import type`（編譯期抹除），純 Node 不需要載入型別模組。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 url 記在這裡，供斷言觀察；`nextData` 控制下一次回應。 */
const calls = [];
let nextData = {};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ url });
        return { data: { data: nextData } };
      },
    },
  },
});

const { eventService } = await import("@/services/event.service");
const { deriveRegistrationCounts } = await import("@/utils/manage-stats");

test("打 /api/v1/events/:eventId/manage-stats（eventId 需 URL-encode）", async () => {
  calls.length = 0;
  nextData = {};

  await eventService.getEventManageStats("evt 1/2");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/v1/events/evt%201%2F2/manage-stats");
});

test("unwrap 回應外層：回傳的是 data.data，不是整包 ApiResponse", async () => {
  calls.length = 0;
  nextData = {
    registrations: { total: 12, byStatus: { CONFIRMED: 9, CHECKED_IN: 4 } },
    exhibitors: { total: 3, byStatus: { APPROVED: 3 } },
    bankTransfers: { total: 1, byStatus: { PENDING: 1 } },
  };

  const stats = await eventService.getEventManageStats("evt-1");

  assert.deepEqual(stats, nextData);
  // 沒有多包一層 data / 沒有把 `_meta` 之類的東西混進來
  assert.equal(Object.hasOwn(stats, "data"), false);
});

test("成功解析：total 與已報到各自取對欄位（不靠列表端點的 pagination.total）", () => {
  const counts = deriveRegistrationCounts(
    {
      registrations: { total: 12, byStatus: { CONFIRMED: 9, CHECKED_IN: 4 } },
      exhibitors: { total: 0, byStatus: {} },
      bankTransfers: { total: 0, byStatus: {} },
    },
    null,
  );

  assert.deepEqual(counts, { total: 12, checkedIn: 4 });
});

test("byStatus 缺 CHECKED_IN → checkedIn 為 null（顯示破折號），不是 0", () => {
  const counts = deriveRegistrationCounts(
    {
      registrations: { total: 7, byStatus: { CONFIRMED: 7 } },
      exhibitors: { total: 0, byStatus: {} },
      bankTransfers: { total: 0, byStatus: {} },
    },
    99,
  );

  assert.equal(counts.total, 7, "total 仍取回應值，不退回 fallback");
  assert.equal(counts.checkedIn, null, "缺 key 不得謊報 0 筆");
});

test("registrations 整個缺 → total 退回 fallback、checkedIn 為 null", () => {
  const counts = deriveRegistrationCounts({}, 99);

  assert.deepEqual(counts, { total: 99, checkedIn: null });
});

test("stats 為 null／undefined（載入失敗）→ 兩者皆 null，不用 fallback 猜總數", () => {
  assert.deepEqual(deriveRegistrationCounts(null, 99), {
    total: 99,
    checkedIn: null,
  });
  assert.deepEqual(deriveRegistrationCounts(undefined, null), {
    total: null,
    checkedIn: null,
  });
});

test("total 為 0 時保留 0（真的沒人報名 ≠ 讀不到）", () => {
  const counts = deriveRegistrationCounts(
    {
      registrations: { total: 0, byStatus: {} },
      exhibitors: { total: 0, byStatus: {} },
      bankTransfers: { total: 0, byStatus: {} },
    },
    99,
  );

  assert.deepEqual(counts, { total: 0, checkedIn: null });
});
