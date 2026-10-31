/**
 * 計票（`src/utils/poll-results.ts`）。
 *
 * ## 為什麼要這一支
 * 計票是這個能力裡**唯一一個「錯了畫面還是很漂亮」的地方**：所有數字都長得
 * 像數字，圖表也照比例畫，只是全部都錯。三個具體的陷阱：
 *
 * 1. **`option.voteCount` 永遠是 0**。後端 `createPoll` 把
 *    `{ id: 'opt1', text, voteCount: 0 }` 存進 options，`vote` 只寫另一張表。
 *    相信它就全部歸零。
 * 2. **`votes` 可能是 undefined**（剛建立、或回應沒 include 關聯）。
 *    沒處理就是 `TypeError`，而 Web 用 `?? []` 擋掉了。
 * 3. **百分比是四捨五入**，三列各 33% 合計 99%。這是 Web 的既定行為，
 *    不是 bug——但要有測試寫下來，否則下一個人會「順手修成 100」。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { computePollResults, votePercent } =
  await import("@/utils/poll-results");

/** 建一筆投票；`votes` 用 `selectedOption` 陣列簡寫。 */
function poll({ options, votes, isActive = true }) {
  return {
    id: "poll-1",
    eventId: "evt-1",
    question: "今年最想看哪一場？",
    isActive,
    options,
    votes:
      votes == null ? undefined : votes.map((v) => ({ selectedOption: v })),
  };
}

const TWO_OPTIONS = [
  { id: "opt1", text: "開幕演講" },
  { id: "opt2", text: "工作坊" },
];

// ---------------------------------------------------------------------------
// 一、計票只看 votes[]，不看 option.voteCount
// ---------------------------------------------------------------------------

test("票數來自 votes[]，不是選項上的 voteCount", () => {
  const result = computePollResults(
    poll({
      // 刻意給非 0 的 voteCount：後端實際上永遠是 0，但只要這裡相信它，
      // 下面兩列的票數就會變成 99／0 而不是 2／1。
      options: [
        { id: "opt1", text: "開幕演講", voteCount: 99 },
        { id: "opt2", text: "工作坊", voteCount: 0 },
      ],
      votes: ["opt1", "opt1", "opt2"],
    }),
  );

  assert.equal(result.totalVotes, 3);
  assert.equal(result.results[0].voteCount, 2, "opt1 有兩票");
  assert.equal(result.results[1].voteCount, 1, "opt2 有一票");
});

test("votes 缺席時是 0 票，不是 TypeError", () => {
  const result = computePollResults(poll({ options: TWO_OPTIONS }));

  assert.equal(result.totalVotes, 0);
  assert.deepEqual(
    result.results.map((r) => r.voteCount),
    [0, 0],
  );
});

test("空 options 也能算（回空結果，不炸）", () => {
  const result = computePollResults(poll({ options: [], votes: [] }));

  assert.equal(result.totalVotes, 0);
  assert.deepEqual(result.results, []);
});

// ---------------------------------------------------------------------------
// 二、照抄 Web 的三個邊界
// ---------------------------------------------------------------------------

test("候選項 id 不在 options 裡：算進總票數，但不出現在任何一列", () => {
  // 後端改過選項的舊資料會這樣。Web 也是這個行為。
  const result = computePollResults(
    poll({ options: TWO_OPTIONS, votes: ["opt1", "opt-gone", "opt-gone"] }),
  );

  assert.equal(result.totalVotes, 3, "總票數是 votes 的長度");
  assert.equal(
    result.results.reduce((sum, r) => sum + r.voteCount, 0),
    1,
    "各列加起來小於總票數——這是 Web 的既定行為，不要「修好」",
  );
});

test("保留 poll 的 id／question／isActive（呼叫端不必再對照原物件）", () => {
  const result = computePollResults(
    poll({ options: TWO_OPTIONS, votes: [], isActive: false }),
  );

  assert.equal(result.pollId, "poll-1");
  assert.equal(result.question, "今年最想看哪一場？");
  assert.equal(result.isActive, false);
});

test("選項標題原樣帶出（含空字串，不代為補「未命名」）", () => {
  const result = computePollResults(
    poll({ options: [{ id: "opt1", text: "" }], votes: ["opt1"] }),
  );

  assert.equal(result.results[0].text, "");
});

// ---------------------------------------------------------------------------
// 三、百分比
// ---------------------------------------------------------------------------

test("百分比用四捨五入：三列各 33%，合計 99%（Web 也是這樣）", () => {
  const result = computePollResults(
    poll({
      options: [
        { id: "opt1", text: "A" },
        { id: "opt2", text: "B" },
        { id: "opt3", text: "C" },
      ],
      votes: ["opt1", "opt2", "opt3"],
    }),
  );

  const percents = result.results.map((r) =>
    votePercent(r.voteCount, result.totalVotes),
  );
  assert.deepEqual(percents, [33, 33, 33]);
  assert.equal(
    percents.reduce((a, b) => a + b, 0),
    99,
    "不要為了湊 100 去改演算法——Web 就是 99",
  );
});

test("總票數為 0 時百分比是 0，不是 NaN", () => {
  assert.equal(votePercent(0, 0), 0);
  assert.equal(Number.isNaN(votePercent(0, 0)), false);
});

test("全票集中在一個選項時是 100%", () => {
  assert.equal(votePercent(5, 5), 100);
});
