/**
 * `sessionService` 的語意測試（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 *
 * 場次後台的四支呼叫有兩個「TypeScript 看不到」的坑：
 *
 * 1. **body 的欄位集合**。後端 `CreateSessionDto`
 *    （`EventSessionController.ts:21-33`）只讀 10 個欄位，多送的會被忽略——
 *    但「App 送了 Web 沒送的欄位」仍然是能力漂移。特別是 `exhibitorId` 與
 *    `isPublished`：後端**收**這兩個，Web 表單**不送**。若有人「順手」補上，
 *    功能會動，但 App 就多了一個 Web 沒有的能力。
 * 2. **`null` 與「不送」的差別**。後端 `updateSession`
 *    （`EventSessionService.ts:209-237`）是 `input.x !== undefined` 語意：
 *    送 `null` ＝**清空**，不送 ＝**原封不動**。這一支釘住「每次都送完整
 *    payload，且清空欄位真的是 `null`」。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是 `tests/session-contract.test.mjs`
 *   與全域 `npm run check:contract` 的事。
 * - **不驗**名冊的三態算術——那是後端 `deriveSessionAttendanceState` 的事，
 *   App 只呈現它算好的 `attendanceState`。
 *
 * ## 為什麼要斷言 `deleteSession` **不存在**
 *
 * 後端沒有 `DELETE /sessions/:sessionId`（`sessions-polls.routes.ts:27-49`），
 * 而 Web 有一支活的 `deleteSession` 打這條不存在的路由（按下必 404）。
 * 「App 沒有這支」是**本輪的決定**，不是還沒做——所以要釘住，
 * 否則下一個人看到「少一支」會很自然地把它補回來。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/** 列表回傳的場次。`currentCount` 與 `capacity` 刻意不同，才驗得出沒有被改寫。 */
const SESSION = {
  id: "ses-1",
  eventId: "evt-1",
  title: "開幕演講",
  description: "開場",
  sessionType: "KEYNOTE",
  startDate: "2026-11-05T02:00:00.000Z",
  endDate: "2026-11-05T03:00:00.000Z",
  location: "主舞台",
  speakerName: "王小明",
  capacity: 100,
  currentCount: 41,
  price: "0",
  tokenCost: 0,
  isRegistered: false,
};

/** 名冊回應。`attendance` 的三個數字刻意不自洽於 `total`，用來驗「原樣轉發」。 */
const ROSTER = {
  session: {
    id: "ses-1",
    title: "開幕演講",
    capacity: 100,
    currentCount: 41,
    registeredCount: 41,
    startDate: "2026-11-05T02:00:00.000Z",
    endDate: "2026-11-05T03:00:00.000Z",
    location: "主舞台",
    sessionType: "KEYNOTE",
  },
  registrations: [
    {
      id: "sreg-1",
      sessionId: "ses-1",
      registrationId: "reg-1",
      attendedAt: null,
      attendanceState: "REGISTERED",
      createdAt: "2026-10-01T00:00:00.000Z",
      registration: {
        id: "reg-1",
        registrationCode: "LC-0001",
        firstName: "小明",
        lastName: "王",
        email: "ming@example.com",
        phone: null,
        company: "ACME",
        status: "CONFIRMED",
        ticketType: { id: "tt-1", displayName: "一般票" },
      },
    },
  ],
  attendance: { total: 41, attended: 7, registered: 34, noShow: 0 },
  pagination: { page: 1, limit: 50, total: 41, totalPages: 1 },
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        // 名冊與列表共用 GET，用路徑尾巴分辨回哪一份。
        if (url.includes("/registrations")) {
          return { data: { data: ROSTER } };
        }
        return { data: { data: { sessions: [SESSION] } } };
      },
      post: async (url, body) => {
        calls.push({ method: "POST", url, body });
        return { data: { data: { session: SESSION } } };
      },
      patch: async (url, body) => {
        calls.push({ method: "PATCH", url, body });
        return { data: { data: { session: SESSION } } };
      },
    },
  },
});

const { sessionService } = await import("@/services/session.service");

const SESSIONS = "/api/v1/events/evt-1/sessions";

/** 完整的建立／更新 payload——10 個鍵，一個不多一個不少。 */
const FULL_PAYLOAD = {
  title: "開幕演講",
  description: "開場",
  sessionType: "KEYNOTE",
  startDate: "2026-11-05T02:00:00.000Z",
  endDate: "2026-11-05T03:00:00.000Z",
  location: "主舞台",
  speakerName: "王小明",
  capacity: 100,
  price: 0,
  tokenCost: 0,
};

/**
 * 四支呼叫的期望形狀。
 *
 * `body` 只給「這支呼叫該送的東西」；`undefined` 表示這支**不帶** body。
 */
const EXPECTED = [
  {
    name: "listSessions",
    method: "GET",
    url: SESSIONS,
    invoke: () => sessionService.listSessions("evt-1"),
  },
  {
    name: "createSession",
    method: "POST",
    url: SESSIONS,
    body: FULL_PAYLOAD,
    invoke: () => sessionService.createSession("evt-1", FULL_PAYLOAD),
  },
  {
    name: "updateSession",
    method: "PATCH",
    url: `${SESSIONS}/ses-1`,
    body: FULL_PAYLOAD,
    invoke: () => sessionService.updateSession("evt-1", "ses-1", FULL_PAYLOAD),
  },
  {
    name: "listSessionRegistrations",
    method: "GET",
    url: `${SESSIONS}/ses-1/registrations?page=1&limit=50`,
    invoke: () =>
      sessionService.listSessionRegistrations("evt-1", "ses-1", {
        page: 1,
        limit: 50,
      }),
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

test("建立與更新的 body 恰好是那 10 個鍵", async () => {
  const EXPECTED_KEYS = [
    "capacity",
    "description",
    "endDate",
    "location",
    "price",
    "sessionType",
    "speakerName",
    "startDate",
    "title",
    "tokenCost",
  ];

  for (const invoke of [
    () => sessionService.createSession("evt-1", FULL_PAYLOAD),
    () => sessionService.updateSession("evt-1", "ses-1", FULL_PAYLOAD),
  ]) {
    calls.length = 0;
    await invoke();
    assert.deepEqual(
      Object.keys(calls[0].body).sort(),
      EXPECTED_KEYS,
      "多送或少送欄位了——注意 exhibitorId／isPublished 是後端收但 Web 不送的，加進來就是能力漂移",
    );
  }
});

test("清空欄位送的是 null，不是省略——後端靠這個分辨『清空』與『不改』", async () => {
  // 後端 updateSession 是 `input.x !== undefined` 語意：
  // 送 null ⇒ 清空；不送 ⇒ 原封不動。若這裡改成省略，編輯頁就永遠刪不掉主講人。
  const cleared = {
    ...FULL_PAYLOAD,
    description: null,
    location: null,
    speakerName: null,
    capacity: null,
    price: null,
  };

  calls.length = 0;
  await sessionService.updateSession("evt-1", "ses-1", cleared);

  assert.deepEqual(calls[0].body, cleared);
  assert.equal(calls[0].body.description, null, "description 必須是 null");
  assert.equal(calls[0].body.speakerName, null, "speakerName 必須是 null");
  assert.ok(
    "capacity" in calls[0].body,
    "capacity 必須出現在 body 裡（值為 null）——省略等於不改",
  );
});

// ---------------------------------------------------------------------------
// 三、名冊的查詢字串
// ---------------------------------------------------------------------------

test("名冊把 page／limit 明確送出去（不吃後端預設值）", async () => {
  calls.length = 0;
  await sessionService.listSessionRegistrations("evt-1", "ses-1", {
    page: 3,
    limit: 50,
  });

  const url = new URL(calls[0].url, "https://example.invalid");
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(
    url.searchParams.get("limit"),
    "50",
    "limit 必須明確送：後端預設 50 若哪天改成 20，行為就會靜默改變",
  );
});

test("名冊的路徑不會因為查詢字串而變形（掃描器以第一個 ? 切斷）", async () => {
  calls.length = 0;
  await sessionService.listSessionRegistrations("evt-1", "ses-1", {
    page: 1,
    limit: 50,
  });

  assert.equal(
    calls[0].url.split("?")[0],
    `${SESSIONS}/ses-1/registrations`,
    "路徑本體必須與後端路由逐字相同，查詢只能接在 ? 之後",
  );
});

// ---------------------------------------------------------------------------
// 四、信封解讀（回傳的是 `data.data`，不是整個 axios 回應）
// ---------------------------------------------------------------------------

test("listSessions 回傳解開信封後的 sessions 陣列", async () => {
  const res = await sessionService.listSessions("evt-1");

  assert.equal(res.sessions.length, 1);
  assert.equal(res.sessions[0].id, "ses-1");
  assert.equal(
    res.sessions[0].currentCount,
    41,
    "currentCount 是後端算好的活列數，service 不得改寫",
  );
});

test("createSession／updateSession 都回傳 session 物件", async () => {
  for (const invoke of [
    () => sessionService.createSession("evt-1", FULL_PAYLOAD),
    () => sessionService.updateSession("evt-1", "ses-1", FULL_PAYLOAD),
  ]) {
    const res = await invoke();
    assert.equal(res.session.id, "ses-1");
  }
});

test("listSessionRegistrations 原樣帶回 attendance 與 pagination", async () => {
  const res = await sessionService.listSessionRegistrations("evt-1", "ses-1", {
    page: 1,
    limit: 50,
  });

  assert.deepEqual(res.attendance, ROSTER.attendance);
  assert.equal(res.pagination.totalPages, 1);
  assert.equal(res.registrations[0].attendanceState, "REGISTERED");
});

// ---------------------------------------------------------------------------
// 五、刻意缺席的那一支
// ---------------------------------------------------------------------------

test("sessionService 沒有 deleteSession——後端沒有這條路由，Web 那顆是 404", () => {
  assert.equal(
    sessionService.deleteSession,
    undefined,
    "deleteSession 不存在是刻意的：後端沒有 DELETE /sessions/:sessionId（見 12 §12.3.2 ESC-CRA-001）",
  );
  assert.equal(sessionService.removeSession, undefined);
});
