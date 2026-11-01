/**
 * `src/utils/badge-batch.ts`：建立批次的驗證與確認內容。
 *
 * ## 這支測試存在的理由
 *
 * `count` 的邊界（1／500）與色碼的接受集合，兩邊都來自**別的地方**：
 * 上下限來自後端 DTO，色碼集合來自 Web 的 `isValidCssColor`。這種「抄過來的
 * 規則」最容易在後續重構中悄悄漂移——而漂移的後果是「操作員在 App 上填不進
 * 去，在 Web 上卻可以」。所以逐條釘住。
 *
 * ## 一個刻意的寬鬆
 *
 * `rgb(999,999,999)` 這種通道值超出範圍的色碼**會通過**。這不是漏洞，是
 * 對齊：Web 的 regex 也不檢查通道上限。多檢查會讓同一份輸入在兩個平台得到
 * 不同結果，而這個欄位只是備註性質的中繼資料（後端 `colorCode` 是
 * `@IsString()`，不驗格式）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  CREATE_BATCH_MAX,
  CREATE_BATCH_MIN,
  buildCreateBatchConfirmation,
  isValidBadgeColor,
  parseCreateBatchInput,
} = await import("@/utils/badge-batch");

/** 一份合法輸入，測試只覆蓋關心的欄位。 */
function input(overrides = {}) {
  return {
    count: "50",
    badgeType: null,
    colorCode: "",
    batchLabel: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 一、常數：與後端 DTO 一致
// ---------------------------------------------------------------------------

test("上下限就是後端 DTO 的 1 與 500", () => {
  assert.equal(CREATE_BATCH_MIN, 1);
  assert.equal(CREATE_BATCH_MAX, 500);
});

// ---------------------------------------------------------------------------
// 二、count 邊界
// ---------------------------------------------------------------------------

test("count: 1 與 500 都合法（含端點）", () => {
  assert.equal(parseCreateBatchInput(input({ count: "1" })).ok, true);
  assert.equal(parseCreateBatchInput(input({ count: "500" })).ok, true);
});

test("count: 0 與 501 都不合法", () => {
  assert.deepEqual(parseCreateBatchInput(input({ count: "0" })), {
    ok: false,
    error: "countRange",
  });
  assert.deepEqual(parseCreateBatchInput(input({ count: "501" })), {
    ok: false,
    error: "countRange",
  });
});

test("count: 負數、小數、非數字、空字串都不合法", () => {
  for (const raw of ["-1", "5.5", "abc", "", "  "]) {
    assert.deepEqual(
      parseCreateBatchInput(input({ count: raw })),
      { ok: false, error: "countRange" },
      `"${raw}" 應該被擋`,
    );
  }
});

test("count: 前後有空白的數字仍可解析（TextInput 常帶空白）", () => {
  const parsed = parseCreateBatchInput(input({ count: " 120 " }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.params.count, 120);
});

test("count: 合法時一定是 number，不是字串（後端 @IsInt）", () => {
  const parsed = parseCreateBatchInput(input({ count: "120" }));
  assert.equal(parsed.ok, true);
  assert.equal(typeof parsed.params.count, "number");
});

// ---------------------------------------------------------------------------
// 三、色碼集合：與 Web 的 isValidCssColor 逐條一致
// ---------------------------------------------------------------------------

test("色碼：hex 3/4/6/8 位都接受", () => {
  for (const value of ["#abc", "#abcd", "#a1b2c3", "#a1b2c3d4"]) {
    assert.equal(isValidBadgeColor(value), true, `${value} 應該通過`);
  }
});

test("色碼：rgb()／rgba()／hsl()／hsla() 都接受（Web 也接受，不能少）", () => {
  for (const value of [
    "rgb(124,58,237)",
    "rgba(124,58,237,0.5)",
    "hsl(262,83%,58%)",
    "hsla(262,83%,58%,1)",
  ]) {
    assert.equal(isValidBadgeColor(value), true, `${value} 應該通過`);
  }
});

test("色碼：空字串、色名、亂碼都不接受", () => {
  for (const value of ["", "   ", "purple", "javascript:alert(1)", "#12"]) {
    assert.equal(isValidBadgeColor(value), false, `${value} 應該被擋`);
  }
});

test("色碼：通道值超界照樣通過（刻意與 Web 一致，見檔頭）", () => {
  assert.equal(isValidBadgeColor("rgb(999,999,999)"), true);
});

test("色碼：色碼格式錯誤回 colorFormat，不是 countRange", () => {
  assert.deepEqual(
    parseCreateBatchInput(input({ count: "10", colorCode: "purple" })),
    { ok: false, error: "colorFormat" },
  );
});

// ---------------------------------------------------------------------------
// 四、選填欄位：trim 後才判斷有沒有值
// ---------------------------------------------------------------------------

test("選填欄位空白 → 整個鍵不出現（不是送空字串）", () => {
  const parsed = parseCreateBatchInput(
    input({ count: "10", colorCode: "   ", batchLabel: "   " }),
  );

  assert.equal(parsed.ok, true);
  assert.deepEqual(Object.keys(parsed.params), ["count"]);
});

test("選填欄位有值 → 值被 trim，且三個鍵都在", () => {
  const parsed = parseCreateBatchInput(
    input({
      count: "10",
      badgeType: "WRISTBAND",
      colorCode: "  #7C3AED  ",
      batchLabel: "  第一批  ",
    }),
  );

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.params, {
    count: 10,
    badgeType: "WRISTBAND",
    colorCode: "#7C3AED",
    batchLabel: "第一批",
  });
});

test("badgeType 為 null → 不送（後端自己套預設 CARD，前端不猜）", () => {
  const parsed = parseCreateBatchInput(input({ count: "10", badgeType: null }));
  assert.equal(parsed.ok, true);
  assert.equal("badgeType" in parsed.params, false);
});

// ---------------------------------------------------------------------------
// 五、確認框內容
// ---------------------------------------------------------------------------

test("buildCreateBatchConfirmation: 把 undefined 收斂成 null，不是 undefined", () => {
  const confirmation = buildCreateBatchConfirmation({ count: 50 });

  assert.deepEqual(confirmation, {
    count: 50,
    badgeType: null,
    colorCode: null,
    batchLabel: null,
  });
});

test("buildCreateBatchConfirmation: 有值的欄位原樣帶出（畫面要顯示給人核對）", () => {
  const confirmation = buildCreateBatchConfirmation({
    count: 120,
    badgeType: "CARD",
    colorCode: "#7C3AED",
    batchLabel: "StartupFest 第一批",
  });

  assert.deepEqual(confirmation, {
    count: 120,
    badgeType: "CARD",
    colorCode: "#7C3AED",
    batchLabel: "StartupFest 第一批",
  });
});
