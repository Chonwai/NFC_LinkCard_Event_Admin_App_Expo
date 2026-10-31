/**
 * 從列表回應算出投票結果（純函式）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx:15-35`
 * 的 `computeResults`。**逐條照抄**，包含它刻意不去碰的那一個欄位。
 *
 * ## 為什麼不呼叫 `GET …/polls/:pollId/results`
 *
 * 那條端點存在（`sessions-polls.routes.ts:58`），但 Web 不呼叫它。Web 的註解
 * 寫得很清楚：`listPolls` 已經把每一票帶回來（後端
 * `include: { votes: { select: { selectedOption: true } } }`），再為每個投票
 * 各打一次結果端點就是典型的 N+1。App 照同一條路——一次列表、全部算完。
 *
 * ## ⚠️ `option.voteCount` 是陷阱
 *
 * 後端 `createPoll` 把每個選項存成 `{ id: 'opt1', text, voteCount: 0 }`，
 * 而 `vote` 只寫進 `eventPollVote` 資料表，**不會回頭更新 options 陣列裡的
 * `voteCount`**。所以那個 0 永遠是 0。
 *
 * 若有人認為「選項上都已經有 voteCount 了，何必自己數」，把這裡改成
 * `opt.voteCount`，結果會**全部變成 0**，而且沒有任何錯誤、沒有任何型別問題。
 * 這正是為什麼這個函式要被單獨測（`tests/poll-results.test.mjs` 有一條
 * 專門把 `voteCount` 給成非 0 的值，驗證它被忽略）。
 *
 * ## 照抄下來的三個邊界（Web 也是這樣，不要「順手修好」）
 *
 * 1. `votes` 缺席（例如剛建立、或後端沒 include）→ 總票數 0、每列 0。
 * 2. `votes` 指向一個**不在 options 裡**的選項 id → 它會被算進 `totalVotes`，
 *    但不會出現在任何一條結果裡，所以各列票數加起來可能小於總票數。
 *    這在後端改過選項的舊資料上真的會發生。
 * 3. 百分比用 `Math.round` —— 三列各 33.3% 會顯示成 33/33/33（合計 99%），
 *    不是 100%。用四捨五入湊到剛好 100 需要「最大餘數法」之類的補償，
 *    Web 沒做，App 也不做：兩邊顯示同一個數字比各自漂亮重要。
 */
import type { EventPoll, PollResults } from "@/types/poll.types";

/**
 * 一列的百分比（0–100 整數）。
 *
 * 總票數為 0 時回 0——不是 `NaN`，也不是把分母當 1。
 */
export function votePercent(voteCount: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return Math.round((voteCount / totalVotes) * 100);
}

/** 把一筆投票的原始 `votes[]` 彙總成計票結果。 */
export function computePollResults(poll: EventPoll): PollResults {
  const countMap: Record<string, number> = {};
  for (const vote of poll.votes ?? []) {
    countMap[vote.selectedOption] = (countMap[vote.selectedOption] ?? 0) + 1;
  }

  return {
    pollId: poll.id,
    question: poll.question,
    isActive: poll.isActive,
    totalVotes: poll.votes?.length ?? 0,
    results: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      // 只數 `votes[]`，**不看** `option.voteCount`（見檔頭）。
      voteCount: countMap[option.id] ?? 0,
    })),
  };
}
