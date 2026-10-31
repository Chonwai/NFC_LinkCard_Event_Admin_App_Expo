/**
 * 「活動資料」驗證規則的行為鎖——**以 Web 的表單行為為唯一基準**。
 *
 * ## 這支為什麼存在
 * Web 那一頁沒有 validate 函式，它靠三個 HTML 屬性把關
 * （`manage/[eventId]/profile/page.tsx`）：
 *
 * - `:214` `<input required>` → 名稱不得為空字串
 * - `:230` `<textarea maxLength={500}>` → 說明不得超過 500 字
 * - `:343` `<input type="url">` → 外部網址必須是絕對 URL
 *
 * 把這三條搬進 App 時最容易出的錯不是「漏寫」，而是**寫得比 Web 嚴**：
 * 加了 trim、加了 TLD 檢查、加了最小長度。那一類「順手加強」會讓 App 擋掉
 * Web 放行的輸入，於是同一個活動在兩邊的可編輯性就不一樣了。
 *
 * 下面的測試因此有一半在斷言**放行**：`"   "`（純空白名稱）、`https://localhost`
 * 這些看起來可疑但 Web 接受的值，必須維持放行。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "@/constants/copy.zh-TW";
import {
  hasEventProfileErrors,
  isAbsoluteUrl,
  PROFILE_DESCRIPTION_MAX,
  PROFILE_NAME_MAX,
  validateEventProfile,
} from "@/utils/event-profile-validation";

/** 一份完全合法的表單值；各測試只覆寫關心的欄位。 */
const VALID = {
  name: "Startup Fest 2026",
  description: "一年一度的新創展會",
  externalLandingUrl: "",
};

test("合法表單通過，回傳空物件", () => {
  const errors = validateEventProfile(VALID);
  assert.deepEqual(errors, {});
  assert.equal(hasEventProfileErrors(errors), false);
});

// ---------------------------------------------------------------------------
// 名稱：Web `<input required>`（page.tsx:214）
// ---------------------------------------------------------------------------

test("空名稱被擋（Web 的 required）", () => {
  const errors = validateEventProfile({ ...VALID, name: "" });
  assert.equal(errors.name, copy.profile.nameRequired);
});

test("純空白名稱放行——HTML required 只擋空字串，這裡不得擅自 trim", () => {
  // 這一條是刻意的：加 trim 會比 Web 嚴，就變成「增」。
  const errors = validateEventProfile({ ...VALID, name: "   " });
  assert.equal(errors.name, undefined);
});

test(`名稱 ${PROFILE_NAME_MAX} 字放行（後端 @MaxLength 的邊界值）`, () => {
  const errors = validateEventProfile({
    ...VALID,
    name: "a".repeat(PROFILE_NAME_MAX),
  });
  assert.equal(errors.name, undefined);
});

test(`名稱 ${PROFILE_NAME_MAX + 1} 字被擋，且訊息與後端一字不差`, () => {
  const errors = validateEventProfile({
    ...VALID,
    name: "a".repeat(PROFILE_NAME_MAX + 1),
  });
  // 後端 UpdateEventDto：'活動名稱不能超過 120 個字符'
  assert.equal(errors.name, "活動名稱不能超過 120 個字符");
  assert.equal(errors.name, copy.profile.nameTooLong);
});

// ---------------------------------------------------------------------------
// 說明：Web `<textarea maxLength={500}>`（page.tsx:230）
// ---------------------------------------------------------------------------

test(`說明 ${PROFILE_DESCRIPTION_MAX} 字放行`, () => {
  const errors = validateEventProfile({
    ...VALID,
    description: "字".repeat(PROFILE_DESCRIPTION_MAX),
  });
  assert.equal(errors.description, undefined);
});

test(`說明 ${PROFILE_DESCRIPTION_MAX + 1} 字被擋`, () => {
  const errors = validateEventProfile({
    ...VALID,
    description: "字".repeat(PROFILE_DESCRIPTION_MAX + 1),
  });
  assert.equal(errors.description, copy.profile.descriptionTooLong);
});

test("空說明放行（Web 沒有 required，且送出時轉 null）", () => {
  const errors = validateEventProfile({ ...VALID, description: "" });
  assert.equal(errors.description, undefined);
});

// ---------------------------------------------------------------------------
// 外部網址：Web `<input type="url">`（page.tsx:343）
// ---------------------------------------------------------------------------

test("空網址放行——Web 的 url 欄位沒有 required，空白是合法的", () => {
  const errors = validateEventProfile({ ...VALID, externalLandingUrl: "" });
  assert.equal(errors.externalLandingUrl, undefined);
});

test("缺 scheme 的網址被擋（瀏覽器 type=url 同樣擋）", () => {
  const errors = validateEventProfile({
    ...VALID,
    externalLandingUrl: "example.com/landing",
  });
  assert.equal(errors.externalLandingUrl, copy.profile.externalUrlInvalid);
});

test("含空白的假網址被擋", () => {
  const errors = validateEventProfile({
    ...VALID,
    externalLandingUrl: "not a url",
  });
  assert.equal(errors.externalLandingUrl, copy.profile.externalUrlInvalid);
});

test("合法 https 網址放行", () => {
  const errors = validateEventProfile({
    ...VALID,
    externalLandingUrl: "https://example.com/landing?lang=zh",
  });
  assert.equal(errors.externalLandingUrl, undefined);
});

test("https://localhost 放行——瀏覽器接受，後端若擋會回自己的訊息", () => {
  // 這一條同樣刻意：後端 validator.js 預設 require_tld，會擋 localhost，
  // 但 Web 的前端閘門放行。以較嚴的那一邊（前端）為準，並讓後端訊息原樣顯示。
  assert.equal(isAbsoluteUrl("https://localhost"), true);
  assert.equal(isAbsoluteUrl("http://127.0.0.1:3000"), true);
});

test("isAbsoluteUrl 對 scheme 以外的形式一律 false", () => {
  for (const value of [
    "",
    "example.com",
    "//example.com",
    "www.example.com",
    "https://",
    "https:// example.com",
  ]) {
    assert.equal(isAbsoluteUrl(value), false, `${value} 不該被當成絕對網址`);
  }
});

// ---------------------------------------------------------------------------
// 多欄位同時失效
// ---------------------------------------------------------------------------

test("多個欄位同時不合法時全部回報（不是只報第一個）", () => {
  const errors = validateEventProfile({
    name: "",
    description: "字".repeat(PROFILE_DESCRIPTION_MAX + 1),
    externalLandingUrl: "nope",
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "description",
    "externalLandingUrl",
    "name",
  ]);
  assert.equal(hasEventProfileErrors(errors), true);
});
