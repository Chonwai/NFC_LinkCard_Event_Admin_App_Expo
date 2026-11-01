/**
 * 組織角色（`EventOrgRole`）型別 — parity `org-roles`。
 *
 * 前端 counterpart：
 * - `LinkCard_Frontend/app/(event)/manage/[eventId]/org-roles/page.tsx`
 * - `LinkCard_Frontend/lib/events/engagement.ts:139`（`listEventOrgRoles`）
 *   / `:143`（`inviteEventAdmin`）/ `:153`（`acceptEventAdminInvite`）
 *   / `:168`（`removeEventAdmin`）
 * - 後端 `LinkCard_ExpressJS_Backend/prisma/schema.prisma:1256-1279`
 *   （`EventOrgRole`）、`:1217-1223`（`EventOrgRoleType`）、`:222-225`
 *   （`OrgRoleStatus`）
 *
 * **逐字照後端建模，不多也不少**：多一個欄位就會有人「順手」把它顯示出來，
 * 少一個欄位就讀不到後端已經回的資料。
 *
 * ## `OrgRoleStatus` 只有兩個值，**沒有 `PENDING`**
 *
 * 這是本檔最重要的一條。schema 裡 `OrgRoleStatus` 就是 `ACTIVE` / `REVOKED`
 * 兩個（`schema.prisma:222-225`），而 `listOrgRoles` 又已經把 `REVOKED` 濾掉
 * （`EventOrgRoleService.ts:22-26`）——所以**清單上的每一列 `status` 都是
 * `ACTIVE`**。
 *
 * 「已邀請、還沒接受」這個狀態不在 `status` 裡，它在
 * `acceptedAt`：`inviteOrgRole` 寫入時是
 * `acceptedAt: existingUser ? new Date() : null`（`EventOrgRoleService.ts:75`），
 * 也就是「這個 email 已經有帳號」就當場生效、沒有帳號就停在 `null`。
 * 因此待接受的判準是 **`acceptedAt == null`**，不是任何 enum 值。
 * 推導邏輯在 `src/utils/org-role-display.ts`，由
 * `tests/org-role-display.test.mjs` 釘住。
 *
 * 硬要建模一個 `PENDING` 會讓畫面寫出「後端不存在」的判定，而那個判定永遠
 * 不會成立——比不顯示更糟。
 *
 * ## `user` 可以是真的 `null`
 *
 * `EventOrgRole.userId` 是 `String?`（`schema.prisma:1260`），`user` 也是
 * optional 關聯。邀請一個**還沒有帳號**的 email 時，`userId` 就是 `null`，
 * `include.user` 也就回 `null`。
 *
 * ⚠️ Web 這一頁沒有處理這件事：它直接讀 `r.user.display_name ?? r.user.email`
 * （`org-roles/page.tsx:281-284`），`user` 為 `null` 時會拋 TypeError，整頁白掉。
 * App 把 `user` 建成 `OrgRoleUser | null`，畫面一律經
 * `formatOrgRolePerson()` 取值（見 `src/utils/org-role-display.ts`）。
 *
 * ## 刻意沒有建模的欄位（不是漏抄）
 *
 * - `token`：後端 `listOrgRoles` 沒有用 `select` 收斂，所以整列（含 `token`）
 *   都會回。那是**一次性憑證**，而 `POST …/org-roles/accept` 在整個系統裡
 *   **沒有任何送達管道**（後端不寄信、Web 也沒有 UI，見
 *   `src/services/org-role.service.ts` 檔頭）。建模它就等於給下一個人一個
 *   「可以把它印到 log／畫面」的邀請。不建。
 * - `expiresAt` / `invitedBy` / `invitedAt` / `revokedAt` / `updatedAt`：
 *   Web 一個都沒顯示，畫面也沒有用途。`revokedAt` 尤其無意義——`REVOKED` 的列
 *   根本不會出現在清單裡。
 * - `InviteOrgRoleResult` 同樣不含 `inviteToken`：理由同上，沒有任何消費者。
 */

/**
 * 後端 `EventOrgRoleType`（`schema.prisma:1217-1223`）。
 *
 * **五個值**，不是三個。Web 的邀請下拉只提供 `COORDINATOR` / `OPERATOR`
 * 兩個選項（`org-roles/page.tsx:235-238`），但清單**可能**含其他三個
 * （`SUPER_ADMIN` 由後端或既有資料建立、`VOLUNTEER` / `MEDIA` 由其他入口建立）。
 * 所以這個 union 要完整——顯示時才不會因為遇到不認得的值而空白。
 */
export type EventOrgRoleType =
  "SUPER_ADMIN" | "COORDINATOR" | "OPERATOR" | "VOLUNTEER" | "MEDIA";

/**
 * 後端 `OrgRoleStatus`（`schema.prisma:222-225`）。
 *
 * 清單永遠是 `ACTIVE`（`REVOKED` 已被 `listOrgRoles` 濾掉），但型別照實建模，
 * 不假裝只有一個值——後端哪天改了 `where` 條件，這裡不需要跟著改。
 */
export type OrgRoleStatus = "ACTIVE" | "REVOKED";

/**
 * 呼叫者在這場活動的角色（後端 `EventService.getEventRole:400-403`）。
 *
 * 回傳值域是 `'OWNER' | EventOrgRoleType | null`——`OWNER` **不是** org role，
 * 它是 `Event.ownerId` 的推導結果。這個區別很重要：擁有者根本不在
 * `EventOrgRole` 清單裡，所以「移除擁有者」在資料上不可能發生。
 */
export type MyEventRole = "OWNER" | EventOrgRoleType;

/** 後端 `include.user.select` 的四個欄位（`EventOrgRoleService.ts:27-36`）。 */
export interface OrgRoleUser {
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
}

/** 一筆組織角色（＝「誰能管理這場活動」）。 */
export interface EventOrgRole {
  id: string;
  eventId: string;
  /**
   * 已註冊使用者的 id；邀請尚未註冊的 email 時是 `null`。
   *
   * 與 `user` 同步為空——但兩個都留著，因為「有沒有帳號」是畫面要講的事
   * （見 `orgRoleState()`），而 `id` 是後端回應裡確實存在的欄位。
   */
  userId: string | null;
  /** 已註冊使用者；`null` 代表這個 email 還沒有帳號。**畫面必須處理 `null`。** */
  user: OrgRoleUser | null;
  /** 被邀請的 email（後端一律存小寫 trim 過的值，`EventOrgRoleService.ts:47`）。 */
  email: string;
  role: EventOrgRoleType;
  status: OrgRoleStatus;
  /** `null` ＝已邀請但對方還沒接受（或根本沒有帳號可接受）。見檔頭。 */
  acceptedAt: string | null;
  createdAt: string;
}

/**
 * 邀請的請求內容（後端 `InviteOrgRoleDto`）。
 *
 * `email` 由後端再 trim／轉小寫一次，所以 App 送原樣即可，不自行正規化——
 * 兩邊各做一次只會讓「送出去的是什麼」變得難追。
 */
export interface InviteOrgRolePayload {
  email: string;
  role: EventOrgRoleType;
}

/**
 * 邀請的回應（`EventOrgRoleService.inviteOrgRole` 的回傳物件，`:84-90`）。
 *
 * ⚠️ 後端回的鍵是 **`orgRoleId`**，不是 `invitationId`。Web 的型別寫成
 * `{ invitationId, email, role }`（`lib/events/engagement.ts:143-152`）——那個
 * `invitationId` 在回應裡根本不存在，取用時永遠是 `undefined`。這裡照後端實名
 * 建模，並由 `tests/org-role-service.test.mjs` 釘住「不是 invitationId」。
 */
export interface InviteOrgRoleResult {
  orgRoleId: string;
  email: string;
  role: EventOrgRoleType;
  status: OrgRoleStatus;
}
