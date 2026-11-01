/**
 * `orgRoleService` 的**語意測試**（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 *
 * 組織角色是「給出後台權限」與「收回後台權限」的呼叫，有四個 TypeScript 看不到
 * 的坑：
 *
 * 1. **`accept` 是 `POST`**。後端那條路徑上只掛了 `router.post`
 *    （`engagement.routes.ts:45`），而 Web 寫成 `PATCH`
 *    （`lib/events/engagement.ts:157`）。Web 那支零呼叫點，所以錯誤從未被發現。
 *    這裡把 method 釘住，PATCH 版本回不來。
 * 2. **回應的鍵是 `orgRoleId`，不是 `invitationId`**。Web 的型別寫成
 *    `invitationId`（`engagement.ts:143-152`），那個鍵在後端回應裡不存在——
 *    取用時永遠是 `undefined`。這裡驗「拿得到真的 id」。
 * 3. **移除的路徑參數是 `EventOrgRole.id`，不是 user id**。傳 user id 會得到
 *    `404 ORG_ROLE_NOT_FOUND`。
 * 4. **邀請只送 `email` 與 `role` 兩個鍵**。後端 DTO 是
 *    `plainToClass(InviteOrgRoleDto)` ＋ `validate()`，多送鍵不會報錯，但
 *    「多送一個鍵」就是 App 多了一個 Web 沒有的行為。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**「後端有沒有這條路徑」——那是 `tests/org-role-contract.test.mjs`
 *   與全域 `npm run check:contract` 的事。
 * - **不驗**「按下確認前有沒有先問」——那是 `utils/org-role-display.ts` 與
 *   畫面的責任（本支只管 service 原樣透傳）。
 * - **不驗**「誰有權限」——那是後端的事，App 只是提早不顯示。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, payload) 都記在這裡，供斷言觀察。 */
const calls = [];

const ORG_ROLE = {
  id: "role-1",
  eventId: "evt-1",
  userId: "user-9",
  user: {
    id: "user-9",
    email: "ops@example.com",
    username: "ops",
    display_name: "運營小幫手",
  },
  email: "ops@example.com",
  role: "COORDINATOR",
  status: "ACTIVE",
  acceptedAt: "2026-10-30T01:02:03.000Z",
  createdAt: "2026-10-30T01:02:03.000Z",
};

/**
 * 邀請的回應物件**照後端實名**：`orgRoleId`、`email`、`role`、`status`
 * （`EventOrgRoleService.inviteOrgRole:84-90`）。刻意**不含** `invitationId`。
 */
const INVITE_RESULT = {
  orgRoleId: "role-2",
  email: "new@example.com",
  role: "OPERATOR",
  status: "ACTIVE",
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url, config) => {
        calls.push({ method: "GET", url, config });
        return { data: { data: { orgRoles: [ORG_ROLE] } } };
      },
      post: async (url, payload) => {
        calls.push({ method: "POST", url, payload });
        if (url.endsWith("/accept")) {
          return { data: { data: { orgRole: ORG_ROLE } } };
        }
        return { data: { data: INVITE_RESULT } };
      },
      /**
       * 這個 mock 存在的唯一目的是**讓 PATCH 版本失敗**。
       *
       * 若有人把 `accept` 改回 Web 的 `PATCH`，這支會被呼叫、`calls` 裡就會
       * 出現一筆 `PATCH`，下面的 method 斷言立刻紅。沒有這個鍵時，`PATCH`
       * 會是 `undefined is not a function`，錯誤訊息指向 mock 而不是指向
       * 「你照抄了 Web 的死碼」——那對下一個人沒有幫助。
       */
      patch: async (url, payload) => {
        calls.push({ method: "PATCH", url, payload });
        return { data: { data: {} } };
      },
      delete: async (url, config) => {
        calls.push({ method: "DELETE", url, config });
        return { data: { data: { removed: true } } };
      },
    },
  },
});

const { orgRoleService } = await import("@/services/org-role.service");

const BASE = "/api/v1/events/evt-1/org-roles";

function lastCall() {
  return calls[calls.length - 1];
}

// ---------------------------------------------------------------------------
// 一、列表：單一路徑、不帶查詢字串
// ---------------------------------------------------------------------------

test("list 打 GET /org-roles，且不帶任何查詢參數", async () => {
  calls.length = 0;

  const result = await orgRoleService.list("evt-1");

  assert.equal(calls.length, 1);
  assert.deepEqual(lastCall(), {
    method: "GET",
    url: BASE,
    config: undefined,
  });
  // 這一條端點沒有分頁（後端 `findMany` 沒有 skip／take）。若有人「順手補齊」
  // 分頁，App 就多了一個 Web 沒有的行為。
  assert.equal(lastCall().url.includes("?"), false);
  assert.deepEqual(result.orgRoles, [ORG_ROLE]);
});

test("list 會把 eventId 做 URL 編碼", async () => {
  calls.length = 0;

  await orgRoleService.list("evt/1 with space");

  assert.equal(
    lastCall().url,
    "/api/v1/events/evt%2F1%20with%20space/org-roles",
  );
});

// ---------------------------------------------------------------------------
// 二、邀請：POST，且只送 email 與 role
// ---------------------------------------------------------------------------

test("invite 打 POST /org-roles/invite，payload 恰好是 email 與 role", async () => {
  calls.length = 0;

  await orgRoleService.invite("evt-1", {
    email: "new@example.com",
    role: "OPERATOR",
  });

  assert.equal(calls.length, 1);
  assert.equal(lastCall().method, "POST");
  assert.equal(lastCall().url, `${BASE}/invite`);
  // 恰好兩個鍵：多一個就是 App 多了 Web 沒有的行為。
  assert.deepEqual(Object.keys(lastCall().payload).sort(), ["email", "role"]);
  assert.deepEqual(lastCall().payload, {
    email: "new@example.com",
    role: "OPERATOR",
  });
});

test("invite 原樣透傳 email，不自行 trim／轉小寫（後端才是正規化點）", async () => {
  calls.length = 0;

  await orgRoleService.invite("evt-1", {
    email: "  Mixed.Case@Example.COM  ",
    role: "COORDINATOR",
  });

  assert.equal(lastCall().payload.email, "  Mixed.Case@Example.COM  ");
});

test("invite 回傳的是後端實名 orgRoleId，不是 Web 型別裡的 invitationId", async () => {
  const result = await orgRoleService.invite("evt-1", {
    email: "new@example.com",
    role: "OPERATOR",
  });

  assert.equal(result.orgRoleId, "role-2");
  // Web 的 `invitationId` 在後端回應裡不存在。若有人「為了相容 Web 型別」把它
  // 補進來，這一行會紅——那個鍵永遠是 undefined，補它只是把錯誤藏起來。
  assert.equal(
    Object.hasOwn(result, "invitationId"),
    false,
    "回應出現了 invitationId：後端只回 orgRoleId",
  );
});

// ---------------------------------------------------------------------------
// 三、接受：POST，不是 Web 的 PATCH
// ---------------------------------------------------------------------------

test("accept 打 POST /org-roles/accept（後端只在那條路徑上掛 POST）", async () => {
  calls.length = 0;

  await orgRoleService.accept("evt-1", "tok-abc");

  assert.equal(calls.length, 1);
  assert.equal(
    lastCall().method,
    "POST",
    "accept 必須是 POST：後端 engagement.routes.ts:45 只掛了 router.post，PATCH 會 404",
  );
  assert.equal(lastCall().url, `${BASE}/accept`);
  assert.deepEqual(lastCall().payload, { token: "tok-abc" });
});

test("accept 不會用 PATCH 打出去（Web 的死碼 method 不得回流）", async () => {
  calls.length = 0;

  await orgRoleService.accept("evt-1", "tok-abc");

  assert.equal(
    calls.some((call) => call.method === "PATCH"),
    false,
    "accept 用了 PATCH——那是 LinkCard_Frontend/lib/events/engagement.ts:157 的錯誤寫法",
  );
});

// ---------------------------------------------------------------------------
// 四、移除：DELETE，路徑帶的是 orgRoleId
// ---------------------------------------------------------------------------

test("remove 打 DELETE /org-roles/:orgRoleId", async () => {
  calls.length = 0;

  await orgRoleService.remove("evt-1", "role-1");

  assert.equal(calls.length, 1);
  assert.equal(lastCall().method, "DELETE");
  assert.equal(lastCall().url, `${BASE}/role-1`);
});

test("remove 會把 orgRoleId 做 URL 編碼", async () => {
  calls.length = 0;

  await orgRoleService.remove("evt-1", "role/1");

  assert.equal(lastCall().url, `${BASE}/role%2F1`);
});

test("remove 不送 body（後端只讀路徑參數）", async () => {
  calls.length = 0;

  await orgRoleService.remove("evt-1", "role-1");

  assert.equal(
    Object.hasOwn(lastCall(), "payload"),
    false,
    "remove 送了 body：後端 removeEventOrgRole 只讀 req.params",
  );
});

// ---------------------------------------------------------------------------
// 五、整體：四支呼叫、四種 method，沒有多出來的第五支
// ---------------------------------------------------------------------------

test("四支呼叫的方法集合恰好是 GET / POST / POST / DELETE", async () => {
  calls.length = 0;

  await orgRoleService.list("evt-1");
  await orgRoleService.invite("evt-1", { email: "a@b.c", role: "OPERATOR" });
  await orgRoleService.accept("evt-1", "tok");
  await orgRoleService.remove("evt-1", "role-1");

  assert.deepEqual(
    calls.map((call) => call.method),
    ["GET", "POST", "POST", "DELETE"],
  );
});
