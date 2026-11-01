/**
 * `utils/org-role-display.ts` 的測試 — 把「後端事實」釘在畫面上。
 *
 * ## 為什麼這一支值得存在
 *
 * 這裡每一條規則都對應一個後端事實，而 Web 有三條寫錯或漏寫。沒有這一支，
 * 「App 不會炸」只是一個宣稱；有了它，Web 的那個 bug 一旦被照抄進來就會紅。
 *
 * 1. **狀態要由 `acceptedAt` 推導，不是讀 `status`**。清單上的 `status` 永遠是
 *    `ACTIVE`（`REVOKED` 已被 `listOrgRoles` 濾掉），用它判斷會讓「沒有人接受
 *    過的邀請」也顯示成已生效。
 * 2. **`user` 可以是真的 `null`**。Web 直接讀 `r.user.display_name`，遇到
 *    「邀請一個還沒註冊的 email」就拋 TypeError 整頁白掉。
 * 3. **角色有五個值，Web 的中文表只有三個**。遇到 `VOLUNTEER` / `MEDIA` 時
 *    Web 渲染空白徽章；這裡退回原字串。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  classifyOrgRoleError,
  formatOrgRoleEmail,
  formatOrgRolePerson,
  orgRoleLabel,
  orgRoleState,
} = await import("@/utils/org-role-display");

/** 一筆「已生效」的角色（email 有帳號，`inviteOrgRole` 當場寫入 `acceptedAt`）。 */
function activeRole(overrides = {}) {
  return {
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
    ...overrides,
  };
}

/** 一筆「待接受」的角色（email 沒有帳號 ⇒ `userId` / `user` / `acceptedAt` 全空）。 */
function pendingRole(overrides = {}) {
  return activeRole({
    userId: null,
    user: null,
    email: "new@example.com",
    acceptedAt: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 一、狀態由 acceptedAt 推導
// ---------------------------------------------------------------------------

test("acceptedAt 有值 ⇒ 已生效", () => {
  assert.equal(orgRoleState(activeRole()), "active");
});

test("acceptedAt 為 null ⇒ 待接受", () => {
  assert.equal(orgRoleState(pendingRole()), "pending");
});

test("status 是 ACTIVE 但 acceptedAt 為 null ⇒ 仍然是待接受（不是讀 status）", () => {
  // 這一條是整支測試的核心：清單上的 status 永遠是 ACTIVE，用它判斷會讓
  // 「沒有人接受過的邀請」顯示成已生效。若有人把實作改成讀 status，這裡會紅。
  const role = pendingRole({ status: "ACTIVE" });

  assert.equal(
    orgRoleState(role),
    "pending",
    "狀態判斷讀了 status：清單上的 status 永遠是 ACTIVE，待接受的列會被誤標",
  );
});

// ---------------------------------------------------------------------------
// 二、user 為 null 時不得炸（Web 的 bug）
// ---------------------------------------------------------------------------

test("user 為 null 時人名退回被邀請的 email，不拋錯", () => {
  // Web：`r.user.display_name ?? r.user.email`（org-roles/page.tsx:281-284）
  // → TypeError: Cannot read properties of null。
  assert.doesNotThrow(() => formatOrgRolePerson(pendingRole()));
  assert.equal(formatOrgRolePerson(pendingRole()), "new@example.com");
});

test("有 display_name 時用它", () => {
  assert.equal(formatOrgRolePerson(activeRole()), "運營小幫手");
});

test("display_name 是空字串或只有空白時退回 email", () => {
  assert.equal(
    formatOrgRolePerson(
      activeRole({ user: { id: "u", email: "a@b.c", display_name: "" } }),
    ),
    "a@b.c",
  );
  assert.equal(
    formatOrgRolePerson(
      activeRole({ user: { id: "u", email: "a@b.c", display_name: "   " } }),
    ),
    "a@b.c",
  );
});

test("display_name 為 null 時退回 email", () => {
  assert.equal(
    formatOrgRolePerson(
      activeRole({ user: { id: "u", email: "a@b.c", display_name: null } }),
    ),
    "a@b.c",
  );
});

test("user 為 null 時 email 一行仍然有值（退回 role.email）", () => {
  assert.equal(formatOrgRoleEmail(pendingRole()), "new@example.com");
});

test("有帳號時 email 一行用帳號的 email", () => {
  assert.equal(formatOrgRoleEmail(activeRole()), "ops@example.com");
});

// ---------------------------------------------------------------------------
// 三、角色名稱：五個值都要有中文，認不得的退回原字串
// ---------------------------------------------------------------------------

/** 與 `copy.orgRoles.roleLabels` 同形狀（這裡刻意只放三個，模擬 Web 的表）。 */
const WEB_PARTIAL_LABELS = {
  SUPER_ADMIN: "Super Admin",
  COORDINATOR: "Coordinator",
  OPERATOR: "Operator",
};

test("認得的角色回中文", () => {
  assert.equal(orgRoleLabel("COORDINATOR", WEB_PARTIAL_LABELS), "Coordinator");
});

test("表裡沒有的角色退回原字串，不是 undefined", () => {
  // Web 的 roleLabels 只有三個（org-roles/page.tsx:274-278），遇到 VOLUNTEER /
  // MEDIA 會渲染一個空白徽章。退回原字串至少看得出「有角色、只是沒有中文名」。
  assert.equal(orgRoleLabel("VOLUNTEER", WEB_PARTIAL_LABELS), "VOLUNTEER");
  assert.equal(orgRoleLabel("MEDIA", WEB_PARTIAL_LABELS), "MEDIA");
  assert.equal(
    orgRoleLabel("SOMETHING_NEW", WEB_PARTIAL_LABELS),
    "SOMETHING_NEW",
  );
});

test("六個值都有中文時全部命中", () => {
  const labels = {
    OWNER: "擁有者",
    SUPER_ADMIN: "Super Admin",
    COORDINATOR: "Coordinator",
    OPERATOR: "Operator",
    VOLUNTEER: "Volunteer",
    MEDIA: "Media",
  };

  for (const [key, value] of Object.entries(labels)) {
    assert.equal(orgRoleLabel(key, labels), value);
  }
});

// ---------------------------------------------------------------------------
// 四、錯誤分類
// ---------------------------------------------------------------------------

/** 造一個 axios 形狀的錯誤。 */
function apiError(status, code) {
  return {
    response: { status, data: { error: { code, message: "後端原文" } } },
  };
}

test("ORG_ROLE_ALREADY_EXISTS ⇒ alreadyExists", () => {
  assert.equal(
    classifyOrgRoleError(apiError(409, "ORG_ROLE_ALREADY_EXISTS")).kind,
    "alreadyExists",
  );
});

test("ORG_ROLE_NOT_FOUND ⇒ notFound", () => {
  assert.equal(
    classifyOrgRoleError(apiError(404, "ORG_ROLE_NOT_FOUND")).kind,
    "notFound",
  );
});

test("EVENT_NOT_FOUND ⇒ notFound", () => {
  assert.equal(
    classifyOrgRoleError(apiError(404, "EVENT_NOT_FOUND")).kind,
    "notFound",
  );
});

test("INSUFFICIENT_PERMISSION ⇒ forbidden", () => {
  assert.equal(
    classifyOrgRoleError(apiError(403, "INSUFFICIENT_PERMISSION")).kind,
    "forbidden",
  );
});

test("VALIDATION_ERROR ⇒ validation", () => {
  assert.equal(
    classifyOrgRoleError(apiError(400, "VALIDATION_ERROR")).kind,
    "validation",
  );
});

test("沒有 code 時退回看 HTTP 狀態", () => {
  assert.equal(
    classifyOrgRoleError(apiError(403, undefined)).kind,
    "forbidden",
  );
  assert.equal(classifyOrgRoleError(apiError(404, undefined)).kind, "notFound");
  assert.equal(
    classifyOrgRoleError(apiError(400, undefined)).kind,
    "validation",
  );
  assert.equal(
    classifyOrgRoleError(apiError(409, undefined)).kind,
    "alreadyExists",
  );
});

test("認不得的錯誤 ⇒ failed（可重試），不是 forbidden（不可重試）", () => {
  assert.equal(classifyOrgRoleError(apiError(500, "INTERNAL")).kind, "failed");
  assert.equal(classifyOrgRoleError(new Error("network")).kind, "failed");
  assert.equal(classifyOrgRoleError(null).kind, "failed");
});

test("分類不回傳後端原文（避免內部訊息外洩）", () => {
  const outcome = classifyOrgRoleError(
    apiError(403, "INSUFFICIENT_PERMISSION"),
  );

  assert.deepEqual(Object.keys(outcome), ["kind"]);
});
