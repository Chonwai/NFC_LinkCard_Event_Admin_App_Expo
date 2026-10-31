/**
 * 建立投票的表單邏輯（純函式，供 `polls.tsx` 與測試共用）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx`
 * 的 `handleCreate`，逐條照抄它的三條件：
 *
 * 1. `options` 從兩個空字串起算（`useState(['', ''])`）。
 * 2. 選項數**上限 5**：Web 的「+ 新增選項」按鈕只在 `options.length < 5` 時
 *    出現。這個 5 **只存在於 Web 的畫面**——後端 `createPoll` 沒有這條限制，
 *    所以少了它，手機反而變成一個 Web 沒有的後門（與 `content.tsx` 的
 *    `MAX_SECTIONS = 6` 同一個道理）。
 * 3. 送出前 `map(trim).filter(Boolean)`，剩下不足兩個就不送。
 *    **不去重**：Web 也沒有去重，兩個同名選項在 Web 上建得出來。
 *    這裡不「順手修好」，因為那會讓 App 拒絕一份 Web 願意接受的輸入。
 *
 * 為什麼抽成純函式：這個 repo 的測試是 node test runner（`tests/*.test.mjs`），
 * 沒有 React renderer，寫在 `.tsx` 裡的驗證邏輯驗不到。既有做法相同——
 * `utils/page-content-payload.ts`、`utils/guest-import.ts`、
 * `utils/event-profile-validation.ts` 都是同一個模式。
 */
import type { PollCreatePayload } from "@/types/poll.types";

/** 選項數下限（＝後端 `createPoll` 的 400 門檻，也是 Web 的起始兩格）。 */
export const POLL_MIN_OPTIONS = 2;

/** 選項數上限。**只存在於 Web 畫面**，不是後端限制（見檔頭）。 */
export const POLL_MAX_OPTIONS = 5;

/** 還能再加一個選項嗎？（對應 Web 的 `options.length < 5`） */
export function canAddPollOption(options: readonly string[]): boolean {
  return options.length < POLL_MAX_OPTIONS;
}

/**
 * 還能刪掉一個選項嗎？（對應 Web 的 `options.length > 2`）
 *
 * 下限是 2 而不是 1：一個只有單選項的投票在後端會被 400 擋掉，
 * 讓使用者先刪到 1 再送出只會換來一個錯誤訊息。
 */
export function canRemovePollOption(options: readonly string[]): boolean {
  return options.length > POLL_MIN_OPTIONS;
}

/**
 * 表單狀態 → `POST …/polls` 的 body。**不合法時回 `null`**（呼叫端據此不送出）。
 *
 * 回傳的 `options` 是清洗後的結果（每項 trim、去空字串），
 * 但**保留重複**——理由見檔頭第 3 點。
 */
export function toPollPayload(
  question: string,
  options: readonly string[],
): PollCreatePayload | null {
  const trimmedQuestion = question.trim();
  const cleanedOptions = options
    .map((option) => option.trim())
    .filter((option) => option.length > 0);

  if (trimmedQuestion.length === 0) return null;
  if (cleanedOptions.length < POLL_MIN_OPTIONS) return null;

  return { question: trimmedQuestion, options: cleanedOptions };
}
