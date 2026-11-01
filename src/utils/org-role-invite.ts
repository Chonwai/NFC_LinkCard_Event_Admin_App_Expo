/**
 * 邀請管理員的**意圖 → 請求**轉換（純函式，可被 `node:test` 釘住）— parity
 * `org-roles`。
 *
 * ## 為什麼要這一支
 *
 * 「按下按鈕」與「送出請求」在這一頁**必須是兩件事**。邀請一個人等於把後台交給
 * 他，而這個動作在 App 裡沒有任何介面可以撤銷以外的方式挽回（移除雖然存在，但
 * 那是事後補救）。所以流程刻意拆成：
 *
 * ```
 * 按下「邀請」→ 建立意圖（不送任何請求）
 *            → 確認框顯示「對誰、什麼角色」
 *            → 確認 → buildInviteRequest(..., { confirmed: true }) → 才送出
 * ```
 *
 * 那個 `confirmed` 參數不是裝飾：`buildInviteRequest` 在 `confirmed === false`
 * 時回 `null`，所以「有意圖但還沒確認」這個狀態**不可能**產生請求。把規則放在
 * 這裡（而不是畫面裡 `if (confirmed)`）是為了讓它可以被測試釘住——畫面上的
 * `if` 只會被讀過去，這裡的 `null` 會讓測試紅。
 *
 * ## 為什麼不自己驗 email 格式
 *
 * Web 的輸入框是 `<input type="email" required>`（`org-roles/page.tsx:212-219`），
 * 它在送出前只保證兩件事：**非空**、以及「有一個 `@` 而且前後都有東西」。
 * 後端才是真正的驗證點（`InviteOrgRoleDto` 的 `@IsEmail()`，
 * `EventEngagementController.ts:31-38`）。
 *
 * App 因此只驗**非空**。多驗一條「網域要有點」會讓 App 拒絕一個後端其實會接受
 * 的地址（`a@b` 在 HTML5 是合法的），那就是「App 比 Web 嚴格」——也是一種不對齊。
 * 真的不合法時後端回 `VALIDATION_ERROR`，畫面走 `errors.validation`。
 */
import type {
  EventOrgRoleType,
  InviteOrgRolePayload,
} from "@/types/orgRole.types";
import { orgRoleLabel } from "@/utils/org-role-display";

/**
 * 一次邀請的**意圖**。建立後只存在於畫面 state，沒有任何網路副作用。
 */
export interface OrgRoleInviteIntent {
  email: string;
  role: EventOrgRoleType;
}

/** 送出前被擋下來的原因。`null` ＝可以送。 */
export type OrgRoleInviteBlock = "emptyEmail";

/**
 * 送出前的本地檢查。
 *
 * 只有一條：email 不能是空白。理由見檔頭——多驗格式就會比 Web 嚴格。
 *
 * 注意這裡用的是 `trim()` 後的空字串判斷：`"   "` 與 `""` 一樣都算沒填。
 * HTML5 的 `required` 對全空白字串的判定其實是「有值」（它不 trim），但那種
 * 輸入送到後端一定會被 `@IsEmail()` 擋下，本地先擋只是少跑一趟。
 */
export function validateOrgRoleInvite(
  intent: OrgRoleInviteIntent,
): OrgRoleInviteBlock | null {
  if (intent.email.trim() === "") return "emptyEmail";
  return null;
}

/**
 * 確認框要顯示的內容。
 *
 * 兩個欄位都不是裝飾：**email 決定「對誰」、角色決定「給到多大」**。誤邀的
 * 代價是把後台交給錯的人，而唯一能在按下確認前發現「貼錯 email」或「選錯角色」
 * 的資訊就是這兩行。
 *
 * email 顯示的是 `trim()` 後的值——後端也會 trim 並轉小寫
 * （`EventOrgRoleService.ts:47`），所以那才是真正會被寫進資料庫的字串。
 */
export interface OrgRoleInviteConfirmation {
  email: string;
  role: string;
}

export function buildOrgRoleInviteConfirmation(
  intent: OrgRoleInviteIntent,
  labels: Partial<Record<EventOrgRoleType, string>>,
): OrgRoleInviteConfirmation {
  return {
    email: intent.email.trim(),
    role: orgRoleLabel(intent.role, labels),
  };
}

/**
 * 意圖 → 請求 payload。**唯一的產生點**。
 *
 * 三種情況回 `null`：
 *
 * 1. `confirmed !== true`：還沒確認，什麼都不送。
 * 2. email 空白（`validateOrgRoleInvite` 不通過）。
 * 3. 空字串被擋在上一條，這裡不再重複判斷。
 *
 * payload **恰好兩個鍵**（`email`、`role`）：後端 `InviteOrgRoleDto` 只有這兩個
 * 欄位，多送一個就是 App 多了一個 Web 沒有的行為。
 *
 * email 送的是**原樣**（不 trim、不轉小寫）：Web 也是原樣送
 * （`org-roles/page.tsx:108`），正規化是後端的事。兩邊各做一次只會讓「送出去的
 * 是什麼」變得難追。
 */
export function buildOrgRoleInviteRequest(
  intent: OrgRoleInviteIntent,
  options: { confirmed: boolean },
): InviteOrgRolePayload | null {
  if (options.confirmed !== true) return null;
  if (validateOrgRoleInvite(intent) != null) return null;

  return { email: intent.email, role: intent.role };
}
