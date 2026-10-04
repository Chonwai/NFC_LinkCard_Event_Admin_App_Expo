/**
 * `WP-18` 報到台 → 寫卡頁交棒的**行為**測試（Loop AB · Batch A 驗收 `M-03`）。
 *
 * 為什麼要有這一支：原本這三段邏輯（`profilePathLabel`、`toAttendeeContext`、
 * `resolveAttendee`）長在 `check-in.tsx` / `nfc-bind.tsx` 裡，而 AdminApp 沒有元件層
 * 測試（`node:test`，無 jsdom／RN renderer），所以驗收只能靠 `check-in-write-handoff`
 * 那種「讀原始碼比對字串」——抓得到整段被刪，抓不到等價重寫、邊界值與錯誤映射。
 * 抽到 `@/utils/desk-handoff` 之後，這裡對**輸入→輸出**下斷言。
 *
 * 反例探針（RED→GREEN 證據，實測方式見交付報告 §5）：
 * - 把 `toAttendeeContext` 的 `registration.profileUrl ?? null` 改成自組 origin
 *   （`https://linkcard.xyz/p/${slug}`）⇒ 「URL 逐字來自 BE」那條必紅。
 * - 把 `resolveAttendee` 的 `catch` 分支改成回 `copy.nfc.bindFailed` ⇒ 錯誤映射那條必紅。
 * - 把 `profilePathLabel` 的 `new URL(value).pathname` 改成回傳原文 ⇒ 絕對 URL 那條必紅。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { copy } from "@/constants/copy.zh-TW";
import {
  profilePathLabel,
  resolveAttendee,
  toAttendeeContext,
} from "@/utils/desk-handoff";

/** 最小可用的 `Registration` 形狀（只帶受測路徑會讀到的欄位）。 */
const registration = (overrides = {}) => ({
  id: "reg-1",
  firstName: "Mei",
  lastName: "Yu",
  email: "mei@example.com",
  profileUrl: "https://linkcard.xyz/p/mei-yu-a1b2c3",
  ...overrides,
});

test("toAttendeeContext：profileUrl 逐字沿用 BE 回傳值（X-23：不得在 App 內自組 origin）", () => {
  const ctx = toAttendeeContext(
    registration({ profileUrl: "https://staging.linkcard.example/p/abc-1" }),
    "LKC-202611-A1B2C3",
  );

  assert.ok(ctx);
  assert.equal(ctx.profileUrl, "https://staging.linkcard.example/p/abc-1");
  assert.equal(ctx.code, "LKC-202611-A1B2C3");
  assert.equal(ctx.registrationId, "reg-1");
  assert.equal(ctx.phase, "confirm");
  // 沒有任何一條路徑會把 origin 換掉或再拼一次
  assert.equal(ctx.profileUrl.includes("//p/"), false);
});

test("toAttendeeContext：profileUrl 缺 / null ⇒ null（不是字串 'null'、不是空字串）", () => {
  for (const value of [undefined, null, ""]) {
    const ctx = toAttendeeContext(registration({ profileUrl: value }), "LKC-1");
    assert.ok(ctx);
    assert.equal(ctx.profileUrl, null);
  }
});

test("toAttendeeContext：缺 registration.id ⇒ null（由呼叫端沿用既有錯誤文案）", () => {
  assert.equal(
    toAttendeeContext(registration({ id: undefined }), "LKC-1"),
    null,
  );
});

test("toAttendeeContext：顯示名依序回退 fullName → 姓名 → email → 破折號", () => {
  assert.equal(
    toAttendeeContext(
      registration({ profile: { fullName: "Mei Yu (Profile)" } }),
      "LKC-1",
    ).displayName,
    "Mei Yu (Profile)",
  );
  assert.equal(
    toAttendeeContext(registration(), "LKC-1").displayName,
    "Mei Yu",
  );
  assert.equal(
    toAttendeeContext(
      registration({ firstName: null, lastName: null }),
      "LKC-1",
    ).displayName,
    "mei@example.com",
  );
  assert.equal(
    toAttendeeContext(
      registration({ firstName: null, lastName: null, email: null }),
      "LKC-1",
    ).displayName,
    copy.checkIn.dash,
  );
});

test("profilePathLabel：絕對 URL ⇒ 只留路徑；相對／壞值 ⇒ 原文；空值 ⇒ null", () => {
  assert.equal(
    profilePathLabel("https://linkcard.xyz/p/mei-yu-a1b2c3"),
    "/p/mei-yu-a1b2c3",
  );
  // 前後空白要 trim，不是原樣回傳
  assert.equal(profilePathLabel("  https://linkcard.xyz/p/abc  "), "/p/abc");
  // 沒有 origin 就沒有路徑可解析 ⇒ 顯示原文（操作者看得到後端回了什麼）
  assert.equal(profilePathLabel("/p/abc-1"), "/p/abc-1");
  assert.equal(profilePathLabel("not a url"), "not a url");
  // 空值不顯示，而不是顯示一個空連結
  for (const value of [null, undefined, "", "   "]) {
    assert.equal(profilePathLabel(value), null);
  }
});

test("resolveAttendee：以注入的 lookup 查詢，成功時回 confirm 態", async () => {
  const calls = [];
  const lookup = async (eventId, code) => {
    calls.push([eventId, code]);
    return { registration: registration() };
  };

  const result = await resolveAttendee("event-1", "LKC-202611-A1B2C3", lookup);

  assert.deepEqual(calls, [["event-1", "LKC-202611-A1B2C3"]]);
  assert.equal(result.ok, true);
  assert.equal(result.ctx.registrationId, "reg-1");
  assert.equal(result.ctx.code, "LKC-202611-A1B2C3");
});

test("resolveAttendee：查得到但缺 id ⇒ bindFailed（不是「查不到」）", async () => {
  const result = await resolveAttendee("event-1", "LKC-1", async () => ({
    registration: registration({ id: undefined }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, copy.nfc.bindFailed);
});

test("resolveAttendee：查詢拋錯 ⇒ registrationNotFound（連線失敗不得冒成『查不到』以外的文案）", async () => {
  const result = await resolveAttendee("event-1", "LKC-1", async () => {
    throw new Error("network down");
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, copy.checkIn.registrationNotFound);
});

test("resolveAttendee：寫卡 URL 來自 BE 回應，不是路由參數（deep link 改造不了卡片內容）", async () => {
  const result = await resolveAttendee("event-1", "../../evil", async () => ({
    registration: registration({ profileUrl: "https://linkcard.xyz/p/abc-1" }),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.ctx.profileUrl, "https://linkcard.xyz/p/abc-1");
  // 被改造的 code 只影響「查哪一筆」，不會變成寫進卡片的 URL
  assert.equal(result.ctx.code, "../../evil");
  assert.equal(result.ctx.profileUrl.includes("evil"), false);
});
