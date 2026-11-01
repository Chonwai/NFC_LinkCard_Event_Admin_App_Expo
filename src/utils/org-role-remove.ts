/**
 * 移除管理員的**可否、意圖、確認**（純函式，可被 `node:test` 釘住）— parity
 * `org-roles`。
 *
 * ## 先回答一個問題：後端有沒有保護「最後一個 OWNER」或「移除自己」？
 *
 * **沒有。** 這是實測結果，不是推測：
 *
 * `EventOrgRoleService.removeOrgRole`（`EventOrgRoleService.ts:122-135`）整支
 * 只做三件事——確認這一列屬於這場活動、找不到就拋 `ORG_ROLE_NOT_FOUND`、
 * 把 `status` 設成 `REVOKED` 並填 `revokedAt`。**沒有任何數量檢查、沒有任何
 * 「是不是自己」的檢查**。全 `src/events/` 也搜不到 `last OWNER` / `cannot remove`
 * / `SELF_REMOVAL` / `LAST_ADMIN` 之類的字串。
 *
 * 所以「不要提供註定失敗的按鈕」這一條在這裡**不成立**：只要按鈕畫得出來，
 * 後端就會成功。畫面的工作不是「避免失敗」，而是「避免給出不該給的按鈕」。
 *
 * ## 那「移除自己」到底可不可能？
 *
 * 結構上不可能，但理由不在後端，在**誰會看到按鈕**：
 *
 * | 呼叫者的身份 | 在清單裡嗎 | 看得到移除鈕嗎 |
 * | --- | --- | --- |
 * | `OWNER` | **不在**。擁有者是 `Event.ownerId`，不是 `EventOrgRole` 的一列 | — |
 * | `SUPER_ADMIN` | 在 | **不在**（`canRemoveOrgRole` 對 SUPER_ADMIN 回 false） |
 * | `COORDINATOR` / `OPERATOR` / 其他 | 在 | **不在**（`gateDisabled`，他們本來就不能管管理員） |
 *
 * 也就是說：唯一能移除別人的人（owner / SUPER_ADMIN）看不到任何一顆會移除到
 * 自己的按鈕。這不是巧合，是 Web 那兩個條件（`role !== 'SUPER_ADMIN'` 與
 * `!gateDisabled`）合起來的結果——Web 自己也沒有為此寫過任何「不能移除自己」
 * 的程式碼（`org-roles/page.tsx:295-307`）。
 *
 * ## 為什麼照抄 Web 的「SUPER_ADMIN 不給移除」
 *
 * 後端允許移除 SUPER_ADMIN，Web 的 UI 不提供。**App 也不提供**——多提供一顆
 * 就是 App 做得到 Web 做不到的事，而這一顆給出的是「誰能撤銷最高權限管理員」，
 * 是最不該由行動端自行擴權的一顆。
 *
 * ⚠️ 這留下一個**營運缺口**（已在交付說明列出，不是本次要修的）：一個
 * `SUPER_ADMIN` 的 org role 在 Web 與 App 都無法移除，只能由資料庫或後端處理。
 * 這是 Web 既有行為，不是 App 漏做。
 */
import type { EventOrgRole, EventOrgRoleType } from "@/types/orgRole.types";
import {
  formatOrgRoleEmail,
  formatOrgRolePerson,
  orgRoleLabel,
} from "@/utils/org-role-display";

/**
 * 這一列要不要顯示「移除」鈕。
 *
 * 兩個條件，逐字照 Web 的 `{r.role !== 'SUPER_ADMIN' && !gateDisabled && (...)}`
 * （`org-roles/page.tsx:295`）：
 *
 * 1. `gateDisabled`：呼叫者沒有 `canInviteAdmins`（不是 owner / SUPER_ADMIN）。
 *    後端會回 403，所以不畫。
 * 2. `role.role !== 'SUPER_ADMIN'`：SUPER_ADMIN 的列不給移除。理由見檔頭。
 *
 * 回傳 `false` 時畫面**不畫按鈕**（而不是畫一顆 disabled 的）。disabled 的按鈕
 * 在現場會被讀成「壞掉了」，而且它仍然佔一顆觸控目標的空間。
 */
export function canRemoveOrgRole(
  role: EventOrgRole,
  options: { gateDisabled: boolean },
): boolean {
  if (options.gateDisabled) return false;
  return role.role !== "SUPER_ADMIN";
}

/**
 * 移除的二次確認內容。
 *
 * **三個欄位都不是裝飾**：`person` 決定「移除誰」、`email` 是唯一的穩定識別
 * （同名的人可能很多，email 不會）、`role` 說明「拿掉的是多大的權限」。
 * 誤按的成本不是少一筆資料，是「一個本來該有權限的人突然進不了後台」。
 *
 * 與 Web 的差異：Web 的 `confirm` 只有一行「確定移除此管理員？」
 * （`orgRoles.removeConfirm`），**沒有說要移除誰**。那一句話在清單很長時等於
 * 沒有確認作用——按下去才知道按到哪一列。
 */
export interface OrgRoleRemoveConfirmation {
  person: string;
  email: string;
  role: string;
}

export function buildOrgRoleRemoveConfirmation(
  role: EventOrgRole,
  labels: Partial<Record<EventOrgRoleType, string>>,
): OrgRoleRemoveConfirmation {
  return {
    person: formatOrgRolePerson(role),
    email: formatOrgRoleEmail(role),
    role: orgRoleLabel(role.role, labels),
  };
}

/**
 * 移除的請求 payload。**唯一的產生點**。
 *
 * 兩道閘門，缺一不可：
 *
 * 1. `confirmed !== true` ⇒ `null`。確認框不是裝飾。
 * 2. 這一列本來就不該被移除（`canRemoveOrgRole` 為 false）⇒ `null`。
 *
 * 第二道是**縱深防禦**：按鈕不畫出來，所以正常情況下意圖根本不會建立；但如果
 * 有人日後改了畫面的條件（或把意圖存在別的地方），這裡仍然不會產生一個「移除
 * SUPER_ADMIN」的請求。規則住在這裡就能被測試釘住，住在畫面裡只會被讀過去。
 *
 * 路徑參數是 **`EventOrgRole.id`**（不是 user id）——後端
 * `removeOrgRole(eventId, orgRoleId)` 以它為鍵。傳 user id 會得到
 * `404 ORG_ROLE_NOT_FOUND`。
 */
export function buildOrgRoleRemoveRequest(
  role: EventOrgRole,
  options: { confirmed: boolean; gateDisabled: boolean },
): { orgRoleId: string } | null {
  if (options.confirmed !== true) return null;
  if (!canRemoveOrgRole(role, { gateDisabled: options.gateDisabled }))
    return null;

  return { orgRoleId: role.id };
}
