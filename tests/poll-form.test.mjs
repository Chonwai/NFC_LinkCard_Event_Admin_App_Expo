/**
 * 建立投票的表單驗證（`src/utils/poll-form.ts`）。
 *
 * ## 為什麼要這一支
 * 三個數字與一條清洗規則**全部只存在於 Web 的畫面**裡
 * （`LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx:45-90`），
 * 後端只擋 `options.length < 2`。也就是說：
 *
 * - 少抄「上限 5」→ App 建得出 20 個選項的投票，Web 建不出來 ⇒ **App 是超集**。
 * - 少抄「trim + 去空」→ 送出 `['', '']` 這種「兩個空選項」的投票，
 *   後端 `options.length < 2` 的檢查照樣通過（因為陣列長度是 2），
 *   於是資料庫裡會躺著一個沒有選項可投的投票。這是最陰的一條：
 *   **它不會 400，只會默默存進去**。
 * - 多抄一條「去重」→ App 拒絕一份 Web 願意接受的輸入 ⇒ 反過來是子集。
 *
 * 三條都可能發生，而且都不會讓 typecheck 或任何既有測試變紅。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  canAddPollOption,
  canRemovePollOption,
  toPollPayload,
} = await import("@/utils/poll-form");

// ---------------------------------------------------------------------------
// 一、上限與下限（照抄 Web 的 5 與 2）
// ---------------------------------------------------------------------------

test("選項數上限是 5（只存在於 Web 畫面，不是後端限制）", () => {
  assert.equal(POLL_MAX_OPTIONS, 5);
  assert.equal(POLL_MIN_OPTIONS, 2);

  assert.equal(canAddPollOption(["a", "b", "c", "d"]), true);
  assert.equal(
    canAddPollOption(["a", "b", "c", "d", "e"]),
    false,
    "5 個之後就不該再出現「新增選項」",
  );
});

test("選項數不得刪到低於 2（單選項的投票後端也會 400）", () => {
  assert.equal(canRemovePollOption(["a", "b", "c"]), true);
  assert.equal(
    canRemovePollOption(["a", "b"]),
    false,
    "2 個時就不該再出現刪除鈕",
  );
});

// ---------------------------------------------------------------------------
// 二、清洗：trim、去空、保留重複
// ---------------------------------------------------------------------------

test("送出前 trim 每一個選項與問題", () => {
  assert.deepEqual(
    toPollPayload("  你最想看哪場？  ", ["  開幕  ", " 工作坊 "]),
    {
      question: "你最想看哪場？",
      options: ["開幕", "工作坊"],
    },
  );
});

test("空字串選項會被丟掉（送出後不足 2 個就整筆不送）", () => {
  // 這是 Web 的行為：`cleanOptions = options.map(trim).filter(Boolean)`
  assert.equal(toPollPayload("Q", ["A", "   "]), null);
  assert.equal(toPollPayload("Q", ["   ", ""]), null);
  assert.deepEqual(toPollPayload("Q", ["A", "   ", "B"]), {
    question: "Q",
    options: ["A", "B"],
  });
});

test("兩個空選項會被擋下來——後端擋不住這一種", () => {
  // 關鍵：`['', '']` 的陣列長度是 2，後端 `options.length < 2` **不會**觸發，
  // 於是一個沒有任何可投選項的投票就存進資料庫了。
  assert.equal(toPollPayload("Q", ["", ""]), null);
});

test("問題是空白時不送", () => {
  assert.equal(toPollPayload("   ", ["A", "B"]), null);
  assert.equal(toPollPayload("", ["A", "B"]), null);
});

test("重複的選項保留（Web 也不去重，App 不擅自收緊）", () => {
  assert.deepEqual(toPollPayload("Q", ["A", "A"]), {
    question: "Q",
    options: ["A", "A"],
  });
});

// ---------------------------------------------------------------------------
// 三、邊界：剛好兩個、剛好五個
// ---------------------------------------------------------------------------

test("剛好兩個有效選項是可送的（下限不是「大於 2」）", () => {
  assert.deepEqual(toPollPayload("Q", ["A", "B"]), {
    question: "Q",
    options: ["A", "B"],
  });
});

test("拿到第六個選項時不砍掉，只是不再提供「新增」（Web 也一樣）", () => {
  const six = ["A", "B", "C", "D", "E", "F"];
  assert.deepEqual(toPollPayload("Q", six), {
    question: "Q",
    options: six,
  });
  assert.equal(canAddPollOption(six), false);
});
