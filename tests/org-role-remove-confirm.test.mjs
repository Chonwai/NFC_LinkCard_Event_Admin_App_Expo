/**
 * 移除管理員的**可否、確認閘門、payload 形狀** — `utils/org-role-remove.ts`。
 *
 * ## 這一支要釘住的三件事
 *
 * 1. **後端沒有任何移除保護**（`EventOrgRoleService.removeOrgRole:122-135`
 *    只做「這列屬於這場活動嗎 → 軟刪除」），所以「不要提供註定失敗的按鈕」這條
 *    在這裡不成立：畫得出來的按鈕都會成功。畫面的工作是**不要畫不該畫的**。
 * 2. **自我移除在結構上不可能**。擁有者不在清單裡（`Event.ownerId` 不是
 *    `EventOrgRole` 的一列）；SUPER_ADMIN 的列不給移除；其他人本來就
 *    `gateDisabled`。三者合起來，唯一能移除別人的人看不到會移除到自己的按鈕。
 * 3. **`confirmed !== true` 就不可能有請求**，而且**就算確認了，不該移除的列
 *    也不會產生請求**（縱深防禦：畫面條件日後漂掉，這裡仍然擋）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildOrgRoleRemoveConfirmation,
  buildOrgRoleRemoveRequest,
  canRemoveOrgRole,
} = await import("@/utils/org-role-remove");

const LABELS = {
  SUPER_ADMIN: "Super Admin",
  COORDINATOR: "Coordinator",
  OPERATOR: "Operator",
};

function orgRole(overrides = {}) {
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

// ---------------------------------------------------------------------------
// 一、哪些列有移除鈕
// ---------------------------------------------------------------------------

test("沒有權限管理管理員時，任何一列都沒有移除鈕", () => {
  for (const role of ["COORDINATOR", "OPERATOR", "VOLUNTEER", "MEDIA"]) {
    assert.equal(
      canRemoveOrgRole(orgRole({ role }), { gateDisabled: true }),
      false,
      `${role} 在 gateDisabled 時仍然可移除`,
    );
  }
});

test("SUPER_ADMIN 的列沒有移除鈕（逐字照 Web 的 role !== 'SUPER_ADMIN'）", () => {
  assert.equal(
    canRemoveOrgRole(orgRole({ role: "SUPER_ADMIN" }), { gateDisabled: false }),
    false,
  );
});

test("COORDINATOR / OPERATOR / VOLUNTEER / MEDIA 的列有移除鈕", () => {
  for (const role of ["COORDINATOR", "OPERATOR", "VOLUNTEER", "MEDIA"]) {
    assert.equal(
      canRemoveOrgRole(orgRole({ role }), { gateDisabled: false }),
      true,
      `${role} 應該可以移除`,
    );
  }
});

test("自我移除在結構上不可能：SUPER_ADMIN 自己的那一列永遠不可移除", () => {
  // 唯一能移除別人的人是 owner / SUPER_ADMIN。
  // - owner 不在清單裡（Event.ownerId 不是 EventOrgRole 的一列）⇒ 沒有自己的列可點。
  // - SUPER_ADMIN 自己的列是 SUPER_ADMIN ⇒ 依上一個測試永遠不可移除。
  // 所以「移除自己」在這個 UI 上無法發生，而後端並沒有為此寫任何檢查。
  const ownRow = orgRole({
    role: "SUPER_ADMIN",
    userId: "me",
    email: "me@example.com",
  });

  assert.equal(canRemoveOrgRole(ownRow, { gateDisabled: false }), false);
});

// ---------------------------------------------------------------------------
// 二、確認閘門 + 縱深防禦
// ---------------------------------------------------------------------------

test("confirmed 為 false ⇒ 回 null（確認框不是裝飾）", () => {
  assert.equal(
    buildOrgRoleRemoveRequest(orgRole(), {
      confirmed: false,
      gateDisabled: false,
    }),
    null,
  );
});

test("confirmed 為 true 且這一列可移除 ⇒ 產生請求", () => {
  assert.deepEqual(
    buildOrgRoleRemoveRequest(orgRole(), {
      confirmed: true,
      gateDisabled: false,
    }),
    { orgRoleId: "role-1" },
  );
});

test("confirmed 為 true 但這一列是 SUPER_ADMIN ⇒ 仍然是 null（縱深防禦）", () => {
  assert.equal(
    buildOrgRoleRemoveRequest(orgRole({ role: "SUPER_ADMIN" }), {
      confirmed: true,
      gateDisabled: false,
    }),
    null,
    "就算畫面條件漂掉，也不該產生一個移除 SUPER_ADMIN 的請求",
  );
});

test("confirmed 為 true 但呼叫者沒有權限 ⇒ 仍然是 null", () => {
  assert.equal(
    buildOrgRoleRemoveRequest(orgRole(), {
      confirmed: true,
      gateDisabled: true,
    }),
    null,
  );
});

// ---------------------------------------------------------------------------
// 三、payload 形狀：帶的是 EventOrgRole.id，不是 user id
// ---------------------------------------------------------------------------

test("請求只有一個鍵，而且是 EventOrgRole.id", () => {
  const request = buildOrgRoleRemoveRequest(orgRole(), {
    confirmed: true,
    gateDisabled: false,
  });

  assert.deepEqual(Object.keys(request), ["orgRoleId"]);
  // 後端 removeOrgRole(eventId, orgRoleId) 以 org-role id 為鍵；傳 user id 會
  // 得到 404 ORG_ROLE_NOT_FOUND。
  assert.equal(request.orgRoleId, "role-1");
  assert.notEqual(request.orgRoleId, "user-9");
});

// ---------------------------------------------------------------------------
// 四、確認框內容：要移除誰
// ---------------------------------------------------------------------------

test("確認框顯示人名、email 與角色", () => {
  const confirmation = buildOrgRoleRemoveConfirmation(orgRole(), LABELS);

  assert.deepEqual(confirmation, {
    person: "運營小幫手",
    email: "ops@example.com",
    role: "Coordinator",
  });
});

test("被移除的人還沒有帳號時（user 為 null）確認框仍然完整，不拋錯", () => {
  // 待接受的邀請也可以被移除，而那時 user 是 null。Web 的確認只有一句
  // 「確定移除此管理員？」，連要移除誰都沒說。
  const confirmation = buildOrgRoleRemoveConfirmation(
    orgRole({
      user: null,
      userId: null,
      email: "new@example.com",
      acceptedAt: null,
    }),
    LABELS,
  );

  assert.deepEqual(confirmation, {
    person: "new@example.com",
    email: "new@example.com",
    role: "Coordinator",
  });
});

test("確認框三行都不是空的（誤按的最後攔截點）", () => {
  const confirmation = buildOrgRoleRemoveConfirmation(orgRole(), LABELS);

  assert.ok(confirmation.person.length > 0, "確認框沒有顯示要移除誰");
  assert.ok(confirmation.email.length > 0, "確認框沒有顯示 email");
  assert.ok(confirmation.role.length > 0, "確認框沒有顯示角色");
});
