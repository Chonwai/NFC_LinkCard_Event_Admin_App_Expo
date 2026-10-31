/**
 * 篩選狀態 → 查詢參數的**收斂規則**鎖定。
 *
 * 這條規則決定「畫面上選『全部』時，到底有沒有送條件給後端」。它先前是畫面裡
 * 一段段 `...(x !== 'all' ? { x } : {})` 的內聯展開，三條載入路徑（首次／下拉
 * 更新／載入更多）各寫一次——只要有一處漏了，篩選就只會在那一條路徑上失效。
 *
 * 斷言的重點不是「有送」而是「**沒送**」：把「不篩」寫成一條實際條件，日後
 * 後端收緊值域（例如不再接受 `depositRefunded=all`）就會 400。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { buildRegistrationListQuery, DEFAULT_REGISTRATION_FILTERS } =
  await import("@/utils/registration-filters");

test("預設只送 visibility=active：其餘三個篩選都不該出現在查詢裡", () => {
  assert.deepEqual(buildRegistrationListQuery(DEFAULT_REGISTRATION_FILTERS), {
    visibility: "active",
  });
});

test("狀態空字串＝全部，不得送出空的 status 參數", () => {
  const query = buildRegistrationListQuery({
    ...DEFAULT_REGISTRATION_FILTERS,
    status: "",
  });
  assert.equal("status" in query, false);
});

test("狀態有值時原樣送出", () => {
  const query = buildRegistrationListQuery({
    ...DEFAULT_REGISTRATION_FILTERS,
    status: "CHECKED_IN",
  });
  assert.equal(query.status, "CHECKED_IN");
});

test("票種 all 不送；選了具體票種才送 ticketTypeId", () => {
  assert.equal(
    "ticketTypeId" in
      buildRegistrationListQuery({
        ...DEFAULT_REGISTRATION_FILTERS,
        ticketTypeId: "all",
      }),
    false,
  );
  assert.equal(
    buildRegistrationListQuery({
      ...DEFAULT_REGISTRATION_FILTERS,
      ticketTypeId: "tt-1",
    }).ticketTypeId,
    "tt-1",
  );
});

test("押金退款 all 不送；refunded / not_refunded 原樣送出", () => {
  assert.equal(
    "depositRefunded" in
      buildRegistrationListQuery({
        ...DEFAULT_REGISTRATION_FILTERS,
        depositRefunded: "all",
      }),
    false,
  );
  assert.equal(
    buildRegistrationListQuery({
      ...DEFAULT_REGISTRATION_FILTERS,
      depositRefunded: "refunded",
    }).depositRefunded,
    "refunded",
  );
  assert.equal(
    buildRegistrationListQuery({
      ...DEFAULT_REGISTRATION_FILTERS,
      depositRefunded: "not_refunded",
    }).depositRefunded,
    "not_refunded",
  );
});

test("可見性永遠送出，連 all 也一樣（寫明這一頁在看什麼）", () => {
  for (const visibility of ["all", "active", "hidden", "archived"]) {
    assert.equal(
      buildRegistrationListQuery({
        ...DEFAULT_REGISTRATION_FILTERS,
        visibility,
      }).visibility,
      visibility,
    );
  }
});
