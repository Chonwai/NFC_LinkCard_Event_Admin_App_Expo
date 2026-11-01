/**
 * 邀請管理員的**確認閘門**與**payload 形狀** — `utils/org-role-invite.ts`。
 *
 * ## 為什麼要另一支測試
 *
 * `tests/org-role-service.test.mjs` 測的是「service 有沒有把 payload 原樣送出去」；
 * 這一支測的是**在送出之前**發生的事：
 *
 * 1. **沒有確認就不可能有請求**。邀請一個人等於把後台交給他，而 Web 是
 *    「按下就送、沒有任何確認框」。App 把意圖與請求分開，`buildOrgRoleInviteRequest`
 *    在 `confirmed !== true` 時回 `null`。這一條若失守，畫面上的確認框就只是
 *    裝飾——按鈕會直接生效。
 * 2. **payload 恰好兩個鍵**。多一個鍵就是 App 多了 Web 沒有的行為。
 * 3. **只驗非空，不驗格式**。多驗一條「網域要有點」會讓 App 拒絕一個後端其實
 *    會接受的地址（`a@b` 在 HTML5 是合法的），那就是 App 比 Web 嚴格。
 * 4. **確認框要看得見「對誰、什麼角色」**。少了任何一行，誤邀就沒有攔截點。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildOrgRoleInviteConfirmation,
  buildOrgRoleInviteRequest,
  validateOrgRoleInvite,
} = await import("@/utils/org-role-invite");

const LABELS = {
  SUPER_ADMIN: "Super Admin",
  COORDINATOR: "Coordinator",
  OPERATOR: "Operator",
};

// ---------------------------------------------------------------------------
// 一、本地檢查：只驗非空
// ---------------------------------------------------------------------------

test("空字串被擋下", () => {
  assert.equal(
    validateOrgRoleInvite({ email: "", role: "COORDINATOR" }),
    "emptyEmail",
  );
});

test("全空白也被擋下（與空字串同義）", () => {
  assert.equal(
    validateOrgRoleInvite({ email: "   ", role: "COORDINATOR" }),
    "emptyEmail",
  );
});

test("有內容就放行——即使格式不完美（後端才是驗證點）", () => {
  // `a@b` 沒有 TLD：HTML5 的 type=email 接受它，後端 @IsEmail() 會擋。
  // App 在這一層不擋，讓後端回 VALIDATION_ERROR 走 errors.validation。
  assert.equal(validateOrgRoleInvite({ email: "a@b", role: "OPERATOR" }), null);
  assert.equal(
    validateOrgRoleInvite({ email: "ops@example.com", role: "OPERATOR" }),
    null,
  );
});

// ---------------------------------------------------------------------------
// 二、確認閘門：沒有 confirmed 就沒有請求
// ---------------------------------------------------------------------------

test("confirmed 為 false ⇒ 回 null（確認框不是裝飾）", () => {
  assert.equal(
    buildOrgRoleInviteRequest(
      { email: "ops@example.com", role: "COORDINATOR" },
      { confirmed: false },
    ),
    null,
  );
});

test("缺少 confirmed 選項 ⇒ 回 null（不能靠省略參數繞過）", () => {
  assert.equal(
    buildOrgRoleInviteRequest(
      { email: "ops@example.com", role: "COORDINATOR" },
      {},
    ),
    null,
  );
});

test("confirmed 為 true 且 email 非空 ⇒ 產生 payload", () => {
  const payload = buildOrgRoleInviteRequest(
    { email: "ops@example.com", role: "COORDINATOR" },
    { confirmed: true },
  );

  assert.deepEqual(payload, {
    email: "ops@example.com",
    role: "COORDINATOR",
  });
});

test("confirmed 為 true 但 email 空白 ⇒ 仍然是 null", () => {
  assert.equal(
    buildOrgRoleInviteRequest(
      { email: "  ", role: "COORDINATOR" },
      { confirmed: true },
    ),
    null,
  );
});

// ---------------------------------------------------------------------------
// 三、payload 形狀：恰好兩個鍵，email 原樣透傳
// ---------------------------------------------------------------------------

test("payload 恰好 email 與 role 兩個鍵", () => {
  const payload = buildOrgRoleInviteRequest(
    { email: "ops@example.com", role: "OPERATOR" },
    { confirmed: true },
  );

  assert.deepEqual(Object.keys(payload).sort(), ["email", "role"]);
});

test("email 原樣送出，不 trim、不轉小寫（正規化是後端的事）", () => {
  const payload = buildOrgRoleInviteRequest(
    { email: "  Mixed.Case@Example.COM  ", role: "OPERATOR" },
    { confirmed: true },
  );

  // Web 也是原樣送（org-roles/page.tsx:108），後端 EventOrgRoleService.ts:47
  // 才 trim + toLowerCase。兩邊各做一次只會讓「送出去的是什麼」難追。
  assert.equal(payload.email, "  Mixed.Case@Example.COM  ");
});

// ---------------------------------------------------------------------------
// 四、確認框內容：對誰、什麼角色
// ---------------------------------------------------------------------------

test("確認框顯示 trim 後的 email 與角色中文名", () => {
  const confirmation = buildOrgRoleInviteConfirmation(
    { email: "  ops@example.com  ", role: "OPERATOR" },
    LABELS,
  );

  // 顯示 trim 後的值：後端也會 trim，那才是真正寫進資料庫的字串。
  assert.deepEqual(confirmation, {
    email: "ops@example.com",
    role: "Operator",
  });
});

test("確認框的兩行都有內容（誤邀的最後攔截點）", () => {
  const confirmation = buildOrgRoleInviteConfirmation(
    { email: "ops@example.com", role: "COORDINATOR" },
    LABELS,
  );

  assert.ok(confirmation.email.length > 0, "確認框沒有顯示 email");
  assert.ok(confirmation.role.length > 0, "確認框沒有顯示角色");
});

test("角色沒有中文名時退回原字串，不是 undefined", () => {
  const confirmation = buildOrgRoleInviteConfirmation(
    { email: "ops@example.com", role: "VOLUNTEER" },
    LABELS,
  );

  assert.equal(confirmation.role, "VOLUNTEER");
});
