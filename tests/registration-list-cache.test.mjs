/**
 * 名單快取的**語意**鎖定。
 *
 * 這個快取存在的唯一理由：詳情頁需要的欄位（`isHidden`／`archivedAt`／
 * `depositRefunded*`／`emailStatus`）**只**在名單端點出現，而後端沒有
 * 「用 id 取完整詳情」的端點。快取錯了不會拋錯，只會讓詳情頁顯示別人的資料、
 * 或顯示上一頁的舊資料——兩者都很難在畫面上看出來。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  clearRegistrationListCache,
  findRememberedRegistration,
  rememberRegistrationList,
} = await import("@/utils/registration-list-cache");

test("沒載入過 ⇒ null（呼叫端必須自己處理「沒有」的情況）", () => {
  clearRegistrationListCache();
  assert.equal(findRememberedRegistration("evt-1", "reg-1"), null);
});

test("記住之後可以按 id 取回整筆", () => {
  clearRegistrationListCache();
  rememberRegistrationList("evt-1", [
    { id: "reg-1", registrationCode: "A1", status: "CONFIRMED" },
  ]);
  const found = findRememberedRegistration("evt-1", "reg-1");
  assert.equal(found?.registrationCode, "A1");
});

test("取回的是完整那一列（擴充欄位不會被截掉）", () => {
  clearRegistrationListCache();
  rememberRegistrationList("evt-1", [
    {
      id: "reg-1",
      registrationCode: "A1",
      status: "CONFIRMED",
      isHidden: true,
      hiddenReason: "重複報名",
      depositRefundedAt: "2026-10-30T00:00:00.000Z",
      depositRefundedAmount: "500",
    },
  ]);
  const found = findRememberedRegistration("evt-1", "reg-1");
  assert.equal(found?.isHidden, true);
  assert.equal(found?.hiddenReason, "重複報名");
  assert.equal(found?.depositRefundedAmount, "500");
});

test("活動不符 ⇒ null（避免跨活動誤命中）", () => {
  clearRegistrationListCache();
  rememberRegistrationList("evt-1", [
    { id: "reg-1", registrationCode: "A1", status: "CONFIRMED" },
  ]);
  assert.equal(findRememberedRegistration("evt-2", "reg-1"), null);
});

test("沒帶 id ⇒ null，不會回傳「某一筆」充數", () => {
  clearRegistrationListCache();
  rememberRegistrationList("evt-1", [
    { id: "reg-1", registrationCode: "A1", status: "CONFIRMED" },
  ]);
  assert.equal(findRememberedRegistration("evt-1", undefined), null);
  assert.equal(findRememberedRegistration(undefined, "reg-1"), null);
});

test("整批取代：上一頁的資料不會殘留（翻頁後不該再看到舊頁的人）", () => {
  clearRegistrationListCache();
  rememberRegistrationList("evt-1", [
    { id: "reg-1", registrationCode: "A1", status: "CONFIRMED" },
  ]);
  rememberRegistrationList("evt-1", [
    { id: "reg-2", registrationCode: "B2", status: "CONFIRMED" },
  ]);
  assert.equal(findRememberedRegistration("evt-1", "reg-1"), null);
  assert.equal(
    findRememberedRegistration("evt-1", "reg-2")?.registrationCode,
    "B2",
  );
});

test("沒有 id 的列被略過，不會覆蓋既有資料", () => {
  clearRegistrationListCache();
  rememberRegistrationList("evt-1", [
    { registrationCode: "NOID", status: "CONFIRMED" },
    { id: "reg-1", registrationCode: "A1", status: "CONFIRMED" },
  ]);
  assert.equal(
    findRememberedRegistration("evt-1", "reg-1")?.registrationCode,
    "A1",
  );
});
