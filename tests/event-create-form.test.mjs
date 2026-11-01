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
  emptyCreateEventForm,
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
