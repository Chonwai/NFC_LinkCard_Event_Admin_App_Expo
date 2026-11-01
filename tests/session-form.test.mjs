/**
 * 場次表單的純函式測試。
 *
 * ## 為什麼要這一支
 *
 * `sessions.tsx` 的驗證與 payload 組裝全部委派給 `utils/session-form.ts`，
 * 因為這個 repo 的測試是 node test runner，沒有 React renderer——寫在 `.tsx`
 * 裡的邏輯驗不到（與 `poll-form`／`guest-import` 同一個模式）。
 *
 * 這一支釘住三件在 `tsc` 底下看不到的事：
 *
 * 1. **時間解析是本地時區**。`parseLocalDateTime` 自己拆欄位再用
 *    `new Date(y, mo-1, d, h, mi)`，不經過字串解析。若哪天有人改回
 *    `new Date(string)`，`"2026-11-05 02:00"` 在部分引擎會被當成 UTC，
 *    場次時間就會整體位移——而畫面上只會「看起來不太對」。
 * 2. **`2 月 30 日` 不會靜默變成 3 月 2 日**。JS 的 `Date` 會自動進位，
 *    不偵測就等於默默接受一個不存在的日期。
 * 3. **空字串送 `null` 而不是省略**。後端 `updateSession` 是
 *    `input.x !== undefined` 語意：省略＝不改，`null`＝清空。
 *    若這裡改成省略，「把主講人清掉」就永遠做不到。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  emptySessionForm,
  formatLocalDateTime,
  parseLocalDateTime,
  sessionFormError,
  sessionFormFrom,
  toSessionPayload,
} = await import("@/utils/session-form");

/**
 * 一個合法的最小表單。
 *
 * `price`／`tokenCost` 用 `emptySessionForm()` 的預設值（`"0"`），
 * 與 Web 的 `useState` 初始值一致。
 */
function validForm(overrides = {}) {
  return {
    ...emptySessionForm(),
    title: "開幕演講",
    startDate: "2026-11-05 10:00",
    endDate: "2026-11-05 11:00",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 一、parseLocalDateTime
// ---------------------------------------------------------------------------

test("parseLocalDateTime 把牆上時間當成本地時間，不是 UTC", () => {
  const parsed = parseLocalDateTime("2026-11-05 02:00");
  assert.ok(parsed instanceof Date);

  // 以本地時區建構同一個時刻，兩者必須相等——這條斷言與測試機器在哪個時區無關。
  const expected = new Date(2026, 10, 5, 2, 0, 0, 0);
  assert.equal(parsed.getTime(), expected.getTime());

  // 反向確認：若被當成 UTC，兩者只有在 UTC+0 的機器上才會相等。
  assert.equal(parsed.getHours(), 2, "02:00 必須是本地 2 點");
});

test("parseLocalDateTime 接受 T 分隔（與 Web 的 datetime-local 同一個字串）", () => {
  const spaced = parseLocalDateTime("2026-11-05 02:00");
  const isoish = parseLocalDateTime("2026-11-05T02:00");
  assert.ok(spaced != null && isoish != null);
  assert.equal(spaced.getTime(), isoish.getTime());
});

test("parseLocalDateTime 拒絕不存在的日期，不讓它靜默進位", () => {
  // JS 的 new Date(2026, 1, 30) 會變成 3 月 2 日。不擋就是默默接受。
  assert.equal(parseLocalDateTime("2026-02-30 10:00"), null);
  assert.equal(parseLocalDateTime("2026-04-31 10:00"), null);
});

test("parseLocalDateTime 拒絕越界與格式錯誤", () => {
  for (const bad of [
    "",
    "   ",
    "2026-11-05",
    "2026-11-05 02",
    "2026-11-05 02:00:00",
    "2026-13-05 02:00",
    "2026-11-32 02:00",
    "2026-11-05 24:00",
    "2026-11-05 02:60",
    "05/11/2026 02:00",
    "not a date",
  ]) {
    assert.equal(parseLocalDateTime(bad), null, `應該拒絕：${bad}`);
  }
});

test("parseLocalDateTime 接受 2 月 29 日（閏年）但拒絕非閏年的 2 月 29 日", () => {
  assert.ok(parseLocalDateTime("2028-02-29 10:00") != null, "2028 是閏年");
  assert.equal(parseLocalDateTime("2026-02-29 10:00"), null, "2026 不是閏年");
});

// ---------------------------------------------------------------------------
// 二、sessionFormError
// ---------------------------------------------------------------------------

test("合法表單沒有錯誤", () => {
  assert.equal(sessionFormError(validForm()), null);
});

test("標題空白 → titleRequired（順序在時間之前，與 Web 一致）", () => {
  assert.equal(
    sessionFormError(validForm({ title: "   ", startDate: "" })),
    "titleRequired",
  );
});

test("時間空白 → timeRequired", () => {
  assert.equal(sessionFormError(validForm({ startDate: "" })), "timeRequired");
  assert.equal(sessionFormError(validForm({ endDate: "" })), "timeRequired");
});

test("時間格式錯 → timeInvalid", () => {
  assert.equal(
    sessionFormError(validForm({ startDate: "2026/11/05 10:00" })),
    "timeInvalid",
  );
});

test("capacity 0 被擋下來——後端 @Min(1) 一定會 400", () => {
  // Web 的 <input type="number" min="0"> 允許填 0，送出後拿到 400，
  // 而畫面只顯示「操作失敗」。App 在送出前就講清楚。
  assert.equal(
    sessionFormError(validForm({ capacity: "0" })),
    "capacityInvalid",
  );
});

test("capacity 小數、負數、非數字都被擋", () => {
  for (const bad of ["1.5", "-3", "abc", "1e3", " "]) {
    const err = sessionFormError(validForm({ capacity: bad }));
    if (bad.trim().length === 0) {
      // 純空白等於「不限」，是合法的。
      assert.equal(err, null, "空白＝不限，應該合法");
    } else {
      assert.equal(err, "capacityInvalid", `應該擋下 capacity=${bad}`);
    }
  }
});

test("capacity 空白＝不限，合法", () => {
  assert.equal(sessionFormError(validForm({ capacity: "" })), null);
});

test("price 負數或非數字被擋，0 與小數合法", () => {
  assert.equal(sessionFormError(validForm({ price: "-1" })), "priceInvalid");
  assert.equal(sessionFormError(validForm({ price: "abc" })), "priceInvalid");
  // 價格是 Decimal(10,2)，小數是合法的。
  assert.equal(sessionFormError(validForm({ price: "1500.50" })), null);
  assert.equal(sessionFormError(validForm({ price: "0" })), null);
});

test("tokenCost 負數被擋；空白視為 0", () => {
  assert.equal(
    sessionFormError(validForm({ tokenCost: "-1" })),
    "tokenCostInvalid",
  );
  assert.equal(sessionFormError(validForm({ tokenCost: "" })), null);
});

// ---------------------------------------------------------------------------
// 三、toSessionPayload
// ---------------------------------------------------------------------------

test("合法表單組出完整的 10 鍵 payload", () => {
  const payload = toSessionPayload(validForm());

  assert.ok(payload != null);
  assert.deepEqual(Object.keys(payload).sort(), [
    "capacity",
    "description",
    "endDate",
    "location",
    "price",
    "sessionType",
    "speakerName",
    "startDate",
    "title",
    "tokenCost",
  ]);
});

test("時間以本地時間轉成 ISO 送出", () => {
  const payload = toSessionPayload(validForm());

  assert.ok(payload != null);
  // 與 parseLocalDateTime 同一個時刻——即「使用者打的本地 10:00」。
  assert.equal(
    new Date(payload.startDate).getTime(),
    new Date(2026, 10, 5, 10, 0, 0, 0).getTime(),
  );
  assert.equal(
    payload.startDate,
    new Date(2026, 10, 5, 10, 0, 0, 0).toISOString(),
    "送出的必須是 ISO 8601（後端 @IsDateString 只收這個）",
  );
});

test("空字串欄位送 null，不是省略——清空才有意義", () => {
  const payload = toSessionPayload(
    validForm({ description: "", location: "", speakerName: "" }),
  );

  assert.ok(payload != null);
  assert.equal(payload.description, null);
  assert.equal(payload.location, null);
  assert.equal(payload.speakerName, null);
  for (const key of ["description", "location", "speakerName"]) {
    assert.ok(key in payload, `${key} 必須存在於 payload（值為 null）`);
  }
});

test("capacity 空白 → null（不限），price 空白 → null", () => {
  const payload = toSessionPayload(validForm({ capacity: "", price: "" }));

  assert.ok(payload != null);
  assert.equal(payload.capacity, null);
  assert.equal(payload.price, null);
});

test("capacity 有值 → 數字；tokenCost 空白 → 0", () => {
  const payload = toSessionPayload(
    validForm({ capacity: "100", tokenCost: "" }),
  );

  assert.ok(payload != null);
  assert.equal(payload.capacity, 100);
  assert.equal(payload.tokenCost, 0, "後端 @IsInt() 不收 null，空白要給 0");
});

test("不合法表單回 null（呼叫端據此不送出請求）", () => {
  assert.equal(toSessionPayload(validForm({ title: "" })), null);
  assert.equal(toSessionPayload(validForm({ startDate: "nope" })), null);
  assert.equal(toSessionPayload(validForm({ capacity: "0" })), null);
});

test("標題前後空白會被 trim，但內文不改寫", () => {
  const payload = toSessionPayload(validForm({ title: "  開幕演講  " }));

  assert.ok(payload != null);
  assert.equal(payload.title, "開幕演講");
});

// ---------------------------------------------------------------------------
// 四、編輯回填（sessionFormFrom / formatLocalDateTime）
// ---------------------------------------------------------------------------

/** 一個後端會回的場次（`startDate` 是 ISO）。 */
const SESSION = {
  id: "ses-1",
  eventId: "evt-1",
  title: "開幕演講",
  description: "開場",
  sessionType: "KEYNOTE",
  startDate: new Date(2026, 10, 5, 10, 0, 0, 0).toISOString(),
  endDate: new Date(2026, 10, 5, 11, 0, 0, 0).toISOString(),
  location: "主舞台",
  speakerName: "王小明",
  capacity: 100,
  currentCount: 41,
  price: "0",
  tokenCost: 0,
};

test("formatLocalDateTime 給本地牆上時間，不是 UTC 切片", () => {
  // Web 的 `slice(0, 16)` 在 UTC+8 會拿到 02:00（UTC），App 必須拿到 10:00。
  assert.equal(
    formatLocalDateTime(new Date(2026, 10, 5, 10, 30, 0, 0)),
    "2026-11-05 10:30",
  );
});

test("formatLocalDateTime 對無效日期回空字串（畫面不顯示 NaN）", () => {
  assert.equal(formatLocalDateTime(new Date("nope")), "");
});

test("sessionFormFrom 把 ISO 還原成使用者當初填的本地時間", () => {
  const form = sessionFormFrom(SESSION);
  assert.equal(form.startDate, "2026-11-05 10:00");
  assert.equal(form.endDate, "2026-11-05 11:00");
  assert.equal(form.capacity, "100");
  assert.equal(form.title, "開幕演講");
});

test("回填 → 組 payload 往返不位移（時間與所有欄位）", () => {
  const payload = toSessionPayload(sessionFormFrom(SESSION));

  assert.ok(payload != null);
  assert.equal(
    new Date(payload.startDate).getTime(),
    new Date(SESSION.startDate).getTime(),
    "編輯後存回的時間必須與原本一模一樣",
  );
  assert.equal(
    new Date(payload.endDate).getTime(),
    new Date(SESSION.endDate).getTime(),
  );
  assert.equal(payload.title, SESSION.title);
  assert.equal(payload.capacity, SESSION.capacity);
  assert.equal(payload.sessionType, SESSION.sessionType);
});

test("空欄位回填成空字串，存回時變 null——容量可以真的被清成不限", () => {
  const form = sessionFormFrom({
    ...SESSION,
    description: null,
    location: null,
    speakerName: null,
    capacity: null,
  });

  assert.equal(form.capacity, "");
  assert.equal(form.location, "");

  const payload = toSessionPayload(form);
  assert.ok(payload != null);
  assert.equal(
    payload.capacity,
    null,
    'capacity 必須回到 null，不是字串 "null"',
  );
  assert.equal(payload.location, null);
});
