/**
 * `src/utils/registration-display.ts` 的行為鎖定（`R-06`／`H1-6`）。
 *
 * 這些函式決定報到畫面「顯示什麼」，其中 `getRegistrationDisplayName` 與
 * `isAlreadyCheckedIn` 直接影響閘口人員的判斷，因此每一條分支都要有斷言。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { copy } = await import("@/constants/copy.zh-TW");
const {
  getRegistrationCheckedInAt,
  getRegistrationCode,
  getRegistrationCompany,
  getRegistrationDisplayName,
  getRegistrationEmail,
  getRegistrationPhone,
  getRegistrationTicketType,
  getRegistrationTokenBalance,
  isAlreadyCheckedIn,
  isRegistrationNotCheckInEligible,
  maskEmail,
  maskPhone,
} = await import("@/utils/registration-display");

/** 「未知」的單一哨兵值。先釘住它，其餘斷言才能用同一個來源比較。 */
test("哨兵值：copy.checkIn.dash 是破折號", () => {
  assert.equal(copy.checkIn.dash, "—");
});

test("getRegistrationDisplayName：profile 全名 > 姓+名 > email > 破折號", () => {
  assert.equal(
    getRegistrationDisplayName({
      profile: { fullName: "王小明" },
      firstName: "X",
      lastName: "Y",
    }),
    "王小明",
  );

  assert.equal(
    getRegistrationDisplayName({ firstName: "Ming", lastName: "Wang" }),
    "Ming Wang",
  );

  assert.equal(
    getRegistrationDisplayName({ email: "a@b.com" }),
    "a@b.com",
  );

  assert.equal(
    getRegistrationDisplayName({
      profile: { fullName: "   " },
      email: "   ",
    }),
    copy.checkIn.dash,
  );
});

test("getRegistrationCompany / Email / Phone：缺值一律破折號", () => {
  assert.equal(
    getRegistrationCompany({ profile: { company: "LinkCard" } }),
    "LinkCard",
  );
  assert.equal(getRegistrationCompany({}), copy.checkIn.dash);
  assert.equal(getRegistrationCompany({ company: "  " }), copy.checkIn.dash);

  assert.equal(getRegistrationEmail({ email: "a@b.com" }), "a@b.com");
  assert.equal(getRegistrationEmail({}), copy.checkIn.dash);

  assert.equal(getRegistrationPhone({ phone: "0912345678" }), "0912345678");
  assert.equal(getRegistrationPhone({}), copy.checkIn.dash);
});

test("getRegistrationTicketType：票種名 > 票種標題 > 報名類型中文化 > 原字串 > 破折號", () => {
  assert.equal(
    getRegistrationTicketType({ ticketType: { name: "VIP 票" } }),
    "VIP 票",
  );
  assert.equal(
    getRegistrationTicketType({ ticketType: { title: "一般票" } }),
    "一般票",
  );
  assert.equal(
    getRegistrationTicketType({ registrantType: "attendee" }),
    copy.checkIn.registrantTypeLabels.ATTENDEE,
  );
  assert.equal(
    getRegistrationTicketType({ registrantType: "SOMETHING_ELSE" }),
    "SOMETHING_ELSE",
  );
  assert.equal(getRegistrationTicketType({}), copy.checkIn.dash);
});

test("getRegistrationCode：缺值破折號，不吐空字串", () => {
  assert.equal(getRegistrationCode({ registrationCode: "LC-001" }), "LC-001");
  assert.equal(getRegistrationCode({ registrationCode: "   " }), copy.checkIn.dash);
  assert.equal(getRegistrationCode({}), copy.checkIn.dash);
});

test("getRegistrationTokenBalance：只有 number 才算已知", () => {
  assert.equal(getRegistrationTokenBalance({ tokenBalance: 0 }), 0);
  assert.equal(getRegistrationTokenBalance({ tokenBalance: 12 }), 12);
  assert.equal(getRegistrationTokenBalance({}), null);
  assert.equal(getRegistrationTokenBalance({ tokenBalance: "5" }), null);
});

test("getRegistrationCheckedInAt：無值回 null（不是空字串）", () => {
  assert.equal(
    getRegistrationCheckedInAt({ checkedInAt: "2026-09-21T10:00:00Z" }),
    "2026-09-21T10:00:00Z",
  );
  assert.equal(getRegistrationCheckedInAt({}), null);
});

test("isAlreadyCheckedIn：狀態為 CHECKED_IN 或有報到時間", () => {
  assert.equal(isAlreadyCheckedIn({ status: "CHECKED_IN" }), true);
  assert.equal(isAlreadyCheckedIn({ status: "checked_in" }), true);
  assert.equal(
    isAlreadyCheckedIn({ status: "CONFIRMED", checkedInAt: "2026-09-21T10:00:00Z" }),
    true,
  );
  assert.equal(isAlreadyCheckedIn({ status: "CONFIRMED" }), false);
  assert.equal(isAlreadyCheckedIn({}), false);
});

test("isRegistrationNotCheckInEligible：五種不可直接簽到的狀態", () => {
  for (const status of [
    "PENDING",
    "PENDING_PAYMENT",
    "CANCELLED",
    "REJECTED",
    "DRAFT",
    "pending",
  ]) {
    assert.equal(isRegistrationNotCheckInEligible({ status }), true, status);
  }

  // CONFIRMED / CHECKED_IN 是可簽到或已簽到，不屬此類。
  assert.equal(isRegistrationNotCheckInEligible({ status: "CONFIRMED" }), false);
  assert.equal(isRegistrationNotCheckInEligible({ status: "CHECKED_IN" }), false);
  assert.equal(isRegistrationNotCheckInEligible({}), false);
});

test("maskEmail：只留首字元與網域，格式不合回破折號", () => {
  assert.equal(maskEmail("abc@example.com"), "a***@example.com");
  assert.equal(maskEmail("a@b.com"), "a***@b.com");
  assert.equal(maskEmail("no-at-sign"), copy.checkIn.dash);
  assert.equal(maskEmail(""), copy.checkIn.dash);
  assert.equal(maskEmail(null), copy.checkIn.dash);
});

test("maskPhone：只留末四碼；四碼以內全遮", () => {
  assert.equal(maskPhone("0912345678"), "******5678");
  assert.equal(maskPhone("0912 345 678"), "******5678");
  assert.equal(maskPhone("1234"), "****");
  assert.equal(maskPhone(""), copy.checkIn.dash);
  assert.equal(maskPhone(null), copy.checkIn.dash);
});
