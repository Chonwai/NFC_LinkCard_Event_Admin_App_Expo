/**
 * `pollService` 的語意測試（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 * 投票後台的四支呼叫有兩個「TypeScript 看不到」的坑：
 *
 * 1. **body 的欄位集合**。後端 `EventPollController.createPoll` 解構
 *    `{ question, options }`，多送的欄位會被忽略——這一點比內容服務安全
 *    （那邊是 `hasOwn` 語意，多送 `null` 會清空）。但「App 送了 Web 沒送的
 *    欄位」仍然是能力漂移，所以這裡照樣釘住確切的 key 集合。
 * 2. **不該帶 body 的呼叫**。`activate`／`close` 在後端只讀路徑參數
 *    （`EventPollController.activatePoll`／`closePoll` 不解讀 req.body）。
 *    若有人「順手」補一個 `{}`，現在不會壞，但下一版後端若把 body 當成
 *    「有送才改」，這就會變成一個什麼都沒改卻看起來成功的請求。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是 `tests/poll-contract.test.mjs`
 *   與全域 `npm run check:contract` 的事。
 * - **不驗**計票算術——那是 `tests/poll-results.test.mjs` 的事。
 *
 * 三支都要綠才算這個能力完整。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/**
 * 列表回傳的投票。刻意帶 `votes[]` 與**非 0** 的 `voteCount`：
 * 只有這樣才驗得出來「回傳值有沒有被改寫」，以及計票該看哪一邊。
 */
const POLL = {
  id: "poll-1",
  eventId: "evt-1",
  question: "今年最想看哪一場？",
  options: [
    { id: "opt1", text: "開幕演講", voteCount: 0 },
    { id: "opt2", text: "工作坊", voteCount: 0 },
  ],
  isActive: true,
  startedAt: "2026-11-01T00:00:00.000Z",
  endedAt: null,
  votes: [{ selectedOption: "opt1" }, { selectedOption: "opt1" }],
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return { data: { data: { polls: [POLL] } } };
      },
      post: async (url, body) => {
        calls.push({ method: "POST", url, body });
        return { data: { data: { poll: POLL } } };
      },
      patch: async (url, body) => {
        calls.push({ method: "PATCH", url, body });
        return { data: { data: { poll: POLL } } };
      },
    },
  },
});

const { pollService } = await import("@/services/poll.service");

const POLLS = "/api/v1/events/evt-1/polls";

/**
 * 四支呼叫的期望形狀。
 *
 * `body` 只給「這支呼叫該送的東西」；`undefined` 表示這支**不帶** body。
 */
const EXPECTED = [
  {
    name: "listPolls",
    method: "GET",
    url: POLLS,
    invoke: () => pollService.listPolls("evt-1"),
  },
  {
    name: "createPoll",
    method: "POST",
    url: POLLS,
    body: { question: "今年最想看哪一場？", options: ["開幕演講", "工作坊"] },
    invoke: () =>
      pollService.createPoll("evt-1", {
        question: "今年最想看哪一場？",
        options: ["開幕演講", "工作坊"],
      }),
  },
  {
    name: "activatePoll",
    method: "PATCH",
    url: `${POLLS}/poll-1/activate`,
    invoke: () => pollService.activatePoll("evt-1", "poll-1"),
  },
  {
    name: "closePoll",
    method: "PATCH",
    url: `${POLLS}/poll-1/close`,
    invoke: () => pollService.closePoll("evt-1", "poll-1"),
  },
];

// ---------------------------------------------------------------------------
// 一、方法、路徑與 body（每支都恰好打一次）
// ---------------------------------------------------------------------------

for (const expected of EXPECTED) {
  test(`${expected.name}: ${expected.method} ${expected.url}`, async () => {
    calls.length = 0;
    await expected.invoke();

    assert.equal(calls.length, 1, `${expected.name} 應該恰好打一次`);
    assert.equal(
      calls[0].method,
      expected.method,
      `${expected.name} 的 method 變了`,
    );
    assert.equal(calls[0].url, expected.url, `${expected.name} 的路徑搬家了`);

    if (expected.body !== undefined) {
      assert.deepEqual(
        calls[0].body,
        expected.body,
        `${expected.name} 的 body 被改寫了`,
      );
    } else {
      assert.equal(
        calls[0].body,
        undefined,
        `${expected.name} 不該帶 body——後端只讀路徑參數`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 二、body 的欄位集合（不多不少）
// ---------------------------------------------------------------------------

test("createPoll 的 body 恰好是 question 與 options 兩個鍵", async () => {
  calls.length = 0;
  await pollService.createPoll("evt-1", {
    question: "Q",
    options: ["A", "B"],
  });

  assert.deepEqual(
    Object.keys(calls[0].body).sort(),
    ["options", "question"],
    "createPoll 多送或少送了欄位——後端只讀這兩個，多的是能力漂移",
  );
});

test("createPoll 原樣轉發呼叫端洗好的選項（service 不代為 trim／去空）", async () => {
  // Web 的 `handleCreate` 先 `map(trim).filter(Boolean)` 再送。
  // 若 service 再洗一次，畫面上的「第幾個選項被丟掉」就會對不起來。
  calls.length = 0;
  await pollService.createPoll("evt-1", {
    question: "  Q  ",
    options: [" A ", "B", "   "],
  });

  assert.deepEqual(calls[0].body, {
    question: "  Q  ",
    options: [" A ", "B", "   "],
  });
});

// ---------------------------------------------------------------------------
// 三、信封解讀（回傳的是 `data.data`，不是整個 axios 回應）
// ---------------------------------------------------------------------------

test("listPolls 回傳解開信封後的 polls 陣列（含 votes）", async () => {
  const res = await pollService.listPolls("evt-1");

  assert.equal(res.polls.length, 1);
  assert.equal(res.polls[0].id, "poll-1");
  assert.equal(
    res.polls[0].votes?.length,
    2,
    "listPolls 必須把 votes 帶回來——那是唯一的計票來源",
  );
});

test("createPoll／activatePoll／closePoll 都回傳 poll 物件", async () => {
  for (const invoke of [
    () =>
      pollService.createPoll("evt-1", { question: "Q", options: ["A", "B"] }),
    () => pollService.activatePoll("evt-1", "poll-1"),
    () => pollService.closePoll("evt-1", "poll-1"),
  ]) {
    const res = await invoke();
    assert.equal(res.poll.id, "poll-1");
  }
});

// ---------------------------------------------------------------------------
// 四、eventId／pollId 有做 URL 編碼
// ---------------------------------------------------------------------------

test("eventId 與 pollId 都經過編碼（含斜線或空白也不會把路徑串歪）", async () => {
  calls.length = 0;
  await pollService.activatePoll("evt/1", "poll 1");

  assert.equal(
    calls[0].url,
    "/api/v1/events/evt%2F1/polls/poll%201/activate",
    "路徑參數沒有編碼——一個含斜線的 id 會打出另一條路徑",
  );
});
