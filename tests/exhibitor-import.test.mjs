/**
 * `exhibitor-import.ts` 的純規則測試。
 *
 * ## 為什麼需要這一支
 * `importErrorText` 是匯入流程**唯一**的錯誤出口。它錯了不會拋錯，只會給出一句
 * 聽起來很合理但不對的話：
 *
 * - 認不出 code 就落到 `UNKNOWN`（「操作失敗，請稍後重試」）——而真正的問題可能
 *   是「檔案超過 5MB」，重試一萬次也不會過。
 * - 反過來，若把後端訊息一律蓋掉，就會失去後端才有、前端不知道的新錯誤細節。
 *
 * 所以兩條都要釘住：**認得的碼用我們的字，認不得的碼保留後端的字**。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildImportErrorReportCsv,
  canConfirmImport,
  escapeCsvValue,
  flattenImportErrors,
  importErrorText,
  MAX_PREVIEW_ROWS,
} = await import("@/utils/exhibitor-import");
const { copy } = await import("@/constants/copy.zh-TW");

/** 造一個 axios 形狀的錯誤（後端統一 envelope）。 */
function apiError({ status = 400, code, message } = {}) {
  return {
    response: {
      status,
      data: {
        error: { ...(code ? { code } : {}), ...(message ? { message } : {}) },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 一、預覽上限
// ---------------------------------------------------------------------------

test("預覽上限是 100，與 Web 的 MAX_PREVIEW_ROWS 相同", () => {
  assert.equal(MAX_PREVIEW_ROWS, 100);
});

// ---------------------------------------------------------------------------
// 二、錯誤訊息挑選
// ---------------------------------------------------------------------------

test("認得的 code 用我們的字，不用後端的英文 fallback", () => {
  const text = importErrorText(
    apiError({
      code: "FILE_TOO_LARGE",
      // 後端的 mapError 預設字串是英文；這裡刻意給一句英文，驗證它不會被顯示。
      message: "Failed to preview exhibitor import",
    }),
  );
  assert.equal(text, copy.exhibitors.import.errors.FILE_TOO_LARGE);
  assert.notEqual(text, "Failed to preview exhibitor import");
});

test("認不得的 code 保留後端訊息（不吞掉它）", () => {
  const text = importErrorText(
    apiError({ code: "SOME_NEW_CODE", message: "新的後端錯誤說明" }),
  );
  assert.equal(text, "新的後端錯誤說明");
});

test("既沒 code 也沒訊息時落到 UNKNOWN", () => {
  assert.equal(
    importErrorText(apiError()),
    copy.exhibitors.import.errors.UNKNOWN,
  );
});

test("完全不是 API 形狀的錯誤也回 UNKNOWN，不拋錯", () => {
  assert.equal(
    importErrorText(new Error("boom")),
    copy.exhibitors.import.errors.UNKNOWN,
  );
  assert.equal(importErrorText(null), copy.exhibitors.import.errors.UNKNOWN);
});

test("錯誤碼表每一條都有非空字串（新增碼忘了填字會在這裡紅）", () => {
  const table = copy.exhibitors.import.errors;
  const codes = Object.keys(table);
  assert.ok(codes.length > 0);
  for (const code of codes) {
    assert.equal(typeof table[code], "string", `${code} 不是字串`);
    assert.ok(table[code].trim().length > 0, `${code} 是空字串`);
  }
});

test("UNKNOWN 一定在表裡（它是 importErrorText 的保底）", () => {
  assert.ok("UNKNOWN" in copy.exhibitors.import.errors);
});

// ---------------------------------------------------------------------------
// 三、確認匯入的門檻（App 與 Web 的刻意差異）
// ---------------------------------------------------------------------------

/** 造一份預覽（只填 `canConfirmImport` 會看的兩個數字）。 */
function preview({ valid, invalid }) {
  return {
    fileHash: "hash",
    total: valid + invalid,
    summary: { valid, invalid, duplicate: 0 },
    valid: [],
    invalid: [],
    duplicates: [],
  };
}

test("有一列無效就不給匯入——Web 會建立其餘的，App 不照抄", () => {
  assert.equal(canConfirmImport(preview({ valid: 499, invalid: 1 })), false);
});

test("全部有效才可以匯入", () => {
  assert.equal(canConfirmImport(preview({ valid: 500, invalid: 0 })), true);
});

test("一列都不能建時不給匯入（與 Web 相同）", () => {
  assert.equal(canConfirmImport(preview({ valid: 0, invalid: 0 })), false);
  assert.equal(canConfirmImport(preview({ valid: 0, invalid: 5 })), false);
});

test("沒有預覽就不給匯入", () => {
  assert.equal(canConfirmImport(null), false);
});

// ---------------------------------------------------------------------------
// 四、逐列錯誤與錯誤報表
// ---------------------------------------------------------------------------

test("攤平後每一筆都帶著自己的列號（報表才有座標可以回去修）", () => {
  const flat = flattenImportErrors([
    {
      row: 3,
      errors: [
        {
          field: "email",
          code: "INVALID_EMAIL",
          message: "格式不正確",
          value: "x",
        },
        { field: "exhibitorType", code: "INVALID_TYPE", message: "類型不存在" },
      ],
    },
    {
      row: 9,
      errors: [{ field: "companyName", code: "REQUIRED", message: "必填" }],
    },
  ]);

  assert.deepEqual(
    flat.map((item) => `${item.row}:${item.field}`),
    ["3:email", "3:exhibitorType", "9:companyName"],
  );
});

test('缺 value 時是空字串，不是 "null"／"undefined"', () => {
  const flat = flattenImportErrors([
    {
      row: 1,
      errors: [
        { field: "email", code: "REQUIRED", message: "必填", value: null },
      ],
    },
  ]);
  assert.equal(flat[0].value, "");
});

test("CSV 開頭是 Web 的五欄表頭，欄序一致", () => {
  const csv = buildImportErrorReportCsv([]);
  assert.equal(csv, "row,field,code,message,value");
});

test("公式注入被中和：以 = + - @ 開頭的值加單引號前綴", () => {
  for (const dangerous of ["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx"]) {
    assert.equal(
      escapeCsvValue(dangerous),
      `'${dangerous}`,
      `${JSON.stringify(dangerous)} 沒有被中和——用 Excel 打開報表會執行它`,
    );
  }
});

test("含逗號／雙引號／換行的值會被包起來，內部雙引號加倍", () => {
  assert.equal(escapeCsvValue("a,b"), '"a,b"');
  assert.equal(escapeCsvValue('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvValue("line\nbreak"), '"line\nbreak"');
  assert.equal(escapeCsvValue("plain"), "plain");
});

test("報表每一列都是五欄，且列號是原始檔案的列號", () => {
  const csv = buildImportErrorReportCsv([
    {
      row: 42,
      errors: [
        {
          field: "email",
          code: "INVALID_EMAIL",
          message: "格式不正確",
          value: "a@b",
        },
      ],
    },
  ]);
  const [header, line] = csv.split("\n");
  assert.equal(header.split(",").length, 5);
  assert.equal(line.split(",").length, 5);
  assert.equal(line.startsWith("42,"), true);
});
