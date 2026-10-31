/**
 * 貴賓名單匯入的**純規則**鎖定。
 *
 * 這三條規則寫錯都不會有型別錯誤，只會在特定資料量或特定錯誤型態下才炸：
 *
 * 1. **切批上限 100**。BE 對超量請求是**整批拒絕**，不是截斷——剛好 100 與
 *    101 的差別是「成功」與「全部失敗」。而且空陣列不能切成 `[[]]`：那會
 *    送出一條「寄 0 筆」的請求。
 * 2. **逐列錯誤的格式**（`#3：訊息A / 訊息B`）與 Web 一致。同一個錯誤在兩端
 *    寫成兩種樣子，操作員會以為是兩件事。
 * 3. **suggestions 去重**。後端可能從多個錯誤重複給同一個建議；不去重會讓
 *    操作員以為那是兩個不同選項。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  GUEST_IMPORT_NOTIFY_BATCH_SIZE,
  chunkRegistrationIds,
  hasBlockingRows,
  invalidRowText,
  previewCounts,
  suggestionNames,
} = await import("@/utils/guest-import");

test("切批上限與 BE NOTIFY_MAX 同一個數字（100）", () => {
  assert.equal(GUEST_IMPORT_NOTIFY_BATCH_SIZE, 100);
});

test("空陣列不切出 `[[]]`（那會送出一條「寄 0 筆」的請求）", () => {
  assert.deepEqual(chunkRegistrationIds([]), []);
});

test("剛好 100 筆＝一批；101 筆＝兩批（第二批 1 筆）", () => {
  const exactly = Array.from({ length: 100 }, (_, i) => `id-${i}`);
  assert.equal(chunkRegistrationIds(exactly).length, 1);
  assert.equal(chunkRegistrationIds(exactly)[0].length, 100);

  const over = [...exactly, "id-100"];
  const batches = chunkRegistrationIds(over);
  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [100, 1],
  );
});

test("切批不遺漏、不重複、保持原順序", () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
  const flat = chunkRegistrationIds(ids).flat();
  assert.deepEqual(flat, ids);
});

test("逐列錯誤的格式與 Web 一致：`#3：訊息A / 訊息B`", () => {
  assert.equal(
    invalidRowText({
      row: 3,
      errors: [
        { message: "ticketType 找不到 general" },
        { message: "email 格式不正確" },
      ],
    }),
    "#3：ticketType 找不到 general / email 格式不正確",
  );
});

test("suggestions 依 name 去重（同一個建議不該看起來像兩個選項）", () => {
  assert.deepEqual(
    suggestionNames({
      errors: [
        {
          suggestions: [
            { name: "general", displayName: "普通票" },
            { name: "vip", displayName: "貴賓票" },
          ],
        },
        {
          suggestions: [{ name: "vip", displayName: "貴賓票" }],
        },
      ],
    }),
    ["general", "vip"],
  );
  assert.deepEqual(
    suggestionNames({ errors: [{ message: "no suggestions" }] }),
    [],
  );
});

test("預覽計數用各陣列長度，不是 `total - invalid - duplicates`", () => {
  assert.deepEqual(
    previewCounts({
      // 一列可以既重複又無效，三類不是互斥分割；用減法會算出負數。
      totalRows: 5,
      valid: [{ row: 1 }, { row: 2 }],
      invalid: [{ row: 3 }, { row: 4 }, { row: 5 }],
      duplicates: [{ row: 3 }, { row: 4 }, { row: 5 }],
      capacityImpact: [],
    }),
    { total: 5, valid: 2, invalid: 3, duplicates: 3 },
  );
  assert.deepEqual(previewCounts(null), {
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
  });
});

test("有任何一列無效就阻擋匯入（不允許部分匯入）", () => {
  assert.equal(
    hasBlockingRows({
      totalRows: 1,
      valid: [],
      invalid: [
        { row: 1, errors: [{ field: "email", code: "X", message: "y" }] },
      ],
      duplicates: [],
      capacityImpact: [],
    }),
    true,
  );
  assert.equal(
    hasBlockingRows({
      totalRows: 1,
      valid: [{ row: 1, email: "a@b.c", ticketType: "general" }],
      invalid: [],
      duplicates: [],
      capacityImpact: [],
    }),
    false,
  );
  assert.equal(hasBlockingRows(null), false);
});
