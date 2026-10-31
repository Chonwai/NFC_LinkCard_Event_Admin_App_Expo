/**
 * `configJson.bankDetails` 的讀寫鎖——**以 Web `settings/page.tsx` 的行為為基準**。
 *
 * ## 這支在防什麼
 * 後端 `PATCH /v1/events/:eventId` 收到 `configJson` 就**整包覆蓋**。那不是
 * 「合併」，是「取代」。所以只要有一支 `build*` 忘了 `{ ...existing }`，
 * 儲存銀行資料就會把 `theme`（品牌色）**靜默刪掉**——沒有錯誤、沒有提示，
 * 只有使用者下次打開報名頁時發現顏色變了。
 *
 * 這種 bug 用型別抓不到（`configJson` 是 `@IsObject()` 的黑箱），用眼睛也很難
 * 看出來（`{ bankDetails }` 看起來完全正常）。只有斷言「存完之後 theme 還在」
 * 才抓得住。
 *
 * ## 另一半：`instructions` 有兩種形狀
 * 後端 `LocalizedCopy` 是 `string | Record<string, string>`。Web 的載入邏輯
 * 只處理物件形式，純字串會被讀成 `''`，接著存檔時因為「兩個指示都空」而寫成
 * `null`——按一次儲存就把使用者的付款指示刪掉。App 不複製這個行為，
 * 下面有一條測試專門釘住它。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildConfigWithBankDetails,
  toBankDetailsForm,
} from "@/utils/event-settings-config";

/** Web `BankDetailsFormState` 的五個欄位。 */
const EMPTY_FORM = {
  accountName: "",
  bankName: "",
  accountNumber: "",
  instructionsZh: "",
  instructionsEn: "",
};

const FILLED_FORM = {
  accountName: "LinkCard Ltd",
  bankName: "HSBC",
  accountNumber: "123-456789-001",
  instructionsZh: "請在轉賬備註填寫報名碼",
  instructionsEn: "Please put your code in the remark",
};

// ---------------------------------------------------------------------------
// 讀：configJson → 表單
// ---------------------------------------------------------------------------

test("沒有 configJson 時回一份空表單（不是 null，畫面才能直接綁）", () => {
  assert.deepEqual(toBankDetailsForm(null), EMPTY_FORM);
  assert.deepEqual(toBankDetailsForm(undefined), EMPTY_FORM);
});

test("物件形式的 instructions 取 zh／en", () => {
  const form = toBankDetailsForm({
    bankDetails: {
      accountName: "LinkCard Ltd",
      bankName: "HSBC",
      accountNumber: "123",
      instructions: { zh: "中文指示", en: "English note" },
    },
  });
  assert.deepEqual(form, {
    accountName: "LinkCard Ltd",
    bankName: "HSBC",
    accountNumber: "123",
    instructionsZh: "中文指示",
    instructionsEn: "English note",
  });
});

test("instructions 用 zh-Hant 當鍵也讀得到（Web 同一條優先序）", () => {
  const form = toBankDetailsForm({
    bankDetails: { instructions: { "zh-Hant": "繁體指示" } },
  });
  assert.equal(form.instructionsZh, "繁體指示");
});

test("⚠️ 純字串形式的 instructions 不得被丟掉（Web 會丟，這裡修掉）", () => {
  // Web settings/page.tsx:55-60 對非物件形式回傳 ''，存檔時寫成 null。
  const form = toBankDetailsForm({
    bankDetails: { instructions: "舊格式的付款指示" },
  });
  assert.equal(form.instructionsZh, "舊格式的付款指示");
  assert.equal(form.instructionsEn, "");
});

test("欄位為 null 時退回空字串（表單是受控元件，不能餵 null）", () => {
  const form = toBankDetailsForm({
    bankDetails: { accountName: null, bankName: null, accountNumber: null },
  });
  assert.deepEqual(form, EMPTY_FORM);
});

// ---------------------------------------------------------------------------
// 寫：表單 → configJson
// ---------------------------------------------------------------------------

test("存銀行資料時 theme 必須還在（後端是整包覆蓋）", () => {
  const config = {
    theme: {
      primaryColor: "#7c3aed",
      primaryHoverColor: "#6d28d9",
      darkMode: true,
    },
  };
  const next = buildConfigWithBankDetails(config, FILLED_FORM);

  assert.deepEqual(next.theme, config.theme);
});

test("存銀行資料時 formStyle 等本 App 不碰的鍵也要原樣保留", () => {
  const config = { formStyle: { bannerUrl: "https://example.com/b.png" } };
  const next = buildConfigWithBankDetails(config, FILLED_FORM);

  assert.deepEqual(next.formStyle, config.formStyle);
});

test("產出的 bankDetails 形狀與 Web handleSaveBankDetails 一致", () => {
  const next = buildConfigWithBankDetails(null, FILLED_FORM);

  assert.deepEqual(next.bankDetails, {
    accountName: "LinkCard Ltd",
    bankName: "HSBC",
    accountNumber: "123-456789-001",
    instructions: {
      zh: "請在轉賬備註填寫報名碼",
      en: "Please put your code in the remark",
    },
  });
});

test("空欄位轉 null（不是空字串）——後端把 null 當「未填」", () => {
  const next = buildConfigWithBankDetails(null, EMPTY_FORM);

  assert.deepEqual(next.bankDetails, {
    accountName: null,
    bankName: null,
    accountNumber: null,
    instructions: null,
  });
});

test("文字欄位 trim 後才送出（Web 這支有 trim）", () => {
  const next = buildConfigWithBankDetails(null, {
    ...EMPTY_FORM,
    accountName: "  LinkCard Ltd  ",
    bankName: "  HSBC ",
    accountNumber: " 123 ",
  });

  const bankDetails = next.bankDetails;
  assert.equal(bankDetails.accountName, "LinkCard Ltd");
  assert.equal(bankDetails.bankName, "HSBC");
  assert.equal(bankDetails.accountNumber, "123");
});

test("兩個指示都空白時 instructions 為 null（不是 {zh:'',en:''}）", () => {
  const next = buildConfigWithBankDetails(null, {
    ...EMPTY_FORM,
    instructionsZh: "   ",
    instructionsEn: "\t",
  });

  const bankDetails = next.bankDetails;
  assert.equal(bankDetails.instructions, null);
});

test("只有英文指示時 instructions 仍是物件（zh 為空字串）", () => {
  const next = buildConfigWithBankDetails(null, {
    ...EMPTY_FORM,
    instructionsEn: "English only",
  });

  const bankDetails = next.bankDetails;
  assert.deepEqual(bankDetails.instructions, { zh: "", en: "English only" });
});

test("純字串指示載入後存回，語意不變（後端 pickLocalizedCopy 取 zh 優先）", () => {
  const config = { bankDetails: { instructions: "舊格式指示" } };
  const form = toBankDetailsForm(config);
  const next = buildConfigWithBankDetails(config, form);

  const bankDetails = next.bankDetails;
  assert.deepEqual(bankDetails.instructions, { zh: "舊格式指示", en: "" });
});

test("不會就地改動傳入的 config（避免同一個物件被兩段儲存互相污染）", () => {
  const config = { theme: { darkMode: false } };
  const snapshot = JSON.stringify(config);

  buildConfigWithBankDetails(config, FILLED_FORM);

  assert.equal(JSON.stringify(config), snapshot);
});
