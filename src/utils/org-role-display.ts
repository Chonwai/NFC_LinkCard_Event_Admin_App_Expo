/**
 * 組織角色的**顯示與錯誤分類**（純函式，可被 `node:test` 釘住）— parity
 * `org-roles`。
 *
 * 為什麼要抽出來而不是寫在畫面裡：這裡每一條規則都對應一個後端事實，而那個
 * 事實**與 Web 的寫法不同**。放在畫面裡，它們只會被當成「畫面細節」；放在
 * 這裡加上測試，才有辦法說「Web 那條寫法會炸，App 這條不會」。
 */
import type { EventOrgRole, EventOrgRoleType } from "@/types/orgRole.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

/**
 * 一列在畫面上的兩種狀態。
 *
 * **不是** `OrgRoleStatus`。後端那個 enum 只有 `ACTIVE` / `REVOKED`
 * （`schema.prisma:222-225`），而 `REVOKED` 的列根本不會出現在清單裡
 * （`EventOrgRoleService.ts:22-26`）。真正要區分的是「已生效」與「已邀請但對方
 * 還沒接受」——後者不在任何 enum 裡，它在 `acceptedAt == null`。
 */
export type OrgRoleDisplayState = "active" | "pending";

/**
 * 這一列生效了嗎。
 *
 * 判準是 `acceptedAt == null`，理由見 `types/orgRole.types.ts` 檔頭：
 * `inviteOrgRole` 寫入時是 `acceptedAt: existingUser ? new Date() : null`
 * （`EventOrgRoleService.ts:75`）——email 已經有帳號就當場生效，沒有帳號就停在
 * `null`。
 *
 * ⚠️ 不要改成讀 `status`：清單上的 `status` **永遠是** `ACTIVE`（`REVOKED` 已
 * 被濾掉），用它判斷會讓每一列都顯示「已生效」，包含那些根本沒有人接受過的邀請。
 */
export function orgRoleState(role: EventOrgRole): OrgRoleDisplayState {
  return role.acceptedAt == null ? "pending" : "active";
}

/**
 * 這一列要顯示的**人名**。
 *
 * `role.user` 可以是真的 `null`——邀請一個還沒有帳號的 email 時，`userId` 與
 * `user` 都是 `null`（`schema.prisma:1260-1261`）。那種情況下唯一有的資訊就是
 * 被邀請的 `email`。
 *
 * ⚠️ Web 沒有處理這一件事：它直接讀 `r.user.display_name ?? r.user.email`
 * （`org-roles/page.tsx:281-284`），`user` 為 `null` 時整頁白掉。這裡回 email，
 * 畫面就不會炸。
 *
 * `display_name` 是空字串或只有空白時也退回 email——顯示一個空白的人名等於
 * 沒有顯示。
 */
export function formatOrgRolePerson(role: EventOrgRole): string {
  const user = role.user;
  if (user == null) return role.email;

  const name = user.display_name?.trim();
  if (name != null && name !== "") return name;

  const email = user.email?.trim();
  if (email != null && email !== "") return email;

  return role.email;
}

/**
 * 這一列要顯示的**次要一行**（email）。
 *
 * 一律回 email，不論有沒有對應帳號：有帳號用帳號的 email，沒有帳號用被邀請的
 * email（後端兩者同值，但 `user` 為 `null` 時只有後者存在）。
 */
export function formatOrgRoleEmail(role: EventOrgRole): string {
  const accountEmail = role.user?.email?.trim();
  if (accountEmail != null && accountEmail !== "") return accountEmail;
  return role.email;
}

/**
 * 角色名稱。
 *
 * `labels` 由畫面從 `copy.orgRoles.roleLabels` 傳進來（使用者可見字串集中在
 * `constants/copy.zh-TW.ts`）。**認不得的值就原樣顯示**——理由與
 * `bank-transfer-display.ts` 的狀態徽章相同：後端 `EventOrgRoleType` 有五個值
 * （`schema.prisma:1217-1223`），而 Web 的 `roleLabels` 只寫了三個
 * （`org-roles/page.tsx:274-278`）。遇到 `VOLUNTEER` / `MEDIA` 時 Web 會渲染
 * 一個**空白徽章**；這裡退回原字串，至少看得出來「有一個角色，只是 App 還沒有
 * 它的中文名」。
 *
 * 參數型別刻意寫 `string` 而不是 `EventOrgRoleType`：後端多一個值時，
 * 型別系統不會攔，執行期會拿到不認得的字串——那正是這支要處理的情形。
 */
export function orgRoleLabel(
  role: string,
  labels: Partial<Record<EventOrgRoleType, string>>,
): string {
  return labels[role as EventOrgRoleType] ?? role;
}

/**
 * 錯誤的分類結果。畫面只依這個 kind 選字串，**不回顯後端訊息**。
 */
export type OrgRoleErrorKind =
  "forbidden" | "alreadyExists" | "notFound" | "validation" | "failed";

export interface OrgRoleErrorOutcome {
  kind: OrgRoleErrorKind;
}

/**
 * 把後端錯誤收斂成五類。
 *
 * 對照的是後端 controller 實際會回的碼（`EventEngagementController`）：
 *
 * | 碼 | 來源 | kind |
 * | --- | --- | --- |
 * | `INSUFFICIENT_PERMISSION` | 三支的守門（403） | `forbidden` |
 * | `ORG_ROLE_ALREADY_EXISTS` | 邀請（409） | `alreadyExists` |
 * | `ORG_ROLE_NOT_FOUND` | 移除（404） | `notFound` |
 * | `EVENT_NOT_FOUND` | 活動不存在（404） | `notFound` |
 * | `VALIDATION_ERROR` | 邀請的 DTO 驗證（400） | `validation` |
 *
 * 為什麼要分類而不是直接顯示後端原文：`forbidden` 是**永久性**的（這個人就是
 * 沒有權限，重試一萬次也一樣），而 `failed` 是暫時性的。把兩者都講成「請稍後
 * 再試」，使用者會一直重試一件永遠不會成功的事——那正是 Web 這一頁極力避免的
 * 錯誤（它甚至為此把 toast 時間拉長到 6 秒）。
 */
export function classifyOrgRoleError(error: unknown): OrgRoleErrorOutcome {
  const code = getApiErrorCode(error);
  const status = getApiErrorStatus(error);

  if (code === "ORG_ROLE_ALREADY_EXISTS") return { kind: "alreadyExists" };
  if (code === "ORG_ROLE_NOT_FOUND") return { kind: "notFound" };
  if (code === "EVENT_NOT_FOUND") return { kind: "notFound" };
  if (code === "INSUFFICIENT_PERMISSION") return { kind: "forbidden" };
  if (code === "VALIDATION_ERROR") return { kind: "validation" };

  if (status === 403) return { kind: "forbidden" };
  if (status === 404) return { kind: "notFound" };
  if (status === 400) return { kind: "validation" };
  if (status === 409) return { kind: "alreadyExists" };

  return { kind: "failed" };
}
