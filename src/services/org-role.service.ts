import type { ApiResponse } from "@/types/api.types";
import type {
  EventOrgRole,
  InviteOrgRolePayload,
  InviteOrgRoleResult,
} from "@/types/orgRole.types";

import { apiClient } from "./api";

/**
 * 組織角色（`org-roles`）的四支呼叫 — parity `org-roles`。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/engagement.ts`
 * （`:139` 列表、`:143` 邀請、`:153` 接受、`:168` 移除）。
 * 後端：`LinkCard_ExpressJS_Backend/src/events/routes/engagement.routes.ts:43-46`。
 *
 * ## 四條路由與各自的守門條件（照後端，不是照 Web）
 *
 * | 呼叫 | 方法 | 路徑 | 後端守門 |
 * | --- | --- | --- | --- |
 * | 列表 | `GET` | `/:eventId/org-roles` | `getEventWriteAccess === 'ALLOWED'` |
 * | 邀請 | `POST` | `/:eventId/org-roles/invite` | `getEventSuperAdminAccess === 'ALLOWED'` |
 * | 接受 | `POST` | `/:eventId/org-roles/accept` | 只驗登入 |
 * | 移除 | `DELETE` | `/:eventId/org-roles/:orgRoleId` | `getEventSuperAdminAccess === 'ALLOWED'` |
 *
 * 前兩條的守門**不是同一個**：列表要的是「能管理」（owner / SUPER_ADMIN /
 * COORDINATOR），邀請與移除要的是「能管管理員」（owner / SUPER_ADMIN）。
 * 一個 COORDINATOR 可以**看到**誰在管理這場活動，但不能改。畫面因此分成兩個
 * 判斷（見 `org-roles.tsx`），不能拿一個 `canManage` 通吃。
 *
 * ## ⚠️ `accept` 是 `POST`，不是 `PATCH`
 *
 * Web 寫成 `PATCH`（`lib/events/engagement.ts:157`），但後端那條路徑上只掛了
 * `router.post`（`engagement.routes.ts:45`）——用 `PATCH` 打會是 404。這支在 Web
 * 裡**沒有任何呼叫點**（`acceptEventAdminInvite` 全庫零引用），所以那個錯誤一直
 * 沒被發現：它是死碼，而死碼不會有人回報「打不通」。
 *
 * App 照**後端**建模成 `POST`，並由 `tests/org-role-contract.test.mjs` 釘住
 * 「這一支是 POST」——那個測試存在的唯一目的就是不讓 PATCH 版本回流。
 *
 * ## 為什麼 `accept` 沒有任何畫面在用
 *
 * 因為**邀請 token 沒有任何送達管道**：
 *
 * - 後端 `inviteOrgRole` 把 token 放在**回應**裡回給邀請者
 *   （`EventOrgRoleService.ts:84-90`），但沒有寄任何信（全後端沒有組 org-role
 *   邀請信的程式碼）。
 * - Web 沒有接受頁面，那支函式零呼叫點。
 * - 也就是說「被邀請者拿到 token」這件事在整個系統裡**不存在**。
 *
 * 所以 App 不做接受畫面（做了也沒有 token 可以輸入），但**仍然建模這一支**：
 * 它是「後端真實存在的第四條路由」，把它寫成 `POST` 才不會讓下一個人又照抄
 * Web 的 `PATCH`。畫面的取捨記錄在 `org-roles.tsx` 檔頭。
 *
 * ## 錯誤不回顯後端訊息
 *
 * 四支都可能回 `403 INSUFFICIENT_PERMISSION`、`409 ORG_ROLE_ALREADY_EXISTS`、
 * `404 ORG_ROLE_NOT_FOUND`。分類在 `utils/org-role-display.ts`，這裡只負責把
 * 錯誤往上丟——與 `bank-transfer.service.ts` 同一個分工。
 *
 * ## 路徑寫成行內模板字串的理由
 *
 * `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，往後抓
 * **第一個字串字面**」。若先把路徑組成變數再傳進去，它抓到的會是**下一條**
 * 呼叫的字面，閘門於是以為一條路徑存在——那是靜默失效。
 * `ticket-type.service.ts`、`poll.service.ts`、`bank-transfer.service.ts` 也都是
 * 行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 */
export const orgRoleService = {
  /**
   * GET /v1/events/:eventId/org-roles
   *
   * 誰能管理這場活動。後端已濾掉 `status: REVOKED` 的列
   * （`EventOrgRoleService.ts:22-26`），所以回應裡不會有「已移除」的人——
   * 移除是軟刪除，但清單看不到它。
   *
   * 守門是 `getEventWriteAccess`：COORDINATOR 讀得到、OPERATOR 讀不到。
   * 讀不到時後端回 `403`，不是空陣列——畫面必須把「沒有權限」與「沒有人」
   * 分開講（見 `org-roles.tsx`）。
   */
  async list(eventId: string): Promise<{ orgRoles: EventOrgRole[] }> {
    const res = await apiClient.get<ApiResponse<{ orgRoles: EventOrgRole[] }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/org-roles`,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/org-roles/invite
   *
   * 授予某人後台權限。**這是本模組唯一會「給出權限」的呼叫**，也是誤操作成本
   * 最高的一支（邀請錯人＝把後台交給錯的人）。
   *
   * 後端行為（`EventOrgRoleService.inviteOrgRole:43-90`）有兩個必須知道的細節：
   *
   * 1. 它對 `(eventId, email)` 做 upsert（`@@unique([eventId, email])`，
   *    `schema.prisma:1274`）。同一個人被「再次邀請」不是新增一列，是**覆寫**
   *    既有的列（連 `revokedAt` 一起清掉）。所以「移除後再邀請」會復活同一列。
   * 2. `acceptedAt` 是 `existingUser ? new Date() : null`——**email 已經有帳號
   *    就當場生效**，沒有帳號就停在待接受（而那個待接受永遠不會被接受，因為
   *    token 沒有送達管道，見檔頭）。
   *
   * 回應的鍵是 `orgRoleId`（不是 `invitationId`），見
   * `types/orgRole.types.ts`。
   */
  async invite(
    eventId: string,
    payload: InviteOrgRolePayload,
  ): Promise<InviteOrgRoleResult> {
    const res = await apiClient.post<ApiResponse<InviteOrgRoleResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/org-roles/invite`,
      payload,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/org-roles/accept
   *
   * 被邀請者用 token 接受邀請。**目前沒有任何畫面呼叫它**——理由見檔頭
   * （token 沒有送達管道）。它存在是為了把「後端第四條路由」與「正確的
   * method」固定下來：Web 的 `PATCH` 版本是死碼，不能照抄。
   *
   * 後端會把 token 清掉（`token: null`）並把 `expiresAt` 設為 `null`
   * （`EventOrgRoleService.acceptInvite:106-117`），所以一個 token 只能用一次。
   * 失效的 token 回 `404 INVITE_TOKEN_NOT_FOUND`，過期回
   * `400 INVITE_TOKEN_EXPIRED`。
   */
  async accept(
    eventId: string,
    token: string,
  ): Promise<{ orgRole: EventOrgRole }> {
    const res = await apiClient.post<ApiResponse<{ orgRole: EventOrgRole }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/org-roles/accept`,
      { token },
    );
    return res.data.data;
  },

  /**
   * DELETE /v1/events/:eventId/org-roles/:orgRoleId
   *
   * 撤銷某人的後台權限。**路徑上的 id 是 `EventOrgRole.id`，不是 user id**
   * ——Web 的函式註解也特別強調這件事（`lib/events/engagement.ts:164-167`）。
   * 傳 user id 會得到 `404 ORG_ROLE_NOT_FOUND`。
   *
   * 這是**軟刪除**：後端把 `status` 設成 `REVOKED` 並填 `revokedAt`
   * （`EventOrgRoleService.removeOrgRole:122-135`），資料列留著。清單看不到它，
   * 但同一組 `(eventId, email)` 再被邀請時會走 upsert 復活同一列。
   *
   * 後端**沒有任何額外保護**：既沒有「不能移除最後一個 SUPER_ADMIN」，也沒有
   * 「不能移除自己」。畫面因此不提供註定失敗的按鈕，而是靠「哪些列不顯示移除
   * 鈕」來表達（見 `org-roles.tsx` 檔頭的查證結果）。
   */
  async remove(eventId: string, orgRoleId: string): Promise<void> {
    await apiClient.delete(
      `/api/v1/events/${encodeURIComponent(eventId)}/org-roles/${encodeURIComponent(orgRoleId)}`,
    );
  },
};
