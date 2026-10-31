/**
 * 投票（Event Poll）型別 — parity `polls`。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/types.ts:910-929` 的
 * `EventPoll` 與 `PollResults`。**逐字照 Web 建模，不多也不少**——
 * 少一個欄位就讀不到後端回的資料，多一個欄位就會有人「順手補齊」送進 PATCH。
 *
 * ## 為什麼獨立成一個檔案而不是塞回 `api.types.ts`
 *
 * `api.types.ts` 是匯入宿主，不是方法論所在。投票這組型別有一個必須寫在
 * 型別旁邊的約定（`options[].voteCount` 是**建立時的快照**、真正的計票來源是
 * `votes[]`，見下），塞進 726 行的檔案裡會沒有人看到。內容服務（`content`）
 * 當初選擇加在 `api.types.ts`，這裡選擇分檔，理由僅止於此，不是新的分層。
 */

/**
 * 一個選項。
 *
 * ⚠️ `voteCount` 是**建立投票時寫進 JSON 的 0**（後端
 * `EventPollService.createPoll` 把 `{ id: 'opt1', text, voteCount: 0 }`
 * 存成 options 陣列），**投票時不會被更新**。
 *
 * 所以它不能用來計票。真正的計票來源是 `EventPoll.votes[]`——後端
 * `listPolls` 的 `include: { votes: { select: { selectedOption: true } } }`
 * 會把每一票帶回來。Web 的 `computeResults()` 就是只數 `votes[]`，
 * App 照抄同一條式子。若有人改成「相信 voteCount」，所有投票結果會永遠是 0，
 * 而且不會有任何錯誤。
 */
export interface EventPollOption {
  id: string;
  text: string;
  /** 建立時的 0 快照。**不是**計票來源，見上方說明。 */
  voteCount?: number;
}

/** 一票。後端 `listPolls` 只 select 這一欄。 */
export interface EventPollVote {
  selectedOption: string;
}

/** `GET …/polls` 的 `polls[]` 元素（＝後端 `eventPoll` 資料表一列）。 */
export interface EventPoll {
  id: string;
  eventId: string;
  question: string;
  options: EventPollOption[];
  isActive: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  /**
   * 原始票數清單。**只有列表端點會帶**（結果端點回的是彙總）。
   * 選填是因為建立／啟用／關閉的回應不含這個關聯。
   */
  votes?: EventPollVote[];
}

/**
 * `POST …/polls` 的 body。
 *
 * 後端只讀 `question` 與 `options` 兩個欄位（`EventPollController.createPoll`
 * 的解構），且 `options.length < 2` 直接回 400 `VALIDATION_ERROR`。
 * 選項本身的清洗（trim + 去空）在呼叫端做，與 Web 的
 * `cleanOptions = options.map(trim).filter(Boolean)` 同一步。
 */
export interface PollCreatePayload {
  question: string;
  options: string[];
}

/** `GET …/polls/:pollId/results` 的回應（後端 `EventPollService.getResults`）。 */
export interface PollResults {
  pollId: string;
  question: string;
  isActive: boolean;
  totalVotes: number;
  results: { id: string; text: string; voteCount: number }[];
}
