/**
 * 建立活動表單的純函式測試。
 *
 * ## 這支在守什麼
 * `utils/event-create-form.ts` 有兩個「看起來很無聊、錯了卻很難查」的地方：
 *
 * 1. **時間的時區**。使用者在 App 打的是**本地牆上時間**（`2026-11-01 09:00`），
 *    後端 `CreateEventDto` 是 `@IsDateString()`。若把字串原樣送出 → 400；
 *    若用 `new Date(string)` 解析 → Hermes 對非 ISO 字串沒有保證。
 *    這支釘住「一律以本地時區建構，再 `toISOString()`」。
 * 2. **slug 的正規表達式**。`slugFromName` 逐字照抄 Web，包含那個
 *    「`\w` 收底線、但驗證器不收底線」的小毛病。照抄是刻意的（兩邊要一起修），
 *    所以把它釘成已知行為，而不是留給下一個人去「順手修好」。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATE_EVENT_DEFAULT_TIMEZONE,
  CREATE_EVENT_DEFAULT_TYPE,
  CREATE_EVENT_TIMEZONES,
  CREATE_EVENT_TYPES,
  createEventFormErrors,
  emptyCreateEventForm,
  hasCreateEventErrors,
  slugFromName,
  toCreateEventPayload,
} from "@/utils/event-create-form";

// ---------------------------------------------------------------------------
// 一、空白表單與選項清單
// ---------------------------------------------------------------------------

test("空白表單的預設值逐字照 Web：Asia/Macau + EXHIBITION", () => {
  const form = emptyCreateEventForm();

  assert.equal(form.timezone, CREATE_EVENT_DEFAULT_TIMEZONE);
  assert.equal(form.eventType, CREATE_EVENT_DEFAULT_TYPE);
  assert.equal(form.name, "");
  assert.equal(form.slug, "");
  assert.equal(form.description, "");
  assert.equal(form.startDate, "");
  assert.equal(form.endDate, "");
});

test("每次呼叫都拿到新的物件（共用常數會讓改一格改到全部）", () => {
  const first = emptyCreateEventForm();
  const second = emptyCreateEventForm();

  assert.notEqual(first, second);
  first.name = "改過了";
  assert.equal(second.name, "", "第二份表單不該被第一份的修改影響");
});

test("時區清單與 Web 的 TIMEZONES 同值同序", () => {
  assert.deepEqual(
    [...CREATE_EVENT_TIMEZONES],
    ["Asia/Macau", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Singapore"],
  );
});

test("活動類型清單與 Web 的 EVENT_TYPES 同值同序", () => {
  assert.deepEqual(
    [...CREATE_EVENT_TYPES],
    ["EXHIBITION", "CONFERENCE", "WORKSHOP_SERIES", "MEETUP", "OTHER"],
  );
});

// ---------------------------------------------------------------------------
// 二、slug 自動產生（逐字照抄 Web 的行為，含它的毛病）
// ---------------------------------------------------------------------------

test("slugFromName 轉小寫、空白轉連字號", () => {
  assert.equal(slugFromName("Startup Fest 2026"), "startup-fest-2026");
});

test("slugFromName 去掉非文字字元（照 Web 的 /[^\\w\\s-]/g）", () => {
  assert.equal(slugFromName("StartupFest 2026!"), "startupfest-2026");
});

test("已知的 Web 第二個小毛病：開頭是中文／空白時會留下前導連字號", () => {
  // `\w` 不含 CJK，所以「活動 StartupFest」的「活動」整段被刪掉，開頭那個
  // 空白接著被換成 `-` → `-startupfest`。它**過得了** `/^[a-z0-9-]+$/`
  // （單獨一個前導 `-` 是合法的），所以不會被擋，只是一個不漂亮的 slug。
  // 同樣照抄：兩邊一起改，不要在 App 單邊「美化」。
  assert.equal(slugFromName("活動 StartupFest"), "-startupfest");
  assert.equal(slugFromName("  leading"), "-leading");
});

test("slugFromName 收斂連續連字號", () => {
  assert.equal(slugFromName("a - - b"), "a-b");
});

test("slugFromName 最多 60 字（Web 的 slice(0, 60)）", () => {
  const slug = slugFromName("a".repeat(200));

  assert.equal(slug.length, 60);
});

test("已知的 Web 小毛病：底線會被保留，但驗證器不收——照抄，不順手修", () => {
  // `\w` 包含底線，所以自動產生的 slug 會留下它；而 Web（與 App）的
  // slug 格式規則是 `/^[a-z0-9-]+$/`，底線不合法。使用者在 Web 上必須手動
  // 改掉，App 也一樣。若哪天有人「修好」這裡，就等於 App 放行 Web 擋住的值。
  const slug = slugFromName("Startup_Fest");

  assert.equal(slug, "startup_fest");
  assert.equal(
    /^[a-z0-9-]+$/.test(slug),
    false,
    "這個測試故意示範 Web 的自動 slug 過不了自己的格式規則",
  );
});

// ---------------------------------------------------------------------------
// 三、表單 → POST body
// ---------------------------------------------------------------------------

/** 一份「填好了」的表單；各測試只覆蓋自己關心的欄位。 */
function filledForm() {
  return {
    ...emptyCreateEventForm(),
    name: "StartupFest 2027",
    slug: "startup-fest-2027",
    description: "年度新創展會",
    startDate: "2027-11-01 09:00",
    endDate: "2027-11-02 18:00",
  };
}

test("時間以本地時區建構，再轉 ISO（與 Web 的 toISOString() 同一個時刻）", () => {
  const payload = toCreateEventPayload(filledForm());
  assert.ok(payload != null);

  assert.equal(
    payload.startDate,
    new Date(2027, 10, 1, 9, 0, 0, 0).toISOString(),
  );
  assert.equal(
    payload.endDate,
    new Date(2027, 10, 2, 18, 0, 0, 0).toISOString(),
  );
});

test("接受 T 分隔（使用者貼上 datetime-local 的字串也走得通）", () => {
  const spaced = toCreateEventPayload(filledForm());
  const withT = toCreateEventPayload({
    ...filledForm(),
    startDate: "2027-11-01T09:00",
  });

  assert.ok(spaced != null && withT != null);
  assert.equal(withT.startDate, spaced.startDate);
});

test("body 的欄位順序與 Web 的 createEvent({...}) 相同", () => {
  const payload = toCreateEventPayload(filledForm());
  assert.ok(payload != null);

  assert.deepEqual(Object.keys(payload), [
    "name",
    "slug",
    "description",
    "startDate",
    "endDate",
    "timezone",
    "eventType",
  ]);
});

test("空白說明轉成 undefined，不是空字串（照 Web 的 form.description || undefined）", () => {
  const payload = toCreateEventPayload({ ...filledForm(), description: "" });
  assert.ok(payload != null);

  assert.equal(payload.description, undefined);
  assert.equal("description" in payload, true);
});

test("選填欄位缺席時仍然帶上時區與類型（不會變成 undefined）", () => {
  const payload = toCreateEventPayload(filledForm());
  assert.ok(payload != null);

  assert.equal(payload.timezone, "Asia/Macau");
  assert.equal(payload.eventType, "EXHIBITION");
});

test("時間解析不了就回 null（呼叫端據此不送出）", () => {
  for (const bad of [
    { startDate: "" },
    { endDate: "" },
    { startDate: "2027-11-01" },
    { startDate: "2027-02-30 09:00" },
    { endDate: "不是時間" },
  ]) {
    assert.equal(
      toCreateEventPayload({ ...filledForm(), ...bad }),
      null,
      `應該回 null：${JSON.stringify(bad)}`,
    );
  }
});

test("回傳的 body 不含表單才有的欄位（沒有夾帶 state 進請求）", () => {
  const payload = toCreateEventPayload(filledForm());
  assert.ok(payload != null);

  assert.equal(payload.startDateInput, undefined);
  assert.equal(payload.descriptionInput, undefined);
  assert.equal(Object.keys(payload).length, 7);
});

// ---------------------------------------------------------------------------
// 四、驗證（逐條對齊 Web `CreateEventModal.validate`，page.tsx:64-75）
// ---------------------------------------------------------------------------

test("填好的表單零錯誤", () => {
  assert.deepEqual(createEventFormErrors(filledForm()), {});
  assert.equal(
    hasCreateEventErrors(createEventFormErrors(filledForm())),
    false,
  );
});

test("空表單四欄全中，且 slug 顯示的是「格式」不是「必填」（照抄 Web 的覆蓋行為）", () => {
  // Web 的兩個 slug 判斷都是獨立 `if`，空字串兩條都成立，後面的
  // `slugFormat` 覆蓋前面的 `slugRequired`。所以 `slugRequired` 在兩邊
  // 都是走不到的分支。這條測試把「刻意保留」釘住，避免有人單邊改成 else if。
  assert.deepEqual(createEventFormErrors(emptyCreateEventForm()), {
    name: "nameMin",
    slug: "slugFormat",
    startDate: "startDateRequired",
    endDate: "endDateRequired",
  });
});

test("name：1 個字太短、2 個字剛好", () => {
  assert.equal(
    createEventFormErrors({ ...filledForm(), name: "A" }).name,
    "nameMin",
  );
  assert.equal(
    createEventFormErrors({ ...filledForm(), name: "AB" }).name,
    undefined,
  );
});

test("name：121 字報 nameMax（不是 nameMin——兩個獨立 if，後者覆蓋前者）", () => {
  assert.equal(
    createEventFormErrors({ ...filledForm(), name: "a".repeat(121) }).name,
    "nameMax",
  );
  assert.equal(
    createEventFormErrors({ ...filledForm(), name: "a".repeat(120) }).name,
    undefined,
    "120 字是後端 @MaxLength(120) 的上限，應該放行",
  );
});

test("slug：大寫、底線、空白、中文都不合法（/^[a-z0-9-]+$/）", () => {
  for (const slug of [
    "StartupFest",
    "startup_fest",
    "startup fest",
    "startupfest!",
    "活動",
    "-ñ",
  ]) {
    assert.equal(
      createEventFormErrors({ ...filledForm(), slug }).slug,
      "slugFormat",
      `應該擋下 slug=${JSON.stringify(slug)}`,
    );
  }
});

test("slug：小寫英文、數字、連字號的組合放行", () => {
  for (const slug of ["a", "startup-fest-2027", "abc123", "123"]) {
    assert.equal(
      createEventFormErrors({ ...filledForm(), slug }).slug,
      undefined,
      `應該放行 slug=${JSON.stringify(slug)}`,
    );
  }
});

test("時間必填：缺哪一個就報哪一個", () => {
  const noStart = createEventFormErrors({ ...filledForm(), startDate: "" });
  assert.equal(noStart.startDate, "startDateRequired");
  assert.equal(noStart.endDate, undefined, "endDate 有填，不該被連坐");

  const noEnd = createEventFormErrors({ ...filledForm(), endDate: "" });
  assert.equal(noEnd.endDate, "endDateRequired");
  assert.equal(noEnd.startDate, undefined);
});

test("時間格式：填了但解析不了 → dateFormat（App 專屬，Web 的 datetime-local 不可能產生）", () => {
  for (const bad of ["2026-13-45 09:00", "2026-02-30 09:00", "明天", "09:00"]) {
    assert.equal(
      createEventFormErrors({ ...filledForm(), startDate: bad }).startDate,
      "dateFormat",
      `應該擋下 startDate=${JSON.stringify(bad)}`,
    );
  }

  assert.equal(
    createEventFormErrors({ ...filledForm(), endDate: "2026-11-40 10:00" })
      .endDate,
    "dateFormat",
  );
});

test("結束早於開始 → endDateBeforeStart", () => {
  assert.equal(
    createEventFormErrors({
      ...filledForm(),
      startDate: "2027-11-02 10:00",
      endDate: "2027-11-02 09:59",
    }).endDate,
    "endDateBeforeStart",
  );
});

test("同時開始與結束是合法的（Web 用嚴格小於，不是 <=）", () => {
  assert.deepEqual(
    createEventFormErrors({
      ...filledForm(),
      startDate: "2027-11-02 10:00",
      endDate: "2027-11-02 10:00",
    }),
    {},
  );
});

test("順序比較用解析後的時間，不是字串字典序（空白與 T 混用時字典序會錯）", () => {
  // 若照 Web 的字串比較，"2027-11-02T09:00" < "2027-11-02 10:00" 會因為
  // `T`(0x54) > ' '(0x20) 而得到「不早於」—— 也就是漏擋。這裡先解析再比。
  assert.equal(
    createEventFormErrors({
      ...filledForm(),
      startDate: "2027-11-02 10:00",
      endDate: "2027-11-02T09:00",
    }).endDate,
    "endDateBeforeStart",
    "混用空白與 T 時仍要正確判定先後",
  );
});

test("description / timezone / eventType 不參與驗證（與 Web 相同）", () => {
  const errors = createEventFormErrors({
    ...filledForm(),
    description: "",
    timezone: "Asia/Macau",
    eventType: "OTHER",
  });

  assert.deepEqual(Object.keys(errors).sort(), []);
});

test("Web 對等表：同一批輸入在 App 得到同一組 accept/reject 判定", () => {
  // 這張表是從 Web `validate()`（page.tsx:64-75）的七條判斷逐條推出來的。
  // `accepted` 只問「會不會被擋」，不問顯示哪一句。
  const cases = [
    { label: "全部合法", patch: {}, accepted: true },
    { label: "名稱空白", patch: { name: "" }, accepted: false },
    { label: "名稱 1 字", patch: { name: "A" }, accepted: false },
    { label: "名稱 121 字", patch: { name: "a".repeat(121) }, accepted: false },
    { label: "slug 空白", patch: { slug: "" }, accepted: false },
    { label: "slug 大寫", patch: { slug: "Startup" }, accepted: false },
    { label: "缺開始", patch: { startDate: "" }, accepted: false },
    { label: "缺結束", patch: { endDate: "" }, accepted: false },
    {
      label: "結束早於開始",
      patch: { startDate: "2027-11-02 10:00", endDate: "2027-11-01 10:00" },
      accepted: false,
    },
    {
      label: "結束等於開始",
      patch: { startDate: "2027-11-02 10:00", endDate: "2027-11-02 10:00" },
      accepted: true,
    },
    {
      label: "跨年跨月",
      patch: { startDate: "2027-12-31 23:00", endDate: "2028-01-01 01:00" },
      accepted: true,
    },
  ];

  for (const c of cases) {
    const errors = createEventFormErrors({ ...filledForm(), ...c.patch });
    assert.equal(
      !hasCreateEventErrors(errors),
      c.accepted,
      `${c.label}：預期 ${c.accepted ? "放行" : "擋下"}，得到 ${JSON.stringify(errors)}`,
    );
  }
});

test("通過驗證的表單一定組得出 body（兩者不會互相矛盾）", () => {
  // 驗證與 payload 組裝是兩個函式，最怕的是「驗證說可以、組裝卻回 null」。
  for (const startDate of ["2027-11-01 09:00", "2027-11-01T09:00"]) {
    const form = { ...filledForm(), startDate };
    assert.equal(hasCreateEventErrors(createEventFormErrors(form)), false);
    assert.ok(
      toCreateEventPayload(form) != null,
      `驗證通過卻組不出 body：startDate=${startDate}`,
    );
  }
});
