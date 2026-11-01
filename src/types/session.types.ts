/**
 * 場次（Event Session）型別 — parity `sessions`。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/types.ts:819-905` 的
 * `EventSession`、`SessionRegistrationAttendee`、`SessionRegistrationsResponse`。
 *
 * ## 為什麼獨立成一個檔案
 *
 * 與 `poll.types.ts` / `ticketType.types.ts` 同一個理由：這一組型別有兩條
 * 必須寫在型別旁邊的約定（下面的 `EventSession` 與 `attendance`），
 * 塞進 824 行的 `api.types.ts` 會沒有人看到。這不是新的分層。
 *
 * ## 刻意沒有建模的東西（不是漏抄）
 *
 * - **`exhibitorId`／`isPublished`／`createdAt`／`speakerProfile`**：
 *   後端 `EventSessionService.listSessions:68-86` 的 select 有這些欄位，
 *   但 Web 的 `EventSession` 沒有收，App 畫面也不用。收進來只會多出四個
 *   沒有人讀的欄位，讓下一個人以為「有 UI 在用」。
 * - **`EventSessionRegistration`（報名／取消報名的回應）**：那是**參加者**
 *   的行為，不是後台動作。App 沒有「替人報名場次」的畫面，所以不收。
 *   ⚠️ 順帶記一筆：Web 的 `EventSessionRegistration`（`types.ts:843-851`）
 *   宣告了 `updatedAt`，但 `schema.prisma:956-969` 的
 *   `EventSessionRegistration` **沒有 `updatedAt` 欄位**。Web 這個欄位永遠
 *   是 `undefined`。App 沒有收這個型別，所以不會繼承這個謊；若未來要收，
 *   請不要照抄那兩行。
 */

/**
 * 場次類型。逐字對齊 Prisma `enum EventSessionType`
 * （`LinkCard_ExpressJS_Backend/prisma/schema.prisma:917-925`），
 * 七個值，不多不少。
 *
 * 為什麼要強調「逐字」：後端 `CreateSessionDto` 對這個欄位掛 `@IsEnum`，
 * 傳一個拼錯的字串不會被前端擋下來，而是後端回 400。值的來源只能是 schema。
 */
export type EventSessionType =
  | "WORKSHOP"
  | "CONFERENCE"
  | "KEYNOTE"
  | "PARTY"
  | "MEDIA_DAY"
  | "PRODUCT_LAUNCH"
  | "NETWORKING";

/** `GET …/sessions` 的 `sessions[]` 元素。 */
export interface EventSession {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  sessionType: EventSessionType;
  /** ISO 8601。畫面要自己格式化，型別不假裝它是 Date。 */
  startDate: string;
  endDate: string;
  location?: string | null;
  speakerName?: string | null;
  /** `null` ＝不限人數。 */
  capacity?: number | null;
  /**
   * 已報名人數。
   *
   * ⚠️ **不要拿它跟 `capacity` 自己算「還有幾位」就下結論**：後端
   * `listSessions:91-94` 是用 `_count.sessionRegistrations` **覆寫**這個欄位
   * （DB 上真正的 `currentCount` 是冗餘計數，對舊的無上限場次會漂移）。
   * 也就是說這個值本來就是「活列數」，直接顯示即可，但**不可**寫回後端。
   */
  currentCount: number;
  /** `Decimal` 以**字串**過 JSON 邊界（與票種的 `price` 同一個慣例）。 */
  price?: string | null;
  tokenCost: number;
  /**
   * 呼叫者自己是否已經報名這一場。
   *
   * 由後端依「呼叫者的 token」在伺服器端解析（`listSessions:96-103`），
   * 匿名呼叫者一律拿到 `false`。**App 後台不需要它**（後台不是參加者），
   * 但列表端點一定帶著它，型別若不宣告就會讓人以為後端沒送。
   */
  isRegistered?: boolean;
}

/**
 * 後端**推導**出來的三態出席（`deriveSessionAttendanceState`）。
 *
 * 為什麼是推導而不是存下來的狀態：`schema.prisma:962` 只有 `attendedAt`
 * 一個欄位，沒有 `status`。三態是「有沒有 `attendedAt`」＋「場次結束了沒」
 * 兩個事實算出來的，所以它**不會有第三種寫入路徑**，也不需要 backfill。
 *
 * - `ATTENDED`：已報到
 * - `NO_SHOW`：場次已結束且從未報到
 * - `REGISTERED`：有位子、場次還沒結束
 */
export type SessionAttendanceState = "ATTENDED" | "NO_SHOW" | "REGISTERED";

/** 名冊的一列（`GET …/sessions/:sessionId/registrations`）。 */
export interface SessionRegistrationAttendee {
  /** `EventSessionRegistration.id`（不是報名 id）。 */
  id: string;
  sessionId: string;
  /** `EventRegistration.id`——要跳去報名詳情時用這個。 */
  registrationId: string;
  attendedAt?: string | null;
  /**
   * 舊版後端可能不回傳（Web 的型別也寫選填）。
   * 畫面必須能退化成「只看 `attendedAt` 有沒有值」。
   */
  attendanceState?: SessionAttendanceState;
  createdAt: string;
  registration: {
    id: string;
    registrationCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    /**
     * 報名狀態。這裡刻意用 `string` 而不是既有的列舉型別：
     * 後端這個 select 沒有型別保證（`EventSessionService:435` 只是
     * `select: { status: true }`），而名冊頁不需要對它分支。
     */
    status: string;
    ticketType?: { id: string; displayName: string } | null;
  };
}

/** `GET …/sessions/:sessionId/registrations` 的完整回應。 */
export interface SessionRegistrationsResponse {
  /** 這一場的摘要（後端同一次查詢帶回，不是第二次 round trip）。 */
  session: {
    id: string;
    title: string;
    capacity?: number | null;
    /**
     * DB 上的冗餘計數。**名冊頁不要用它**——請改用 `registeredCount`，
     * 理由見 `EventSession.currentCount` 的註解。
     */
    currentCount: number;
    /** 活列數（`_count.sessionRegistrations`），與名冊的 `total` 同源。 */
    registeredCount: number;
    startDate: string;
    endDate: string;
    location?: string | null;
    sessionType: EventSessionType;
  };
  registrations: SessionRegistrationAttendee[];
  /**
   * 出席彙總。`registered` 與 `noShow` **互斥**：場次結束前剩餘的人算
   * `registered`，結束後算 `noShow`（`EventSessionService:462-472`）。
   *
   * 選填是因為舊版後端沒有這個區塊——畫面必須容忍 `undefined`。
   */
  attendance?: {
    total: number;
    attended: number;
    registered: number;
    noShow: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * `POST …/sessions` 與 `PATCH …/sessions/:sessionId` 的 body。
 *
 * ## 為什麼每一個選填欄位都寫成 `X | null` 而不是 `X?`
 *
 * 後端 `updateSession`（`EventSessionService:209-237`）的語意是
 * **`input.x !== undefined` 才改**：
 *
 * - 送 `null` ⇒ `description?.trim() ?? null` ⇒ **清空**
 * - 不送（`undefined`）⇒ 該欄位**原封不動**
 *
 * 這是兩種完全不同的結果。Web 的編輯表單每次都送**完整** payload
 * （空字串轉 `null`），所以「把主講人刪掉」真的會清掉。
 * 若這裡把欄位宣告成 `X?`，下一個人很容易只送有變動的欄位，
 * 於是「清空」永遠做不到，而且不會報錯。
 *
 * ⇒ 型別強制你回答每一個欄位要送什麼。
 *
 * ## 為什麼不含 `exhibitorId` 與 `isPublished`
 *
 * 後端兩個都收，但 Web 的表單兩個都不送。加上去就是一個 Web 沒有的能力
 * （A2：不接受等效的新端點，也不自行擴張）。要開放請先走跨 repo 決定。
 */
export interface SessionCreatePayload {
  /** 後端 `@IsNotEmpty()`；`trim()` 後存入。 */
  title: string;
  description: string | null;
  sessionType: EventSessionType;
  /** ISO 8601（後端 `@IsDateString()` 會擋非 ISO 字串）。 */
  startDate: string;
  endDate: string;
  location: string | null;
  speakerName: string | null;
  /** `null` ＝不限；有值時後端要求 `@IsInt() @Min(1)`。 */
  capacity: number | null;
  /** `Decimal` 入口：Web 送 `Number`，由後端轉 `Prisma.Decimal`。 */
  price: number | null;
  /** 後端 `@IsInt() @Min(0)`。 */
  tokenCost: number;
}

/**
 * `PATCH` 的 body。與建立**同一個形狀**，因為 Web 就是送完整 payload
 * （理由見 `SessionCreatePayload` 的 `X | null` 段）。
 */
export type SessionUpdatePayload = SessionCreatePayload;
