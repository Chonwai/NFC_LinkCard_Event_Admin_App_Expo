/**
 * LinkCard Event Admin App — 繁中文案（單一真相來源）
 *
 * 所有使用者可見字串集中於此，避免各頁面散落 magic strings。
 * 命名：CAMEL_CASE 的語意鍵，與 UI 用途對齊。
 */
export const copy = {
  app: {
    name: "LinkCard Event Admin",
    version: "1.0.0",
    tagline: "活動現場營運工具",
  },
  /**
   * `F-07`：非開發建置缺少 `EXPO_PUBLIC_API_URL` 時的啟動錯誤畫面。
   *
   * 與 Promoter App `W-24` 同設計：module-load throw 會白屏、沒有任何畫面可讀，
   * 因此改用可渲染的錯誤狀態。沒有這畫面，設定錯誤會偽裝成「登入一直失敗」。
   */
  appConfig: {
    title: "應用程式設定不完整",
    message:
      "此建置沒有帶入後端 API 位址。為避免誤寫 production 資料，已停止所有網路連線。請通知維運以正確的環境變數重新建置。",
    reasonLabel: "原因代碼",
  },
  /**
   * 跨畫面共用的通用文案。
   *
   * `src/components/ui/*` 是被多個畫面重用的葉節點元件，它們的讀屏標籤不屬於
   * 任何單一畫面，因此不能住在某個畫面的 namespace 裡。原則同 `notFound`：
   * 已有同義字串就沿用既有鍵，不另立重複字串。
   */
  common: {
    /** 標頭返回鈕的讀屏標籤（消費端：`components/ui/ScreenHeader`） */
    back: "返回",
    /**
     * 手動重新整理鈕的讀屏標籤／忙碌態。
     * 消費端：`components/ui/ScreenHeader`、`app/(auth)/home.tsx`。
     * `CRA-V1-023` 原本把這兩個字串建在 `home` namespace（當時只有活動列表
     * 有這顆鈕）；`ScreenHeader` 也提供同一顆鈕之後上移到 `common`，
     * 全站維持單一字串來源。
     */
    refresh: "重新整理",
    refreshing: "重新整理中",
    /**
     * 二次確認框的取消鈕。
     *
     * `bankTransfers.cancel` / `ticketTypes.cancel` 原本各自有一份（都是「取消」）。
     * 組織角色頁的確認框是第三個消費者，字面完全相同——依本命名空間既有的原則
     * （「已有同義字串就沿用既有鍵，不另立重複字串」），這裡新增一條共用鍵，
     * 新程式碼一律用它；舊的兩個命名空間維持原樣，不在本次改動範圍內。
     */
    cancel: "取消",
    /** 可關閉橫幅（fatal/info banner）關閉鈕的讀屏標籤。消費端：`components/ui/InlineBanner` */
    dismiss: "關閉提示",
    /** 必填欄位的讀屏標籤。消費端：`components/ui/FieldInput` */
    requiredLabel: (label: string) => `${label}，必填`,
    /** 密碼欄位顯示／隱藏切換鈕的讀屏標籤。消費端：`components/ui/FieldInput` */
    revealPassword: "顯示密碼",
    hidePassword: "隱藏密碼",
    /**
     * 銀行帳號欄位的顯示／隱藏標籤（`FieldInput` 的 `revealLabel` /
     * `hideLabel`）。不沿用密碼那兩個字串：讀屏會念「顯示密碼」，但這個欄位
     * 是銀行帳號，不是密碼。
     */
    revealAccountNumber: "顯示銀行帳號",
    hideAccountNumber: "隱藏銀行帳號",
  },
  auth: {
    emailLabel: "電子郵件",
    emailPlaceholder: "you@example.com",
    passwordLabel: "密碼",
    passwordPlaceholder: "輸入你的密碼",
    loginButton: "登入",
    loginLoading: "登入中…",
    loginFailed: "帳號或密碼錯誤，請再試一次",
    networkError: "無法連線伺服器，請檢查網路後再試",
    accountSuspended: "此帳號已停用，請聯絡管理員",
    sessionExpired: "登入狀態已過期，請重新登入",
    loggedOut: "已登出",
    errorEmpty: "請輸入 Email 和密碼。",
    errorEmail: "請輸入有效的 Email 格式。",
    errorSuspended: "此帳號已被停用，請聯絡管理員。",
    errorNetwork: "無法連線至伺服器。請確認網路連線後重試。",
    errorServer: (status: number | null) =>
      `伺服器暫時無法回應（${status ?? "未知"}），請稍後再試。`,
    errorUnknown: "登入失敗，請稍後再試。",
  },
  home: {
    title: "我的活動",
    emptyTitle: "沒有管理中的活動",
    emptyHint: "當你被指派為活動管理員時，活動會顯示在這裡",
    /**
     * 建立活動的入口（Web `manage/events/page.tsx:283` 的那顆按鈕）。
     * 空狀態另有一個「建立第一個活動」的 CTA，與 Web 的空狀態一致。
     */
    createEvent: "建立活動",
    createFirst: "建立第一個活動",
    loadFailed: "載入活動失敗，請稍後再試",
    retry: "重新載入",
    /** 重新整理鈕的文案已上移到 `common.refresh` / `common.refreshing`（ScreenHeader 也要用） */
  },
  event: {
    overviewTitle: "活動概覽",
    checkInTitle: "Check-in",
    scanCheckIn: "掃碼簽到",
    tokenTitle: "Token",
    registrationsTitle: "名單",
    registrations: "報名人數",
    checkedIn: "已報到",
    exhibitors: "參展商",
    attendanceRate: "到場率",
    tokenIssued: "Token 發放",
    tokenConsumed: "Token 消耗",
    tokenDegradedHint: "尚無活動級彙總端點，不顯示估算數字",
    dash: "—",
    /**
     * `CRA-V1-002`：破折號的說明文字。
     *
     * 破折號自己讀不出原因——操作者分不出「真的掛零」與「這個數字沒拿到」。
     * `checkIn.counterUnavailableHint` 已經處理了總簽到計數那一顆，活動列表
     * 與活動概覽卻還是裸的破折號，同一條慣例在三個畫面上只落實了一個。
     *
     * 活動列表（`home.tsx`）與活動概覽（`overview.tsx`）共用這一句，因為兩邊
     * 講的是同一件事。只在畫面上真的出現破折號時才渲染（由
     * `utils/count-display.getCountUnavailableHint` 決定），否則每張卡片都會
     * 多一行沒有資訊的字。
     */
    countUnavailableHint: "（破折號＝未取得此數字，不是 0）",
    unknownStatus: "未知狀態",
    quickActions: "快速操作",
    badgesTitle: "Badge",
    backToOverview: "返回概覽",
    modulePlaceholderTitle: "功能建置中",
    /**
     * Token 沒有「活動層級櫃台」這個東西——後端只有 per-registration 的
     * balance / transactions。Web 的錢包頁也是參加者視角。
     * 這段文案之前說「完整櫃台在 Web」，但那個頁面不存在（§S-8）。
     */
    tokenPlaceholderHint:
      "Token 帳本以每位參加者為單位。請從名單進入任一報名，即可看到該人的交易流水。",
    tokenOpenRoster: "從名單查看",
    /**
     * W-12：`eventId` 路由參數缺失（空字串 / `undefined`）時的空態文案。
     * 消費端：`overview.tsx` / `check-in.tsx` / `nfc-bind.tsx`。
     */
    unavailableTitle: "找不到活動",
    unavailableHint: "此連結可能不完整，或活動已被移除",
  },
  /**
   * 活動狀態標籤——鏡射後端 `EventStatus` enum
   * （`LinkCard_ExpressJS_Backend/prisma/schema.prisma`）。
   * 消費端：`src/utils/event-status.ts` 的 `EVENT_STATUS_LABEL`——這是唯一映射處，
   * 畫面不得各自再寫一份（活動列表先前就有一份重複的，`NEW-D2-04` 已收斂）。
   *
   * 鍵集合＝後端 `prisma` 的六個值 ＋ 一個歷史值。`2026-11-01` 起
   * `types/api.types.ts` 的 `EventStatus` 已改為與 `prisma` 完全一致
   * （`DRAFT / PUBLISHED / ONGOING / COMPLETED / CANCELLED / ARCHIVED`），
   * 舊宣告裡的 `REGISTRATION_OPEN` / `ENDED` 從來不存在於後端，已移除。
   *
   * `registrationOpen` 這條文案**刻意保留**：`EVENT_STATUS_LABEL` 以
   * `Record<string, string>` 宣告，保留它才能讓既有測試與任何殘留資料
   * 仍顯示「報名中」而不是原始英文 enum。它不再是合法型別值，但不影響顯示。
   * 遇未知值仍回退為原始字串。
   */
  eventStatus: {
    draft: "草稿",
    published: "已發布",
    registrationOpen: "報名中",
    ongoing: "進行中",
    /** 後端 `prisma` 的值 */
    completed: "已結束",
    cancelled: "已取消",
    archived: "已封存",
  },
  /**
   * Badge 狀態標籤（5 值）——鏡射 `BadgeStatus`。
   * ⚠️ 與 `eventStatus` **語意不同不可共用**（活動狀態 ≠ badge 狀態）。
   * 消費端：`app/(auth)/[eventId]/badges.tsx` 的 `STATUS_LABELS`。
   */
  badgeStatus: {
    unassigned: "未綁定",
    bound: "已綁定",
    active: "啟用",
    deactivated: "停用",
    lost: "遺失",
  },
  /** Badge 頁文案（消費端：`app/(auth)/[eventId]/badges.tsx`） */
  badges: {
    lookupHint: "查詢 Badge（輸入 tagUid）",
    lookupButton: "查詢",
    lookupNotFound: "找不到此 Badge",
    lookupFailed: "Badge 查詢失敗",
    tagUidLabel: "tagUid",
    boundAtLabel: "綁定時間",
    boundAtEmpty: "尚未綁定",
    copyTagUid: "複製 tagUid",
    tagUidCopied: "已複製",
    boundRegistration: "綁定報名：",
    displayNameLabel: "姓名",
    companyLabel: "公司",
    jobTitleLabel: "職稱",
    registrantTypeLabel: "類型",
    profileUrlLabel: "Profile",
    lookupResultTitle: "查詢結果",
    listSectionTitle: "Badge 列表",
    emptyTitle: "尚無 Badge",
    emptyHint: "先建立批次或綁定 Badge",

    /*
     * 以下為 2026-11-01「badges 能力對齊 Web」新增。
     * 文案全部照 Web 的 `event_manage:badges.*`（zh-TW）改寫成手機適合的長度，
     * 不自行發明新語意——同一個欄位在兩個平台上叫不同名字，操作員會以為是
     * 兩件不同的事。
     */
    /** 狀態篩選的第一顆晶片（＝ 不過濾）。Web 的 `statusFilterAll`。 */
    statusFilterAll: "全部",
    /** 篩選列的標籤。Web 沒有這個標籤（它是按鈕列），手機需要它來說明那排晶片。 */
    statusFilterLabel: "依狀態篩選",
    /** 統計卡：這張卡上的數字是「該活動全部 badge」，不是當頁。 */
    statsHeading: "庫存總覽",
    total: "總數",
    totalDesc: "此活動全部 Badge",
    unassigned: "未指派",
    unassignedDesc: "尚未指定用途",
    written: "已寫卡",
    writtenDesc: "已寫入實體 tagUid",
    bound: "已綁定",
    boundDesc: "已綁到報名者",
    /**
     * 統計請求失敗時的註記（R4）。
     *
     * 失敗時**不清空**卡片：舊數字比空白有用（Web 也是保留舊值）。但靜默保留
     * 等於讓操作員拿過期數字下判斷，而且分不出「總數真的是 0」與「這次讀不到」。
     * 這一句只說「不是剛剛讀到的」，不宣稱數字是錯的。
     */
    statsStale: "統計未能更新，以上是上次讀到的數字",
    deactivated: "已作廢",
    deactivatedDesc: "停用或遺失",
    /** 批次聚合區塊。 */
    batchesHeading: "批次",
    batchesEmpty: "尚無批次",
    /** 沒有 batchId 的散卡群組在畫面上的名字（Web 沒有這個標籤，見 utils 檔頭）。 */
    noBatchLabel: "未入批次",
    countColumn: "張數",
    writtenColumn: "已寫",
    boundColumn: "已綁",
    assignedColumn: "已指派",
    /** 明細列的欄位標籤。 */
    writtenAtLabel: "寫卡時間",
    writtenAtEmpty: "尚未寫卡",
    qrCodeLabel: "QR",

    /*
     * 建立批次（2026-11-01 對齊 Web 的 `badges.createBatch*`）。
     * 張數上下限的來源是後端 DTO，不是這份文案——這裡只放顯示用的字。
     */
    createBatch: "建立批次",
    createBatchTitle: "建立 Badge 批次",
    createBatchIntro:
      "一次產生整批 badge 記錄。手環寫卡後就是一次性庫存，請先確認張數。",
    countLabel: "張數",
    countPlaceholder: "50",
    badgeTypeLabel: "載體類型",
    /** 不指定 → 後端套自己的預設（`CARD`）。前端不猜。 */
    badgeTypeAny: "不指定",
    colorCodeLabel: "色碼（選填）",
    colorCodePlaceholder: "#7C3AED",
    batchLabelLabel: "批次名稱（選填）",
    batchLabelPlaceholder: "例：StartupFest 第一批",
    countRangeHint: (min: number, max: number) => `可建立 ${min}–${max} 張`,
    nextStep: "下一步",
    errorCountRange: "張數必須是 1 到 500 的整數",
    errorColorFormat: "色碼格式不正確（例：#7C3AED）",
    /** 建立批次的送出錯誤（權限／後端拒絕），與欄位錯誤分開。 */
    createFailed: "建立批次失敗，請確認權限後重試",
    createSuccess: (count: number) => `已建立 ${count} 張 badge`,
    confirmCreateTitle: "確認建立批次",
    confirmCreateIntro: "按下確認後會立刻建立這批 badge。",
    /**
     * 建立批次的不可逆說明。
     *
     * 必須寫明「張數無法減少」與「寫入後無法改派」——這是操作員在按下確認前
     * 唯一會看到的地方，而這兩個動作都沒有反轉 API。
     */
    confirmCreateWarning:
      "手環是一次性實體庫存：批次建立後張數無法減少；寫入真實 tagUid 之後也無法改派到別的批次。",
    rowCount: "張數",
    rowBadgeType: "載體類型",
    rowColorCode: "色碼",
    rowBatchLabel: "批次名稱",
    /** 確認框裡「這個欄位沒填」的顯示字。 */
    notSpecified: "未指定",
    confirmCreate: "確認建立",

    /*
     * 完成批次（回填實體 tagUid）。Web 用一個 textarea，每行
     * `badgeId,realTagUid`；App 照抄格式，因為現場的資料來源就是同一份表。
     */
    completeBatch: "完成批次",
    completeBatchTitle: "回填實體 tagUid",
    completeBatchIntro:
      "每行一筆，格式：badgeId,realTagUid。貼上後按「下一步」核對筆數。",
    completeBatchPlaceholder: "b3f1c2a4-…,04A2B3C4\nb3f1c2a5-…,04A2B3C5",
    completeBatchHint: "多餘的欄位會被忽略；同一個 badgeId 只能出現一次。",
    errorCompleteFormat: "格式不正確：每行必須是 badgeId,realTagUid",
    /** 重複 badgeId 的訊息。與格式錯誤分開——處置是「挑出哪一筆才對」。 */
    errorCompleteDuplicate:
      "同一個 badgeId 出現多次；手環是一次性的，請先移除重複",
    completeFailed: "回填失敗，請確認權限後重試",
    completeSuccess: (updated: number) => `已回填 ${updated} 張`,
    /** 部分成功（後端逐筆回報，`failures` 非空）。 */
    completePartial: (updated: number, failed: number) =>
      `已回填 ${updated} 張，${failed} 張失敗`,
    confirmCompleteTitle: "確認回填 tagUid",
    confirmCompleteIntro:
      "送出後會把這批 badge 的假 tagUid 換成下方列出的實體 UID。",
    /**
     * 回填的不可逆說明。這是三個寫入動作裡最需要講清楚的一個：
     * 手環一旦寫入就沒有第二次。
     */
    confirmCompleteWarning:
      "手環是一次性的：同一個 badgeId 一旦寫入真實 UID，就無法改派給別張手環，也無法還原成原本的假 tagUid。",
    rowCompleteCount: "筆數",
    rowCompletePreview: "前幾筆",
    /** 預覽只放前幾筆；剩下幾筆要在確認框裡講出來。 */
    completePreviewMore: (remaining: number) => `…另有 ${remaining} 筆`,
    confirmComplete: "確認回填",

    /*
     * 指派 badge 給展商（`POST /nfc/batch/claim`）。
     * 展商清單由 dialog 自己載入（四狀態合併，理由見
     * `components/badges/ClaimBadgesDialog.tsx` 檔頭）。
     */
    claim: "指派",
    claimTitle: "指派 badge 給展商",
    claimIntro: (count: number) => `將指派 ${count} 張 badge。`,
    claimSearchPlaceholder: "搜尋展商名稱",
    claimExhibitorsEmpty: "找不到展商",
    claimExhibitorsLoadFailed: "展商清單載入失敗，請稍後重試",
    claimNext: "下一步",
    /** 後端 `BADGE_ALREADY_ASSIGNED`：有些卡已被別家拿走。 */
    claimAlreadyAssigned: "其中有些 badge 已指派給其他展商",
    claimFailed: "指派失敗，請確認權限後重試",
    claimSuccess: (count: number) => `已指派 ${count} 張`,
    confirmClaimTitle: "確認指派",
    confirmClaimIntro: "送出後這批 badge 會歸屬給下方展商。",
    /**
     * 指派的不可逆說明。後端沒有「取消指派」端點，要改派只能再呼叫一次
     * 並讓後端決定可否覆蓋——對操作員而言就是「按下去就要對」。
     */
    confirmClaimWarning:
      "指派後這批手環的歸屬就記錄在該展商名下；頁面上沒有取消指派的動作，改派前請先與原展商確認。",
    rowClaimExhibitor: "展商",
    rowClaimCount: "張數",
    confirmClaim: "確認指派",

    /*
     * 匯出 CSV。
     *
     * ⚠️ 與 Web 的行為不完全相同：Web 按下就得到一個 `.csv` 檔（Blob + <a
     * download>），App 沒有檔案系統依賴，得到的是可複製的 CSV 原文。理由與
     * 完整說明在 `components/badges/ExportCsvDialog.tsx` 檔頭。
     */
    exportCsv: "匯出 CSV",
    exporting: "匯出中…",
    exportTitle: "Badge 匯出（CSV）",
    exportIntro:
      "以下是後端回傳的 CSV 原文。App 沒有檔案存取權限，請按「複製全部」後貼到試算表或存檔。",
    copyCsv: "複製全部",
    csvCopied: "已複製",
    exportClose: "關閉",
    exportFailed: "匯出失敗，請確認權限後重試",
    exportEmpty: "沒有可匯出的資料",
  },
  checkIn: {
    scanHint: "掃描報名 QR code",
    manualMode: "手動輸入",
    scanMode: "掃描模式",
    codePlaceholder: "輸入報名編號",
    submit: "查詢並報到",
    checking: "確認中…",
    checkedIn: "報到成功",
    alreadyCheckedIn: "此報名已報到過",
    registrationNotFound: "找不到此報名，請確認編號",
    notConfirmed: "此報名尚未確認",
    notEnoughPermission: "權限不足，無法執行報到",
    /**
     * CRA-V1-002：連不上伺服器時的文案。**不可**與 `registrationNotFound` 混用——
     * 前者是「人工核對」，後者是「這張票不存在」，現場處置完全不同。
     */
    networkError: "網路連線異常，請改用人工核對或稍後重試",
    /**
     * `F-02`：伺服器有回應、但不是 4xx（5xx／閘道回 HTML）時的文案。
     * **不可**與 `registrationNotFound` 混用——後端壞掉時把有效票講成
     * 「不存在」，現場會照著作廢它；與 `networkError` 分開是因為
     * 「連不上」與「伺服器壞了」對操作者的下一步不同（重試 vs 換網路）。
     */
    serverError: "伺服器暫時異常，請改用人工核對或稍後重試",
    /** 後端 `REGISTRATION_LOOKUP_RATE_LIMITED`（CRA-V1-023：原為硬編字串） */
    rateLimited: "查詢過於頻繁，請稍後再試",
    cameraUnavailable: "無法取得相機權限",
    enableCamera: "允許使用相機",
    /**
     * `INC-2`（Loop AF）：成功態計時提示。帶秒數（由畫面傳入
     * `CHECK_IN_AUTO_RESET_MS / 1000`）而非只寫「即將自動重置」——
     * 操作者要能預期「還有多久」，才會決定從容按按鈕或等它自己跳回。
     */
    autoResetHint: (seconds: number) =>
      `約 ${seconds} 秒後自動返回；或按「繼續掃碼」`,
    switchToManual: "改用輸入模式",
    switchToScan: "改用掃描模式",
    attendeeName: "姓名",
    attendeeEmail: "Email",
    attendeeCompany: "公司",
    attendeeType: "類型",
    attendeeTicket: "票種",
    attendeeRegisteredAt: "報名時間",
    attendeeTokenBalance: "Token 餘額",
    attendeeStatus: "簽到狀態",
    /**
     * `11` `WP-18`：報到結果卡的公開檔案列。值是 `/p/{slug}`（去 origin 的路徑，
     * 不是完整 URL——完整 URL 由後端與寫卡頁各自持有，這裡不再組一次 origin）。
     * `INC-2`（Loop AF）：標籤由 "Profile" 改為「名片」——PM 與現場的
     * 心智模型是「名片」，不是系統欄位名。
     */
    profileLabel: "名片",
    /**
     * `11` `WP-18`／`INC-2`（Loop AF）：名片未就緒時的理由文案。
     * 依本檔既有慣例（見 `counterUnavailableHint`）：空值一律帶著「為什麼」。
     * 舊句「無公開檔案，無法寫卡」有兩個錯：①staging 的 `checkIn` 缺欄時
     * 對「有 profile 的人」也誤顯；②「無法寫卡」在寫卡改寫解析器 URL
     * （`INC-3`，同一次 ADM build）後不再為真——名片未就緒仍可寫卡。
     */
    noPublicProfile: "（名片尚未就緒；仍可寫卡）",
    /**
     * `WP-R2`（Loop AF R2）：報到結果卡的「LinkCard 帳號」列（PM 裁定 `OQ-2`：
     * 現場要看得出「有沒有激活」）。三態由 `getCheckInAccountStatusLabel`
     * 判讀（`undefined`＝BE 尚未部署 ⇒ 整列不渲染）。用語對齊平台既有文案
     * （FE 會員「已激活」、BE 啟動信「激活帳戶並加入」）；「未激活」以全角
     * 括號標示為「已建檔」的子狀態（同 `noPublicProfile` 的括號慣例），
     * 避免被讀成兩個並列項。
     */
    accountLabel: "LinkCard 帳號",
    accountNotRegistered: "未建檔",
    accountRegisteredNotActivated: "已建檔（未激活）",
    accountActivated: "已激活",
    /**
     * `11` `WP-18`：報到成功卡的主 CTA。帶著報名碼接續到寫卡頁，
     * 現場不必再看著 QR 重輸一次（每張卡省下的 30-60 秒）。
     */
    gotoWriteCard: "寫入 NFC 卡",
    resultTitle: "報到結果",
    checkedInAt: "報到時間",
    totalCheckedIn: "總簽到",
    counterFallbackHint: "（累計，非今日）",
    /**
     * `F-03`：計數讀取失敗時**取代** `counterFallbackHint`。
     *
     * 單獨一個破折號讀不出原因——操作者無法分辨「今天還沒有人報到」與
     * 「這個數字沒讀到」，而兩者的下一步完全不同（繼續作業 vs 重新整理）。
     * 同慣例見 `event.tokenDegradedHint`、`roster.nfcEmptyHint`、
     * `roster.orgEmptyHint`：破折號一律帶著「為什麼是破折號」。
     */
    counterUnavailableHint: "（讀取失敗，請重新整理）",
    validHeadline: "報到成功",
    duplicateHeadline: "重複簽到",
    invalidHeadline: "無效報名",
    continueScan: "繼續掃碼",
    /**
     * 重複報到只剩「說明」，沒有可執行的動作：後端沒有覆核端點（§S-1）。
     * 文案刻意寫「尚無」，不寫「載入中」——不要讓操作者以為再試一次會成功。
     */
    overrideBlockedBanner:
      "重複報到無法在 App 內放行：後端目前沒有覆核端點。現場請人工放行並記錄。",
    walkInEntry: "現場補報名",
    walkInTitle: "現場補報名",
    walkInPlaceholderTitle: "補報名功能建置中",
    walkInPlaceholderHint:
      "完整表單將於名單模組（WP-A5）交付；目前僅保留入口。",
    walkInEmail: "電子郵件",
    walkInFirstName: "名",
    walkInLastName: "姓",
    walkInPhone: "電話",
    walkInCompany: "公司",
    walkInTicket: "票種",
    walkInSubmit: "建立報名",
    walkInConsentLabel: "我已閱讀並同意服務條款與隱私政策",
    walkInSuccess: "已建立報名",
    walkInPaymentNote:
      "此票需要付款。報名已建立，但尚未完成付款，不能當成已入場。",
    walkInGoCheckIn: "前往簽到",
    walkInGoNfc: "前往寫卡",
    walkInNeedEmail: "請輸入有效的 Email",
    walkInNeedTicket: "請先選擇票種",
    walkInNeedConsent: "請先閱讀並同意條款",
    walkInConsentRequired: "請先閱讀並同意條款",
    walkInConsentVersionMismatch: "條款已更新，請重新閱讀並同意",
    walkInTicketNeedsDynamicFields:
      "此票種需填寫報名表單欄位，App 現場補報名暫不支援——請改用網頁報名連結。",
    walkInFailed: "補報名失敗，請稍後再試",
    walkInNotAccepting: "此活動目前不接受報名",
    walkInNoTickets: "沒有可選的票種",
    clearCode: "清除報名編號",
    dash: "—",
    statusCheckedIn: "已報到",
    statusPending: "待確認",
    registrantTypeLabels: {
      ATTENDEE: "參加者",
      EXHIBITOR: "參展商",
      EXHIBITOR_REP: "參展代表",
      SPEAKER: "講者",
      STAFF: "工作人員",
      VIP: "VIP",
      MEDIA: "媒體",
    },
  },
  roster: {
    title: "名單",
    searchPlaceholder: "搜尋已載入的姓名、Email 或編號",
    operatorForbidden:
      "閘口帳號暫時讀不了名單。後端仍要求主辦或協調員權限，請改用那類帳號。",
    loadFailed: "名單載入失敗，請稍後再試",
    emptyTitle: "沒有符合的報名",
    emptyHint: "試試清除篩選，或確認此活動已有報名",
    filterAll: "全部",
    sortRecent: "報名時間",
    sortName: "姓名",
    /** 篩選列（對應 Web 的票種分頁籤 + 可見性 / 押金退款 select） */
    filterTicketType: "票種",
    filterAllTicketTypes: "全部票種",
    filterVisibility: "可見性",
    filterDepositRefund: "押金退款",
    visibilityLabels: {
      all: "全部",
      active: "進行中",
      hidden: "已隱藏",
      archived: "已封存",
    },
    depositRefundLabels: {
      all: "全部",
      refunded: "已退",
      not_refunded: "未退",
    },
    registeredAt: "報名",
    copyCode: "複製報名編號",
    codeCopied: "已複製報名編號",
    /**
     * 待付款列的「複製付款連結」（對應 Web `CopyLinkButton`）。
     * Web 只對 `PENDING_PAYMENT` 顯示——其他狀態的人沒有付款頁可去。
     */
    copyPaymentLink: "複製付款連結",
    paymentLinkCopied: "已複製付款連結",
    /**
     * 名單列的 email 狀態徽章。
     *
     * 文案逐字照抄 Web `public/locales/zh-Hant/event_manage.json` 的
     * `registrations.emailStatus.*`：同一個狀態在兩個端上不能叫兩個名字。
     */
    emailStatus: {
      label: "Email 狀態",
      /** `emailStatus` 缺失或為 `null`＝**不知道**，不是「沒寄」。 */
      unknown: "未知",
      /** 篩選 chip 列的前導標籤（Web `registrations.emailStatus.filterLabel`）。 */
      filterLabel: "Email 狀態篩選",
      /** 篩選值域，逐字照抄 Web `registrations.emailStatus.filters.*`。 */
      filters: {
        all: "全部",
        actionable: "待處理",
        failed: "寄送失敗",
        claimed: "已領取",
      },
      /**
       * 篩選範圍說明。
       *
       * 後端沒有 email 狀態這個查詢維度，Web 與 App 都只能在**已載入**的列上
       * 篩。差別是 App 是無限捲動、`items` 會累積多頁，所以「已載入」不等於
       * 「第一頁」——若不講清楚，操作員會以為「待處理 0」代表整份名單沒問題。
       */
      filterScopeHint: (loaded: number) =>
        `此篩選只作用於已載入的 ${loaded} 筆，未載入的不在此列`,
      states: {
        AWAITING_PAYMENT: "待付款",
        NO_ACCOUNT: "無帳號",
        CLAIMED: "已領取",
        NOT_REQUIRED: "免啟用",
        SEND_FAILED: "寄送失敗",
        SENT_NOT_OPENED: "已寄出未領取",
        NOT_SENT: "未寄出",
      },
    },
    /**
     * 批次寄送 claim email（Web `registrations.batchClaim.*`）。
     *
     * 文案逐字照抄 `public/locales/zh-Hant/event_manage.json`。三段式面板
     * （select → confirm → result）：**只有 confirm 的「確認寄送」會發請求**。
     */
    batchClaim: {
      open: "批次寄送 claim email",
      title: "批次寄送 claim email",
      description:
        "本頁每一筆都會先確認 claim 狀態；預設只勾選「已有帳號、尚未 claim、且沒有有效連結」的報名者。",
      loading: "正在確認 claim 狀態…",
      noEligible:
        "目前沒有「已確認」狀態的報名者，因此無法批次寄送 claim email。",
      recipientCount: (count: number) => `收件人數：${count}`,
      next: "下一步",
      back: "返回",
      confirmTitle: "確認批次寄送",
      confirmBody: (count: number) =>
        `將對 ${count} 筆報名寄送 claim email。寄出後無法撤回，且不會自動重試。`,
      /** 被操作員手動放寬（已 claim／已有 token／無帳號）的筆數。 */
      confirmRelaxed: (count: number) =>
        `其中 ${count} 筆為已 claim、仍持有有效連結、或尚未建立帳號者。`,
      confirmSend: "確認寄送",
      sending: "寄送中…",
      resultTitle: "批次寄送結果",
      resultSummary: (success: number, failed: number) =>
        `成功 ${success} 筆 · 失敗 ${failed} 筆`,
      close: "關閉",
      selectRow: (name: string) => `選取 ${name}`,
      noAccountHint:
        "此報名者尚未建立 LinkCard 帳號。勾選後寄送時會自動建立帳號，再寄出 claim email；若建立失敗會標示為「無法建立帳號」並可重試。",
      reason: {
        pending_claim: "待 claim",
        activated: "已 claim",
        has_token: "已有有效連結",
        no_account: "尚未建立帳號",
      },
      outcome: {
        sent: "已寄出",
        claimed: "此連結已使用",
        forbidden: "無權限寄送 claim email",
        not_found: "此筆報名沒有可寄送的帳號",
        send_failed: "信件寄送失敗",
        failed: "寄送失敗",
        account_missing: "無法建立帳號",
      },
      selectAllSendable: (count: number) => `全選可寄送（${count}）`,
      clearSelection: "清除選取",
    },
    /**
     * 貴賓名單匯入（Web `registrations.registrationImport.*`／
     * `RegistrationImportPanel`）。
     *
     * 文案逐字照抄 `public/locales/zh-Hant/event_manage.json` 的
     * `registrationImport.*`：同一個流程在兩個端上不能叫兩個名字。
     * 四步（template → preview → confirm → notify）與 BE 端點一一對應。
     */
    guestImport: {
      open: "匯入貴賓名單",
      title: "匯入貴賓／VIP 名單",
      subtitle:
        "以 CSV 或 XLSX 批次建立報名（不要求本人填表），並可批次寄出票券信。",
      close: "關閉",
      /** 合規告知（Web 標為「不可移除」）。 */
      complianceNotice:
        "匯入的資料將以「活動營運之正當利益」處理，用於名牌製作、現場報到與活動通知；系統不會為名單自動加入行銷同意，寄出的信件會附上隱私告知。",
      downloadTemplate: "下載模板",
      templateReady: "模板已備妥，請在分享面板選擇要存到哪裡。",
      templateFailed: "模板下載失敗，請稍後再試。",
      acceptedTicketTypes: "本活動可接受的票種",
      ticketTypeColumnHint:
        "ticketType 欄請填左邊的代碼（不是右邊顯示的名稱）。填顯示名稱也可以，但代碼最穩定。",
      chooseFile: "選擇檔案",
      changeFile: (name: string) => `已選：${name}`,
      pickFailed: "無法讀取這個檔案，請改用 CSV 或 XLSX。",
      preview: "預覽（不寫入）",
      previewFailed: "預覽失敗，請確認檔案格式（CSV 或 XLSX，≤500 列）。",
      confirm: (count: number) => `確認匯入 ${count} 筆`,
      confirmFailed: "匯入失敗，請稍後再試。",
      notify: (count: number) => `寄出票券信（${count} 筆）`,
      notifyResult: (sent: number, failed: number) =>
        `已寄出 ${sent} 筆，失敗 ${failed} 筆。`,
      notifyFailed: "寄送失敗，請稍後再試。",
      totalRows: "資料列",
      validRows: "有效",
      invalidRows: "無效",
      duplicates: "已存在",
      created: "已建立",
      skipped: "已跳過",
      failed: "失敗",
      capacityHeading: "名額影響（免費票仍計入名額）",
      capacityLine: (
        ticketType: string,
        adding: number,
        sold: number,
        capacity: number | null,
      ) =>
        `${ticketType}：新增 ${adding}，已售 ${sold}／上限 ${capacity ?? "∞"}`,
      capacityExceeded: "（將超出上限）",
      invalidHeading: "需修正的資料列",
      /** 逐列錯誤：`#3：ticketType 找不到 general`（Web 以 ` / ` 串多條）。 */
      invalidRow: (row: number, messages: string) => `#${row}：${messages}`,
      fixInvalidFirst: "請先修正無效資料列，或在檔案中移除它們。",
      modeLabel: "重複處理方式",
      mode: {
        create: "已存在則跳過",
        upsert: "已存在則只補空白欄位（不改狀態）",
      },
      done: "完成",
      /** 顯示前 N 列（Web `slice(0, 20)`）；其餘以一句話交代還有多少。 */
      invalidMore: (remaining: number) => `另有 ${remaining} 列未列出`,
    },
    viewDetail: "查看詳情",
    sectionProfile: "基本資料",
    sectionRegistration: "報名",
    sectionCheckIn: "簽到",
    sectionToken: "Token 流水",
    sectionNfc: "綁定 NFC",
    sectionOrg: "所屬社團",
    /** 資料品質管理（隱藏／封存）。只在名單快取可用時才有值。 */
    sectionVisibility: "可見性",
    /** 押金退款追蹤（離線退款登記）。只在名單快取可用時才有值。 */
    sectionDeposit: "押金退款",
    /**
     * 帳號啟用／activation link（Web `registrations.detail.*`）。
     *
     * 「查看」與「簽發」是兩個不同的動作，文案也必須分得開：前者純讀，
     * 後者會鑄出一顆可啟用帳號的 token。混成一句話會讓操作員不知道自己按的
     * 是哪一個。
     */
    sectionAccount: "帳號啟用",
    activationView: "查看帳號狀態",
    activationLoading: "讀取中…",
    activationActivated: "已啟用",
    activationPending: "尚未啟用",
    activationNoAccount: "尚未建立帳號",
    activationHint: (name: string) =>
      `${name} 還沒有啟用帳號。把下面這條連結傳給本人，他就能設定密碼並登入。`,
    activationCopy: "複製啟用連結",
    activationCopied: "已複製啟用連結",
    /** 簽發前的最後一道說明：講清楚副作用，而不是只問「確定嗎」。 */
    activationIssue: "簽發新的啟用連結",
    activationIssueWarn:
      "這會產生一條可啟用帳號的連結。任何拿到它的人都能設定該帳號的密碼——請只傳給本人，不要貼在群組或公開頻道。",
    activationIssueConfirm: "確認簽發",
    activationIssueCancel: "取消",
    activationIssuing: "簽發中…",
    activationIssued: "已簽發一條新的啟用連結。",
    activationReused:
      "這個人原本就有一條有效連結，已直接沿用（沒有重複簽發）。",
    activationAlreadyActive: "帳號已啟用，不需要啟用連結。",
    activationNoAccountHint: "尚未建立帳號，無法簽發啟用連結。",
    activationEmpty: "後端沒有回傳連結，請稍後再試。",
    activationErrClaimed: "這條連結已被使用（對方已經啟用帳號）。",
    activationErrForbidden:
      "沒有權限簽發啟用連結。後端要求主辦或協調員權限，請改用那類帳號。",
    activationErrNotFound: "找不到這筆報名。",
    activationErrFailed: "簽發失敗，請稍後再試。",
    hiddenYes: "已隱藏",
    hiddenNo: "未隱藏",
    hiddenReason: "隱藏原因",
    archivedAt: "封存時間",
    archivedReason: "封存原因",
    depositRefundedAt: "退款時間",
    depositRefundedAmount: "退款金額",
    depositRefundedReference: "匯款參考號",
    depositRefundedNote: "備註",
    checkedInBy: "報到人員",
    /**
     * 深連結／冷啟動時的說明。
     *
     * 後端沒有「用 id 取完整詳情」的端點，`by-code` 的 select 也沒有隱藏／
     * 封存／押金退款／email 狀態這幾欄。與其把那些欄位畫成永遠的「—」
     * （看起來像「沒有隱藏」，實際上是「查不到」），不如直說缺什麼、怎麼補。
     */
    detailFallbackHint:
      "這頁是直接開啟的（沒經過名單），後端沒有「用 id 取完整詳情」的端點，因此隱藏／封存／押金退款／email 狀態暫時無法顯示。請從名單點進來即可看到完整資料。",
    nfcEmptyTitle: "查不到綁定卡",
    nfcEmptyHint: "後端還不能用報名編號反查 NFC，這裡顯示 —。",
    orgEmptyTitle: "沒有社團資料",
    orgEmptyHint: "沒有依使用者查社團的接口，這裡顯示 —。",
    tokenEmptyTitle: "沒有流水",
    tokenEmptyHint: "此報名還沒有 Token 交易，或目前帳號讀不到。",
    /** 交易列的餘額標籤。後端一定有 `balanceAfter`，只是 App 先前沒讀（S-2）。 */
    tokenBalanceLabel: "餘額",
    /** 流水被分頁截斷時的說明；`N` 與 `M` 由呼叫端代入。 */
    tokenPagingHint: "只顯示最近一頁。",
    phone: "電話",
    /**
     * 名單列的「管理」入口（對應 Web `registrations/page.tsx` 的
     * `RegistrationActionsMenu`）。Web 把它做成 row 上的「⋯」下拉，App 用
     * 同一套動作但改以 modal 呈现——手機上沒有 hover，下拉選單的 discoverability
     * 比原地彈出的面板差。
     */
    manage: {
      open: "管理這筆報名",
      title: "管理報名",
      hide: "隱藏",
      unhide: "取消隱藏",
      archive: "封存",
      unarchive: "取消封存",
      /** 隱藏／封存要求填原因；後端會把它寫進稽核紀錄 */
      reasonLabel: "原因",
      reasonPlaceholder: "例如：重複報名、測試資料",
      reasonRequired: "請填寫原因，後端會寫入稽核紀錄",
      hideDone: "已隱藏這筆報名",
      unhideDone: "已取消隱藏",
      archiveDone: "已封存這筆報名",
      unarchiveDone: "已取消封存",
      /** 狀態修正（Web `RegistrationActionsMenu` 的最上方項目） */
      markCheckedIn: "標記為已報到",
      undoCheckIn: "撤銷報到",
      markCheckedInDone: "已標記為已報到",
      undoCheckInDone: "已撤銷報到",
      /** 押金退款登記（Web `DepositRefundModal`） */
      refund: "標記押金已退",
      refundDone: "已記錄押金退款",
      refundAmountLabel: "退款金額",
      refundAmountPlaceholder: "例如 500",
      /** 對齊後端 `@Min(0.01)`：金額必須 > 0，否則稽核自相矛盾 */
      refundAmountInvalid: "退款金額需大於 0",
      refundReferenceLabel: "匯款參考號（選填）",
      refundNoteLabel: "備註（選填）",
      /**
       * 重寄確認信（Web `RegistrationDetailDrawer` 的
       * `registrations.detail.resend_confirmation*`）。
       *
       * ⚠️ 完成文案只說「已排入佇列」：後端只把 outbox 意圖重置回 `PENDING`，
       * 真正寄出由 relay cron（每 5 分鐘）接手。寫「已寄出」就是在說謊。
       */
      resendConfirmation: "重寄確認信",
      resendConfirmationQueued: "已排入佇列，確認信會由寄送排程送出",
      resendConfirmationNotApplicable:
        "這筆沒有可用的已驗證帳號，確認信不適用（應改用領取信）",
      resendConfirmationNotConfirmed: "這筆報名尚未確認，沒有確認信可重寄",
      /** 匯出報名名單（Web `exportAttendeesCsv`）。App 沒有檔案系統，走分享／剪貼簿。 */
      exportAction: "匯出",
      exportOpen: "匯出報名名單",
      exporting: "匯出中…",
      exportShareOpened: "已開啟分享，請選擇存檔或傳送",
      exportCopied: "無法開啟分享，CSV 已複製到剪貼簿",
      /** 後端只匯出 CONFIRMED；沒有資料時只有表頭，不該誤報「已匯出」 */
      exportEmpty: "沒有可匯出的報名（後端只匯出已確認者）",
      exportFailed: "匯出失敗，請稍後再試",
      undo: "復原",
      /** 復原時寫入稽核的原因（使用者看不到，屬於操作軌跡） */
      undoReason: "復原上一次隱藏或封存操作",
      undoDone: "已復原",
      failed: "操作失敗，請稍後再試",
      forbidden: "需要主辦或協調員權限才能修改名單",
      cancel: "取消",
      confirm: "確定",
      processing: "處理中…",
    },
    statusLabels: {
      PENDING_PAYMENT: "待付款",
      CONFIRMED: "已確認",
      CANCELLED: "已取消",
      CHECKED_IN: "已報到",
      NO_SHOW: "未到",
      REFUNDED: "已退款",
      ARCHIVED: "已封存",
    },
  },
  nfc: {
    writeTitle: "NFC 寫卡",
    bindSuccess: "NFC 綁定成功",
    bindFailed: "NFC 綁定失敗",
    iosWriteNotSupported: "iOS 不支援寫入，請改用 Android 裝置",
    /** ↓ 以下為既有 namespace 之擴充（A6）：原為 `nfc-bind.tsx` 硬編中文 */
    badgeTypeWristband: "手環",
    badgeTypeCard: "卡片",
    badgeTypeQr: "QR",
    stepLookupHint: "① 輸入報名編號以查詢參加者",
    stepChooseTypeHint: "② 選擇 Badge 類型，然後將空白 NFC 卡靠近手機背面",
    startWrite: "開始寫入 NFC 卡",
    retype: "重新輸入",
    writing: "寫入中，請保持卡片靠近…",
    binding: "綁定中，請稍候…",
    continueNext: "繼續下一張",
    webNotSupported: "此瀏覽器不支援 NFC，請改用 Android 真機寫卡",
    invalidTagUid: "讀到的卡片編號無效，請換一張卡或重新感應",
    duplicateBind: "這張卡已經綁定過，請換一張空白卡",
    boundOther: "此報名已綁定其他卡片。換卡需等後端就緒，目前無法自動作廢舊卡",
    writeFailed: "寫卡失敗。卡片內容可能沒有更新，請靠近後重試，勿當成成功",
    uriMismatch: "寫入後讀回的網址與預期不符，已中止綁定。請重試，勿當成成功",
    bindFailedAfterWrite:
      "卡片已寫入網址，但後端尚未綁定。請重試綁定；成功前不要發放這張卡",
    retryWrite: "重試寫卡",
    retryBind: "重試綁定",
    /** CRA-V1-009：寫卡逾時（預設 20s）後的處置文案，不得講成成功 */
    writeTimeout:
      "寫卡逾時，已停止等待。卡片可能沒有寫入，請重新靠近再試，勿當成成功",
    /** 寫入中的取消控制（CRA-V1-009） */
    cancelWrite: "取消寫卡",
    /** 使用者主動取消時的狀態文案（正常路徑會直接回確認畫面） */
    writeCancelled: "已取消寫卡",
    payloadPreview: "將寫入",
    /**
     * `INC-3`（Loop AF）：解析器 URL 預覽的說明——`{tagUid}` 要感應當下才讀得到，
     * 確認畫面只能顯示模板（舊版顯示 `profileUrl`，屬寫死 `/p/{slug}` 的模型）。
     */
    payloadTagUidHint: "卡片編號於感應寫入時決定（先讀 UID 再組解析器網址）",
    writtenUid: "卡片編號",
    /**
     * 上鎖結果的三態（詞彙照 Web `DeskLockNote`：`locked`／`unlocked`／
     * `lock_failed`）。三句都必須讓操作員知道「這張卡現在能不能發」——
     * `lock_failed` 尤其不能寫成「失敗」，內容已經在卡上了。
     */
    lockLocked: "卡片已上鎖：日後要有密碼才能改寫它",
    lockUnlocked:
      "未上鎖（這次沒有取得密碼）：任何能感應這張卡的裝置都能覆寫它",
    lockFailedTitle: "卡片已寫好，但沒有上鎖",
    lockFailedConsequence:
      "內容正確、可以發放；但這張卡仍可被任何讀卡機覆寫，請勿當成已保護的卡",
    replaceTitle: "換卡 / 補發 / 退卡",
    replaceBlocked: "等待後端 WP-N2。作廢舊卡的端點尚未就緒，這些操作暫不可用",
    replaceCard: "換卡",
    reissueCard: "補發",
    returnCard: "退卡",
    readTitle: "讀取 tagUid",
    readHint: "將 NFC 卡靠近手機背面，讀取卡片硬體編號",
    startRead: "開始讀取",
    reading: "讀取中，請保持卡片靠近…",
    readAgain: "再讀一張",
    readSuccess: "讀取成功",
    readFailed: "讀取失敗，請靠近後重試",
    tagUidLabel: "tagUid",
    copyTagUid: "複製 tagUid",
    tagUidCopied: "已複製",
    webReadNotSupported: "此瀏覽器不支援 NFC，請改用 Android 真機讀卡",
    iosReadHint: "請使用支援 NFC 的裝置靠近讀取",
  },
  /**
   * 交換名片（Loop AB · WP-20，`93-plan-desk-nfc-pack.md` §2.3）。
   *
   * 消費端：`app/(auth)/[eventId]/nfc-exchange.tsx` 與 `utils/nfc-exchange.ts` 的分類器。
   * 每一則失敗文案都必須是**可執行的現場指示**（AC-20-6／AC-20-7：不得只顯示原始錯誤），
   * 且不得把「已交換過」的冪等態講成失敗。
   */
  exchange: {
    title: "交換名片",
    subtitle: "兩張卡各感應一次，記錄雙方的聯絡交換",
    stepReadInitiator: "① 感應第一張卡",
    stepReadReceiver: "② 感應對方的卡",
    introHint: "先感應第一張卡，畫面上出現姓名後，再感應對方的卡。",
    waitingSecond: "請感應對方的卡片",
    reading: "讀取中，請保持卡片靠近…",
    submitting: "寫入交換紀錄中，請稍候…",
    firstCardLabel: "第一張卡",
    secondCardLabel: "第二張卡",
    successTitle: "已交換",
    alreadyTitle: "已交換過",
    successHint: "雙方聯絡資訊已記錄，會出現在彼此的聯絡人。",
    alreadyHint: "這兩張卡先前已交換過，未重複寫入。",
    exchangeAgain: "再交換一次",
    retry: "重試",
    cancel: "取消",
    /** 自換：前端先擋（AC-20-5），不消耗第一張卡的狀態 */
    sameCard: "這是同一張卡，請感應另一張卡",
    /** 讀卡階段的公開 lookup 回 404：這張卡還沒寫入任何人的資料 */
    cardNotBound: "這張卡還沒寫入資料，請先完成報到寫卡",
    initiatorNotBound: "第一張卡尚未綁定資料，請先完成寫卡",
    receiverNotBound: "對方的卡尚未寫入資料，請先完成寫卡",
    deactivated: "這張卡已停用，請改用其他卡片",
    invalidUid: "讀到的卡片編號無效，請換一張卡或重新感應",
    identifierMissing: "沒有讀到卡片編號，請重新感應",
    rejected: "後端不接受這次交換（資料格式不符），請洽現場工程人員",
    unauthorized: "沒有操作權限，請重新登入後再試",
    network: "連線中斷，請確認網路後重試",
    server: "伺服器暫時無法處理，請稍後重試",
    readFailed: "讀取失敗，請靠近後重試",
    webNotSupported: "此瀏覽器不支援 NFC，請改用 Android 真機感應",
    /** AC-20-7：原生讀不到 UID 時不得顯示技術錯誤，只給可行動的替代路徑 */
    iosReadUnavailable: "此裝置無法讀取卡片，請改用其他裝置",
  },
  settings: {
    title: "設定",
    logout: "登出",
    accountSection: "帳號",
    deviceSection: "裝置",
    displayNameLabel: "顯示名稱",
    emailLabel: "電子郵件",
    usernameLabel: "使用者名稱",
    appVersion: "App 版本",
    nfcStatus: "NFC 狀態",
    nfcSupported: "支援",
    nfcNotSupported: "不支援",
    nfcChecking: "偵測中…",
    accountUnavailable: "無法取得帳號資料，請稍後再試或重新登入",
    backToEvents: "返回活動列表",
  },
  /**
   * 活動資料（`app/(auth)/[eventId]/profile.tsx`）。
   *
   * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/profile/page.tsx`。
   * 可編輯欄位**九個**，與 Web 的 `FormState` 一一對應，不多不少：
   * `name / description / eventType / status / venueName / venueAddress /
   * isPublic / landingPageMode / externalLandingUrl`。
   *
   * ⚠️ Web 這頁**沒有**開始／結束時間欄位（`Event.startDate/endDate` 只在
   * 「建立活動」時寫一次）。App 也不加——加了就是承諾一個 Web 沒有的功能。
   *
   * 狀態標籤不放在這裡：走 `src/utils/event-status.ts` 的單一映射，
   * 否則同一狀態會有兩份中文。
   */
  profile: {
    title: "活動資料",
    subtitle: "修改活動的名稱、地點與狀態",
    loading: "讀取中…",
    loadFailed: "讀取活動資料失敗，請稍後再試",
    slugLabel: "Slug",
    slugReadOnly: "建立後不可修改",
    nameLabel: "活動名稱",
    descriptionLabel: "活動說明",
    descriptionPlaceholder: "一段話說明這場活動",
    eventTypeLabel: "活動類型",
    statusLabel: "活動狀態",
    venueNameLabel: "場地名稱",
    venueNamePlaceholder: "例如：香港會議展覽中心",
    venueAddressLabel: "場地地址",
    venueAddressPlaceholder: "例如：香港灣仔博覽道 1 號",
    landingModeLabel: "落地頁模式",
    externalUrlLabel: "外部落地頁網址",
    externalUrlPlaceholder: "https://...",
    isPublicLabel: "公開活動（會出現在公開活動列表）",
    save: "儲存",
    saving: "儲存中…",
    saved: "已儲存",
    saveFailed: "儲存失敗，請稍後再試",
    /**
     * 驗證訊息。前兩條刻意與後端 `UpdateEventDto` 的中文訊息**一字不差**
     * ——使用者在 Web 上看到的就是這句，App 不該換句話說。
     */
    nameRequired: "請輸入活動名稱",
    nameTooLong: "活動名稱不能超過 120 個字符",
    descriptionTooLong: "活動說明不能超過 500 個字",
    externalUrlInvalid: "請輸入完整網址（含 https://）",
    /** 活動類型（Prisma `enum EventType`） */
    eventType: {
      EXHIBITION: "展覽",
      CONFERENCE: "會議",
      WORKSHOP_SERIES: "系列工作坊",
      MEETUP: "聚會",
      OTHER: "其他",
    },
    /** 落地頁模式（Prisma `enum EventLandingPageMode`） */
    landingMode: {
      BUILT_IN: "站內落地頁",
      EXTERNAL: "外部連結",
      NONE: "不使用落地頁",
    },
  },
  /**
   * 建立活動（`app/(auth)/new-event.tsx`）。
   *
   * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/events/page.tsx`
   * 的 `CreateEventModal`（`:44`）＋ `public/locales/zh-Hant/event_manage.json`
   * 的 `events` 命名空間。文字逐條沿用 Web 的 zh-Hant 用語——同一個功能在
   * 兩邊不該叫不同名字。
   *
   * `errors` 九條與 Web 的 `events.errors` **一字不差**。其中 `slugConflict`
   * 與 `createFailed` 是**伺服器**回的錯（409／其他），不是前端驗證；
   * 但使用者在 Web 上看到的就是這兩句，所以照抄。
   */
  createEvent: {
    title: "建立新活動",
    subtitle: "填好基本資料，建立後可到活動資料頁繼續調整",
    nameLabel: "活動名稱",
    slugLabel: "Slug（URL 識別符）",
    slugPrefix: "events/",
    slugHint: "只能使用小寫英文、數字與連字號；建立後不可修改",
    startDateLabel: "開始日期",
    endDateLabel: "結束日期",
    /**
     * App 沒有 date picker（`@react-native-community/datetimepicker` 不在
     * `package.json`），所以時間是文字輸入；Web 靠 `datetime-local` 的原生
     * 控件，沒有也不需要格式提示。這一行是 App 專屬。
     */
    dateHint: "格式：2026-11-01 09:00",
    eventTypeLabel: "活動類型",
    timezoneLabel: "時區",
    descriptionLabel: "活動簡介（可選）",
    descriptionPlaceholder: "描述這個活動...",
    create: "建立活動",
    creating: "建立中...",
    cancel: "取消",
    errors: {
      nameMin: "活動名稱至少 2 個字符",
      nameMax: "活動名稱不超過 120 個字符",
      slugRequired: "Slug 為必填",
      slugFormat: "Slug 只能包含小寫英文、數字和連字號",
      startDateRequired: "開始日期為必填",
      endDateRequired: "結束日期為必填",
      endDateBeforeStart: "結束日期不能早於開始日期",
      slugConflict: "此 Slug 已被使用，請換一個",
      createFailed: "建立失敗，請稍後重試",
      /**
       * App 專屬，Web 沒有這一句（也不需要）：Web 用
       * `<input type="datetime-local">`，瀏覽器保證值合法；App 是文字輸入，
       * 使用者可能打成 `2026-13-45`。這種值後端 `@IsDateString()` 必定 400，
       * 所以提前擋下來不是「App 比較嚴」。文案與 `createEvent.dateHint`
       * 的格式一致，讓使用者知道要改成什麼樣子。
       */
      dateFormat: "時間格式不正確，請用 2026-11-01 09:00 這種格式",
    },
  },
  /**
   * 落地頁內容（`app/(auth)/[eventId]/content.tsx`）。
   *
   * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/content/page.tsx`
   * ＋ `public/locales/zh-Hant/event_manage.json` 的 `content` 命名空間。
   * **文字逐條沿用 Web 的 zh-Hant 用語**（「公開頁面內容」「新增區塊」「新卡片」），
   * 同一個功能在兩邊不該叫不同名字。
   *
   * 兩條是 App 專屬（Web 沒有對應字串）：
   * - `untitledSection`：區塊標題在後端允許 null。Web 那邊就是一個空 input，
   *   唯讀列沒有「空 input」可以表達，只能給一句佔位文字。
   * - `columns(n)`：Web 走 i18next 的 `{{count}} 欄` 插值，這裡改成函式，
   *   免得把一個只有兩處在用的樣板語言搬進 App。
   *
   * ⚠️ `empty` 與 `loadError` 逐字照 Web；`empty` 提到的「新增區塊」按鈕在本
   * 分支的後續 commit 才落地（先唯讀、再新增），文案不因此改寫——改了就不是
   * Web 的那句話了。
   */
  content: {
    title: "公開頁面內容",
    subtitle: "活動公開頁上的區塊與卡片",
    loading: "讀取中…",
    loadError: "載入頁面內容失敗",
    empty: "還沒有頁面內容，點擊「新增區塊」開始建立",
    untitledSection: "（未命名區塊）",
    columns: (count: number) => `${count} 欄`,
    published: "已發布",
    draft: "草稿",
    newSection: "新區塊",
    addSection: "新增區塊",
    maxReached: "（已達上限）",
    sectionTitle: "區塊標題",
    sectionDescription: "區塊說明（可選）",
    /** Web 沒有這個標籤（它是個無 label 的 `<select>`）；App 的晶片列需要一個。 */
    columnsLabel: "欄數",
    edit: "編輯",
    save: "儲存",
    saving: "儲存中…",
    cancel: "取消",
    delete: "刪除",
    deleteSectionConfirm: "確定刪除此區塊？所有卡片也會被刪除。",
    newCard: "新卡片",
    addCard: "+ 新增卡片",
    cardTitle: "標題",
    cardDescription: "說明",
    buttonLabel: "按鈕文字",
    buttonUrl: "按鈕連結",
    deleteCardConfirm: "確定刪除此卡片？",
    addFailed: "新增失敗，請稍後再試",
    saveFailed: "儲存失敗，請稍後再試",
    deleteFailed: "刪除失敗，請稍後再試",
  },
  /**
   * 活動設定（`app/(auth)/[eventId]/settings.tsx`）。
   *
   * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/settings/page.tsx`
   * ＋ `public/locales/zh-Hant/event_manage.json` 的 `settings` 命名空間。
   * **文字刻意沿用 Web 的 zh-Hant 用語**（「銀行轉賬資料」「收款人名稱」
   * 「付款指示（中文）」），同一個功能在兩邊不該叫不同名字。
   *
   * ⚠️ 這裡是**活動**設定，與上面 `copy.settings`（登入者帳號與 App 偏好）
   * 是兩件不同的事，只是中文都叫「設定」。不要合併。
   */
  eventSettings: {
    title: "活動設定",
    subtitle: "銀行轉賬資料與品牌主題",
    loading: "讀取中…",
    loadFailed: "讀取活動設定失敗，請稍後再試",
    save: "儲存",
    saving: "儲存中…",
    basicInfoTitle: "基本資訊",
    eventIdLabel: "活動 ID",
    slugHint: "Slug 是活動的唯一 URL 識別符，如需修改請聯繫系統管理員。",
    bankTitle: "銀行轉賬資料",
    bankHint: "公開報名確認頁與付款截圖上傳頁會讀取這組資料。",
    bankAccountName: "收款人名稱",
    bankName: "銀行名稱",
    bankAccountNumber: "銀行帳號",
    bankAccountNumberHint: "預設隱藏，點右側眼睛可顯示",
    bankInstructionsZh: "付款指示（中文）",
    bankInstructionsEn: "付款指示（英文）",
    bankSaveSuccess: "銀行轉賬資料已更新。",
    bankSaveFailed: "更新失敗，請稍後重試。",
    /** 品牌主題（Web `settings.themeTitle` 等，用語沿用） */
    themeTitle: "品牌主題設定",
    themeHint: "設定活動的品牌顏色，用於報名頁面及付款頁面的主要按鈕。",
    primaryColorLabel: "主色 (Primary Color)",
    /**
     * 照抄 Web 的 `settings.primaryColorHint`：它解釋「票種表單外觀會蓋過這裡」
     * 的優先序。少了這段，改顏色沒生效就會被當成 bug 回報（Web 的 QA EV-05）。
     */
    primaryColorHint:
      "這裡是預設值。若某個票種在「票種設定 → 表單外觀」選了配色，該票種的報名頁會以票種的設定為準，不會跟這裡的主色。",
    hoverColorLabel: "Hover 色 (Hover Color)",
    darkModeLabel: "暗色模式",
    darkModeOff: "關閉",
    darkModeOn: "開啟",
    colorPreviewLabel: "預覽色塊",
    /** 色碼不是 #RRGGBB 時，色塊無法預覽；只提示、不阻止儲存（Web 也不擋）。 */
    colorPreviewUnavailable: "格式不是 #RRGGBB，無法預覽",
    themeSaveSuccess: "品牌主題已更新。",
    themeSaveFailed: "更新失敗，請稍後重試。",
  },
  /**
   * 參展廠商管理（`app/(auth)/[eventId]/exhibitors.tsx`）。
   *
   * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/exhibitors/page.tsx`
   * ＋ `public/locales/zh-Hant/event_manage.json` 的 `exhibitors` /
   * `exhibitorStatus` 命名空間。**文字逐條沿用 Web 的 zh-Hant 用語**
   * （「展商管理」「批准」「停用」「恢復」「攤位 {{number}}」），同一個功能在
   * 兩邊不該叫不同名字。
   *
   * 三條是 App 專屬，Web 沒有對應字串：
   * - `loading`／`loadError`：Web 的 `load()` 把錯誤吞掉（空 catch），失敗時
   *   畫面收成空清單，跟「真的沒有廠商」一模一樣。
   * - `subtitle`：Web 標題下沒有副標。
   *
   * ⚠️ Web 的 `exhibitors.total`（「共 {{count}} 家」）在這裡變成
   * `totalCount` 函式；`exhibitors.emptyFiltered`（「此狀態下無展商」）變成
   * `emptyForStatus`。兩者語意相同，只是 i18next 的 `{{count}}` 語法在 App
   * 是函式。
   */
  exhibitors: {
    /** Web `exhibitors.title` */
    title: "展商管理",
    subtitle: "審核報名、管理參展廠商名單",
    loading: "讀取中…",
    loadError: "載入參展廠商失敗，請稍後再試",
    /** Web `exhibitors.all` */
    all: "全部",
    /** Web `exhibitorStatus.*` */
    status: {
      PENDING_APPROVAL: "待審批",
      ACTIVE: "已啟用",
      SUSPENDED: "已停用",
      COMPLETED: "已完成",
    },
    /** Web `exhibitors.total`（`{{count}}` → 函式） */
    totalCount: (count: number) => `共 ${count} 家`,
    /** Web `exhibitors.empty` */
    empty: "尚無展商",
    /** Web `exhibitors.emptyFiltered` */
    emptyForStatus: "此狀態下無展商",
    /** Web `exhibitors.booth`（`{{number}}` → 函式） */
    booth: (number: string) => `攤位 ${number}`,
    /** Web `exhibitors.approve` / `exhibitors.suspend` / `exhibitors.restore` */
    approve: "批准",
    suspend: "停用",
    restore: "恢復",
    /**
     * 三個動作的成功回饋（App 專屬）。
     *
     * Web 的 `handleStatusChange` **沒有任何回饋**：按下去、重新載入、徽章變色，
     * 沒有別的了。在手機上那個徽章常常在螢幕外（清單很長），按了沒反應會讓人
     * 重按——而重按在 `PENDING_APPROVAL → ACTIVE` 這條上是安全的，在
     * `ACTIVE → SUSPENDED` 這條上就是真的把人家停兩次。所以補一條橫幅。
     * 這與 `polls` 頁的 `createSuccess` 等字串同一個理由（見該區塊註解）。
     *
     * ⚠️ 用**動作**當鍵，不是用目標狀態：`approve` 與 `restore` 的目標狀態
     * 都是 `ACTIVE`，用狀態當鍵會讓兩句文案撞在一起。
     */
    reviewSuccess: {
      approve: "已批准，廠商狀態改為「已啟用」",
      suspend: "已停用",
      restore: "已恢復為「已啟用」",
    },
    /** Web `exhibitors` 命名空間沒有錯誤字串；與 `polls.actionError` 同語。 */
    actionError: "操作失敗，請重試",
    /**
     * 匯入名單（`components/roster/ExhibitorImportModal.tsx`）。
     *
     * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/exhibitors/import/page.tsx`
     * ＋ zh-Hant `event_manage.json` 的 `exhibitors.import.*`。**文字逐條沿用
     * Web**——同一個匯入流程在兩邊叫同一件事，操作員換裝置不用重學。
     *
     * 四步與後端四個端點一一對應（模板／預覽／確認／通知）。App 把它做成
     * 面板（`Modal`）而不是獨立頁面：Web 的獨立頁是為了深連結（列表頁有一個
     * 「匯入名單」入口帶過來），手機上一個面板就夠，而且不會讓「匯入到一半
     * 按返回」變成一個沒有答案的問題。
     */
    import: {
      /** Web `exhibitors.import.entry` */
      entry: "匯入名單",
      /** Web `exhibitors.import.title` */
      title: "匯入參展商名單",
      /** Web `exhibitors.import.subtitle` */
      subtitle:
        "上傳 CSV 或 XLSX 名單，先預覽驗證結果（不寫入資料），再確認建立展商與 owner 邀請。",
      /** Web `exhibitors.import.backToList` */
      close: "返回展商管理",
      step1: {
        /** Web `exhibitors.import.step1.title` */
        title: "① 上傳名單檔案",
        /** Web `exhibitors.import.step1.description` */
        description:
          "支援 CSV 與 XLSX（僅第一張工作表、首列為表頭）；上限 5MB、500 列資料。",
        /** Web `exhibitors.import.step1.downloadTemplate` */
        downloadTemplate: "下載 CSV 模板",
        downloadingTemplate: "下載中…",
        /** Web `exhibitors.import.step1.templateHint` */
        templateHint:
          "XLSX 使用者請依相同欄序自建：companyName, email, slug, website, phone, description, boothNumber, boothLocation, exhibitorType",
        /** Web `exhibitors.import.step1.chooseFile` */
        chooseFile: "選擇檔案",
        changeFile: (name: string) => `已選擇：${name}`,
        /** Web `exhibitors.import.step1.noFile` */
        noFile: "尚未選擇檔案",
        /** Web `exhibitors.import.step1.preview` / `previewing` */
        preview: "上傳並預覽",
        previewing: "解析中…",
        /**
         * 模板下載完成（App 專屬）。
         *
         * Web 是 `<a download>`，按下去就進下載資料夾。App 沒有那個語意，
         * 只能把 CSV 文字交給系統分享面板——所以要說一句「拿到了，只是沒存到
         * 資料夾」，否則使用者會以為按鈕壞了。
         */
        templateReady: "模板已備妥，請在分享面板選擇儲存位置",
        templateFailed: "取得模板失敗，請稍後重試",
        /** 選檔器拋錯（權限、來源已被回收）。取消不算錯，不會走到這裡。 */
        pickFailed: "無法讀取這個檔案，請換一個再試",
      },
      step2: {
        /** Web `exhibitors.import.step2.title` */
        title: "② 預覽驗證結果（尚未寫入任何資料）",
        /** Web `exhibitors.import.step2.summary*` */
        summaryTotal: "總列數",
        summaryValid: "可匯入",
        summaryInvalid: "有錯誤",
        summaryDuplicate: "重複",
        /** Web `exhibitors.import.step2.validTitle` */
        validTitle: "可匯入列",
        /** Web `exhibitors.import.step2.invalidTitle` / `duplicatesTitle` */
        invalidTitle: "錯誤列",
        duplicatesTitle: "重複列",
        /**
         * Web `exhibitors.import.step2.downloadErrors`（原字為「下載錯誤報表」）。
         *
         * App 改成「分享」：手機沒有「下載到資料夾」這個語意，實際發生的事是把
         * CSV 交給系統分享面板（存到檔案、寄給自己、丟雲端硬碟）。
         * **不改字的話，按鈕會承諾一件不會發生的事。**
         */
        downloadErrors: "分享錯誤報表（CSV）",
        errorReportReady: "錯誤報表已備妥，請在分享面板選擇用途",
        errorReportFailed: "產生錯誤報表失敗，請稍後重試",
        /** Web `exhibitors.import.step2.showingFirst` */
        showingFirst: (count: number) => `僅顯示前 ${count} 列`,
        /** Web `exhibitors.import.step2.noValid` */
        noValid: "沒有可匯入的列，請修正錯誤後重新上傳。",
        /** Web `exhibitors.import.step2.back` */
        back: "重新選擇檔案",
        previewFailed: "預覽失敗，請稍後重試",
        /** Web `exhibitors.import.step2.confirm` / `confirming` */
        confirm: "確認匯入",
        confirming: "匯入中…",
        /**
         * 有無效列時「確認匯入」是停用的，這一句說明**為什麼**（App 專屬）。
         *
         * Web 不禁用（它只看 `summary.valid === 0`），所以沒有這條字串；
         * 一顆停用卻不解釋的按鈕，在手機上跟壞掉沒有兩樣。
         */
        blockingHint: (count: number) =>
          `有 ${count} 列錯誤，修正後重新上傳才能匯入`,
      },
      step3: {
        /** Web `exhibitors.import.step3.title` */
        title: "③ 匯入結果",
        /** Web `exhibitors.import.step3.created` / `skipped` / `failed` */
        created: "已建立",
        skipped: "已跳過",
        failed: "失敗",
        /** Web `exhibitors.import.step3.createdTitle` / `skippedTitle` / `failedTitle` */
        createdTitle: "已建立展商",
        skippedTitle: "已跳過列",
        failedTitle: "失敗列",
        /** Web `exhibitors.import.step3.notify` / `notifyHint` / `done` */
        notify: "寄送邀請信",
        notifyHint: (count: number) =>
          `將對 ${count} 位 owner 分批寄送邀請信（每批最多 100 封）。`,
        done: "完成",
        /** 確認匯入失敗（Web 沒有對應字串，它用 `errors.UNKNOWN`）。 */
        confirmFailed: "匯入失敗，請稍後重試",
      },
      step4: {
        /** Web `exhibitors.import.step4.*` */
        title: "④ 寄送邀請信",
        progress: (sent: number, total: number) => `已寄送 ${sent} / ${total}`,
        sending: "寄送中…",
        complete: "寄送完成",
        failedCount: (count: number) => `${count} 筆寄送失敗`,
        retryFailed: "重試失敗項",
        done: "完成",
        notifyFailed: "寄送邀請信失敗，請稍後重試",
      },
      /**
       * 後端錯誤碼 → 中文說明。逐條照抄 Web 的
       * `exhibitors.import.errors.*`（zh-Hant `event_manage.json`）。
       *
       * ⚠️ 這張表**不是**翻譯層，是**介面契約**：後端改一個 code，這裡就會
       * 落到 `UNKNOWN`，而 `UNKNOWN` 看起來永遠像「網路有問題」。新增後端錯誤
       * 碼時要一起補這裡（`tests/exhibitor-import.test.mjs` 會列出所有已知碼）。
       */
      errors: {
        NO_FILE: "請先選擇檔案。",
        EMPTY_FILE: "檔案是空的，請確認內容後重試。",
        TOO_MANY_ROWS: "資料列超過 500 列上限，請拆分後分批匯入。",
        CSV_PARSE_ERROR: "CSV 解析失敗，請確認編碼為 UTF-8 且格式正確。",
        XLSX_PARSE_ERROR: "XLSX 解析失敗，請確認檔案未損壞且無密碼保護。",
        XLS_LEGACY_UNSUPPORTED:
          "不支援舊版 .xls，請於 Excel「另存新檔 → .xlsx」後重新上傳。",
        INVALID_FILE_TYPE: "不支援的檔案類型，請上傳 .csv 或 .xlsx。",
        FILE_TOO_LARGE: "檔案超過 5MB 上限。",
        FORBIDDEN: "你沒有權限匯入此活動的展商名單。",
        EVENT_NOT_FOUND: "找不到活動。",
        UNKNOWN: "操作失敗，請稍後重試。",
      },
    },
    /**
     * 被單頁上限截斷時的說明（App 專屬）。
     *
     * Web 沒有這條字串，因為它連 `limit` 都沒送——它**永遠**只顯示 20 筆，
     * 而且從不說明。App 送滿 100 筆，超過時必須說出來：一個不講話的截斷，
     * 會讓操作員以為名單只有這些。
     */
    truncated: "部分狀態超過 100 筆，下方只顯示前 100 筆",
  },
  /**
   * 投票（`app/(auth)/[eventId]/polls.tsx`）。
   *
   * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx`
   * ＋ `public/locales/zh-Hant/event_manage.json` 的 `polls` 命名空間。
   * **文字逐條沿用 Web 的 zh-Hant 用語**（「投票管理」「進行中」「已關閉」
   * 「尚未建立任何投票」），同一個功能在兩邊不該叫不同名字。
   *
   * 三條是 App 專屬，Web 沒有對應字串：
   * - `loading`／`loadError`：Web 的 `loadPolls` 是 `catch { setPolls([]) }`，
   *   失敗時畫面就是一個空清單，沒有訊息。App 多一條橫幅（見畫面檔頭）。
   * - `subtitle`：Web 用 `ScreenHeader` 等價物，標題下沒有副標。
   *
   * ⚠️ Web 的 `polls.results_unavailable`（「暫時無法載入投票統計」）**刻意不移植**：
   * 那一頁從頭到尾沒有呼叫結果端點（計票是在 client 端數 `votes[]`），
   * 這條字串在 Web 已經沒有任何使用者。抄過來只會是一條永遠不會亮的分支。
   */
  polls: {
    title: "投票管理",
    subtitle: "活動現場的即時投票",
    loading: "讀取中…",
    loadError: "載入投票列表失敗，請稍後再試",
    /** Web `polls.create_heading` */
    createHeading: "建立投票",
    /** Web `polls.question_label` / `polls.options_label` */
    questionLabel: "問題",
    optionsLabel: "選項",
    /** Web `polls.add_option` */
    addOption: "+ 新增選項",
    /** Web `polls.create_button` */
    createButton: "建立",
    /** Web `polls.option_placeholder`（i18next `{{number}}` → 函式） */
    optionPlaceholder: (number: number) => `選項 ${number}`,
    /** Web `polls.create_success` */
    createSuccess: "投票已建立",
    /** Web `polls.action_error` */
    actionError: "操作失敗，請重試",
    /**
     * 移除選項鈕的讀屏標籤。
     *
     * Web 這一顆是 `aria-label="Remove option"`——**硬寫的英文，沒有進 i18n**。
     * App 補上中文，並在這裡註記它是 Web 沒有的字串（不是漏抄）。
     */
    removeOption: "移除選項",
    /** Web `polls.activate` / `polls.activate_success` */
    activate: "啟動",
    activateSuccess: "投票已啟動",
    /** Web `polls.close` / `polls.close_success` */
    close: "關閉",
    closeSuccess: "投票已關閉",
    /** Web `polls.list_heading` */
    listHeading: "投票列表",
    /** Web `polls.status_active` / `polls.status_closed` */
    statusActive: "進行中",
    statusClosed: "已關閉",
    /** Web `polls.results_heading` */
    resultsHeading: "投票統計",
    /** Web `polls.total_votes`（i18next `{{count}}` → 函式） */
    totalVotes: (count: number) => `共 ${count} 票`,
    /** Web `polls.option_votes`（`{{count}}` / `{{percent}}` → 函式） */
    optionVotes: (count: number, percent: number) =>
      `${count} 票 · ${percent}%`,
    /** Web `polls.empty` */
    empty: "尚未建立任何投票",
  },
  /**
   * 活動社交排行榜（`app/(auth)/[eventId]/leaderboard.tsx`）。
   *
   * 設計來源：`docs/analysis/nfc-tap-attribution/20261107_Leaderboard_Design.md`
   * §10.3。**Web 沒有管理端排行榜頁**（已凍結決策「Expo Admin 為主」），所以
   * 這裡每一條都是「Web 無對應 key，不是漏抄」——沿用同一份文件的 `polls` 區塊
   * 與 `removeOption` 的註記慣例。
   *
   * ## 兩條硬禁令（設計 §10.1）
   *
   * 1. **不得出現「被 N 人拍過」**。「拍」是訪客的動作，寫成當事人的成就就是
   *    語意錯置；而且它把 `tap` 這個內部機制名詞暴露給使用者。對外一律用
   *    `visitorDefinition(n)` 的那句話。
   * 2. **不得出現「影響力」「人氣」「打敗」「後段班」「作弊」**（`riskBannerHint`
   *    的「不代表作弊」是唯一例外，那是**否認句**）。
   *
   * ## 兩處刻意的偏離（不是抄錯）
   *
   * - `belowThresholdHint` 與 `emptyBelowThreshold` 在文件裡把門檻寫死成「5 位」；
   *   這裡改成吃參數。`minUniqueVisitors` 是查詢參數（可 1–50），後端也會在
   *   `methodology.threshold.applied` 回報實際值——寫死 5 會在門檻被調整時說謊。
   * - `sampleAsteriskNote` 是 App 專屬：`*` 這個符號本身不解釋就沒有意義。
   */
  leaderboard: {
    title: "排行榜",
    subtitle: "依活動期間的名片瀏覽人次排序",
    loading: "讀取中…",
    loadError: "載入排行榜失敗，請稍後再試",
    /** S5：403（非 owner 且非 SUPER_ADMIN／COORDINATOR）。**不給重試**。 */
    forbidden: "你沒有權限查看此活動的排行榜",
    retry: "重試",
    /** 主指標（`unique_visitors`） */
    metricLabel: "看過名片的人次",
    /** 次指標（`leads_captured`） */
    secondaryMetricLabel: "已收集聯絡資料",
    /**
     * 主指標的白話定義（派發硬約束指定的措辭）。
     *
     * 每一個數字都要能被這句話解釋：`N` 是**不同訪客**、且**同日同裝置算一位**。
     * 少了「同日同裝置算一位」，主辦方會把它當成「開啟次數」去跟別的平台比。
     */
    visitorDefinition: (count: number) =>
      `${count} 位不同訪客開啟過名片（同日同裝置算一位）`,
    columnRank: "名次",
    columnName: "姓名",
    columnVisitors: "訪客",
    columnLeads: "聯絡",
    /** `rank === null` 的唯一顯示值（U+2014 em dash，不是 hyphen）。 */
    rankPlaceholder: "—",
    rankLabel: (rank: number) => `第 ${rank} 名`,
    /** 並列時讀屏要唸「並列第 N 名」，否則同一個數字會被誤讀成不同名次。 */
    tiedLabel: (rank: number) => `並列第 ${rank} 名`,
    /** 並列時「同分」二字要自己說出來（讀屏另有 `tiedLabel`）；裁決序不是名次。 */
    tieBreakLabel: (order: number) => `同分・裁決序 ${order}`,
    /** 無名次列的讀屏說明：不唸「第 null 名」。 */
    rankBelowThresholdA11y: "樣本不足，未列入名次",
    /** 身分口徑（設計 §8.2：三個口徑，7 值全列不引入 ALL sentinel）。 */
    scopeLabel: "身分口徑",
    scopeAttendees: "僅與會者",
    scopeExhibitors: "展商",
    scopeAll: "全部身分",
    /** `sampleQuality` 為 `small`／`accumulating` 時的標籤。 */
    sampleAccumulating: "資料累積中",
    /** 主指標旁的 `*` 需要一句解釋（App 專屬）。 */
    sampleAsteriskNote: "* 樣本較小，達 10 位後才顯示完整統計",
    summaryCohort: (count: number) => `可排名對象 ${count} 位`,
    summaryRanked: (count: number) => `已上榜 ${count} 位`,
    summaryBelowThreshold: (count: number) => `樣本不足 ${count} 位`,
    belowThresholdHeading: (count: number) => `樣本不足（${count} 人）`,
    belowThresholdHint: (threshold: number) =>
      `未達 ${threshold} 位瀏覽人次，僅供參考，不列入名次`,
    /** 截斷時必須講出來：`totals.belowThreshold` 才是真值。 */
    belowThresholdTruncated: (shown: number, total: number) =>
      `僅顯示前 ${shown} 人，共 ${total} 人`,
    excludedHeading: (count: number) => `未列入計算（${count} 人）`,
    excludedInactive: "報名未完成或已取消／封存",
    /** `null`＝後端沒回報口徑（未知），不可捏造排除名單。 */
    excludedRoleExcluded: (excludedLabels: string | null) =>
      excludedLabels === null
        ? "身分類別不列入"
        : `身分類別不列入（${excludedLabels}）`,
    excludedNoAccount: "未註冊帳號，沒有名片可被瀏覽",
    excludedNoProfile: "沒有預設且公開的名片",
    excludedTruncated: (shown: number) =>
      `名單只顯示前 ${shown} 筆，其餘同類未列出`,
    riskBanner: (count: number) => `本榜有 ${count} 列含需複核的事件`,
    riskBannerHint: "標記不代表作弊，請人工複核後再發獎",
    dataQualityNote: "此列數字可能因訪客封鎖 cookie 而偏高",
    staleInfo: (time: string) => `資料更新於 ${time}，每 15 分鐘更新一次`,
    staleWarning: "資料已超過 1 小時未更新，請確認聚合排程",
    trackingDisabled: "本活動未啟用名片統計，排行榜無法計算",
    /**
     * S12：`attributionScope === 'time_window_cohort'` 的常駐揭露。
     *
     * Phase 1 的 `TapEvent.eventId` 恆為 NULL，所以這是「活動時間窗 ∩ 報名者」
     * 的數字，不是「活動歸因」的數字。兩場活動時間重疊且參加者重疊時數字會混，
     * 這條是唯一的誠實揭露（設計 §12.1 R-03）。
     */
    attributionTimeWindow:
      "本期數字以活動時間窗計算（以 UTC 日為單位，含活動首日 00:00 UTC 起），尚未做活動歸因",
    riskFlagsInactive: "異常標記尚未啟用",
    emptyNoCohort: "本活動尚無可列入排名的參加者",
    /** 展商口徑的 cohort 為 0 時，「尚無參加者」是錯誤診斷（活動有上千位參加者）。 */
    emptyNoCohortExhibitors: "此口徑（展商）目前沒有可列入排名的人",
    emptyBelowThreshold: (threshold: number, count: number) =>
      `目前沒有人達到 ${threshold} 位瀏覽人次（共 ${count} 位參加者）`,
    /** 展商口徑的 cohort 全是展商，不能叫他們「參加者」。 */
    emptyBelowThresholdExhibitors: (threshold: number, count: number) =>
      `目前沒有展商達到 ${threshold} 位瀏覽人次（共 ${count} 位展商）`,
    cohortTooLarge: (count: number) =>
      `本活動有 ${count} 位參加者，超過本版上限（10,000）`,
    /** 後端有回 `details.cohort` 時用上一條；沒有的話至少不要說「0 位」。 */
    cohortTooLargeUnknown:
      "本活動的參加者人數超過本版上限（10,000），請聯絡技術支援",
    methodologyTitle: "這個數字怎麼算的",
    methodologyBody:
      "名次依「看過名片的人次」排序；同分時依序比較：已收集聯絡資料數 → 最早達成的日期 → 最早收集到聯絡資料的時間。",
    methodologyDedupe:
      "同一訪客同一天對同一張名片最多計算 1 次（UTC 日）。多日活動為每日分別去重後加總，同一人隔天再訪會再計算 1 次。",
    methodologyLead:
      "聯絡資料以電子郵件正規化後去重；同一位訪客重複送出只計算 1 次。若多人共用同一電子郵件，會合併計為 1 筆。",
    /**
     * 排除句由 `methodology.registrantTypesIncluded` 推導；空字串＝全 7 類都納入，
     * `null`＝後端沒回報口徑（未知，不可說成「未排除任何身分類別」）。
     */
    methodologyExcluded: (excludedLabels: string | null) =>
      excludedLabels === null
        ? "未取得本次的身分類別口徑；未註冊帳號或沒有公開名片者仍不列入。"
        : excludedLabels === ""
          ? "未排除任何身分類別；未註冊帳號或沒有公開名片者仍不列入。"
          : `不含：${excludedLabels}；未註冊帳號或沒有公開名片者。`,
    /** 單列的展開區（主辦方複核用）。 */
    detailHeading: "複核資訊",
    detailEarliestDay: "最早達成日",
    detailFirstLeadAt: "首筆聯絡資料",
    detailFlaggedTaps: "被標記的次數",
    detailDataQuality: "量測品質訊號",
    detailNone: "無",
    expandDetails: (name: string) => `展開 ${name} 的複核資訊`,
    collapseDetails: (name: string) => `收合 ${name} 的複核資訊`,
    sectionExpand: (title: string) => `展開「${title}」`,
    sectionCollapse: (title: string) => `收合「${title}」`,
  },
  /**
   * 場次管理（parity `sessions`）。
   *
   * Web 的 i18n 在 `public/locales/zh-Hant/event_manage.json` 的
   * `sessions` 命名空間。Web 這頁的標題是「工作坊管理」，儘管後端與
   * 型別都叫 Session，而且 `sessionType` 有七種（含派對、媒體日）。
   * **照抄 Web 的用詞**：兩邊叫不同名字，比兩邊叫錯同一個名字更難查。
   *
   * ⚠️ 刻意**沒有**搬過來的 Web 字串（不是漏抄）：
   * - `delete`／`deleteConfirm`：後端沒有 `DELETE /sessions/:sessionId`，
   *   Web 那顆按鈕按下去是 404。App 不重現壞掉的按鈕——連字串都不放進來，
   *   否則會有人以為「只是還沒接」。
   *   （見 `12-parity-build-plan-20261029.md` §12.3.2 `ESC-CRA-001`）
   * - `people`（「人」）：Web 這一頁沒有任何地方用到它。
   */
  sessions: {
    /** Web `sessions.title` */
    title: "工作坊管理",
    subtitle: "活動的場次與出席人數",
    /** Web `sessions.empty` */
    empty: "尚無工作坊/活動場次",
    /** Web `sessions.unlimited` */
    unlimited: "無限制",
    /** Web `sessions.speakerLabel`（i18next `{{name}}` → 函式） */
    speakerLabel: (name: string) => `講者：${name}`,
    /** Web `sessions.registeredCount`（`{{count}}` / `{{capacity}}` → 函式） */
    registeredCount: (count: number, capacity: string) =>
      `已報名 ${count} / ${capacity}`,
    /** Web `sessions.people` 只在 Web 的別處出現，這一頁不用；App 也沒有搬。 */
    loading: "讀取中…",
    loadError: "載入工作坊列表失敗，請稍後再試",
    /** Web `sessions.add` */
    add: "新增工作坊",
    /** Web `sessions.titleField`（Web 是表單的標籤，也是必填星號的宿主） */
    titleField: "標題",
    /** Web `sessions.type` */
    type: "類型",
    /** Web `sessions.startTime` / `sessions.endTime` */
    startTime: "開始時間",
    endTime: "結束時間",
    /**
     * 時間欄位的輸入提示。
     *
     * Web 是 `<input type="datetime-local">`，瀏覽器自己給日曆。
     * App 沒有 date picker（`package.json` 沒有
     * `@react-native-community/datetimepicker`，本輪不加依賴），所以是文字輸入。
     * 這一對字串就是那個差異的可見面——不是漏抄。
     */
    dateTimePlaceholder: "YYYY-MM-DD HH:mm",
    dateTimeHint: "例：2026-11-05 10:00（本地時間）",
    /** Web `sessions.location` / `sessions.locationPlaceholder` */
    location: "地點",
    locationPlaceholder: "例：Hall A",
    /** Web `sessions.speaker` */
    speaker: "講者",
    /** Web `sessions.capacity` */
    capacity: "容量上限",
    /** Web `sessions.price` / `sessions.tokenCost` */
    price: "價格",
    tokenCost: "Token 費用",
    /** Web `sessions.description` */
    description: "說明",
    /** Web `sessions.cancel` / `sessions.saving` / `sessions.create` */
    cancel: "取消",
    saving: "儲存中...",
    create: "建立",
    /** Web `sessions.edit`（表單標題） */
    edit: "編輯工作坊",
    /** Web `sessions.saveChanges` */
    saveChanges: "儲存變更",
    /** Web `sessions.editAction`（卡片上的那顆按鈕） */
    editAction: "編輯",
    /** App 獨有（Web 建立成功後直接關閉，沒有提示） */
    createSuccess: "工作坊已建立",
    /** App 獨有（同上） */
    updateSuccess: "工作坊已更新",
    /** 後端失敗的預設訊息（對應 Web 的 `errors.general`，但走 `getApiErrorMessage`） */
    actionError: "操作失敗，請稍後重試",
    /** Web `sessions.viewRegistrations`（卡片上通往名冊的按鈕） */
    viewRegistrations: "報名名單",
    /**
     * 名冊（`GET …/sessions/:sessionId/registrations`）。
     *
     * 對應 Web `sessions.registrations.*`。⚠️ Web 的表頭字串
     * `name`／`email`／`code` 刻意沒有搬：手機上不是表格，每一列自己帶欄位語意，
     * 沒有表頭可以放。搬過來只會是三個永遠不會亮的字串。
     */
    registrations: {
      /** Web `sessions.registrations.title` */
      title: "工作坊報名名單",
      /** Web `sessions.registrations.empty` */
      empty: "尚無人報名此工作坊",
      /** Web `sessions.registrations.load_error` */
      loadError: "載入報名名單失敗，請稍後重試",
      /**
       * 權限不足（後端 `403 INSUFFICIENT_PERMISSION`）。
       *
       * Web 沒有這條字串（它把 403 也當成泛用的載入失敗）。App 區分它，
       * 因為「你沒有權限」與「網路壞了」對現場的人來說是完全不同的兩件事。
       */
      forbidden: "你沒有權限查看這場次的報名名單",
      /** Web `sessions.registrations.ticket` */
      ticket: "票種",
      /** Web `sessions.registrations.registeredAt` */
      registeredAt: "報名時間",
      /** Web `sessions.registrations.attendance`（區塊標題用不到，列上的徽章用下面三個） */
      attended: "已出席",
      noShow: "未出席",
      awaiting: "待出席",
      /** Web `sessions.registrations.summary_attended` 等三條（`{{count}}` → 函式） */
      summaryAttended: (count: number) => `已出席 ${count}`,
      summaryRegistered: (count: number) => `待出席 ${count}`,
      summaryNoShow: (count: number) => `未出席 ${count}`,
      /** Web `sessions.registrations.page_info` */
      pageInfo: (page: number, totalPages: number, total: number) =>
        `第 ${page} / ${totalPages} 頁，共 ${total} 條`,
      /** Web `sessions.registrations.prev` / `next` */
      prev: "上一頁",
      next: "下一頁",
    },
    /**
     * 表單驗證訊息。
     *
     * 前兩條照抄 Web 的 `sessions.errors.titleRequired` / `timeRequired`。
     * 後四條是 App 補的：Web 只把這些情況丟給後端，換來一句
     * `errors.general`（「操作失敗」）。App 在送出前就講清楚是哪一格。
     * ⚠️ Web 的 `errors.general` 刻意沒有搬——它對應的是「後端失敗」，
     * 而 App 那條路徑走 `getApiErrorMessage`，不會用到這個字串。
     */
    errors: {
      /** Web `sessions.errors.titleRequired` */
      titleRequired: "標題為必填",
      /** Web `sessions.errors.timeRequired` */
      timeRequired: "開始與結束時間為必填",
      timeInvalid: "時間格式請照 YYYY-MM-DD HH:mm 填寫",
      /** 後端 `capacity` 是 `@Min(1)`，0 一定 400 */
      capacityInvalid: "容量上限請填 1 以上的整數，或留空表示不限",
      priceInvalid: "價格請填 0 以上的數字",
      tokenCostInvalid: "Token 費用請填 0 以上的整數",
    },
    /** Web `sessionType.*`——七個值逐字對齊 Prisma `enum EventSessionType`。 */
    sessionType: {
      WORKSHOP: "工作坊",
      CONFERENCE: "會議",
      KEYNOTE: "主題演講",
      PARTY: "派對",
      MEDIA_DAY: "媒體日",
      PRODUCT_LAUNCH: "產品發佈",
      NETWORKING: "交流活動",
    },
  },
  /**
   * 票種管理（parity `ticket-types`）。
   *
   * Web 的 i18n 在 `public/locales/zh-Hant/event_manage.json` 的
   * `ticketTypes` 命名空間。這裡只收本輪用得到的鍵；每一條都註記對應的
   * Web 鍵名，讓下一個人能一眼比對，不必猜「這句是不是自己編的」。
   *
   * ⚠️ 刻意**沒有**搬過來的 Web 字串（不是漏抄）：
   * - `formEditor.*`（整套動態表單建構器）：App 沒有建構器，改以 JSON 文字
   *   入口編輯同一份 `formFieldsJson`（見 `ticket-types.tsx` 檔頭）。
   * - `appearance.*`（報名表外觀）：同上，App 不編輯外觀。
   * - `previewForm` / `previewRequiresSave`：綁在建構器上。
   * - `sold`：Web 兩個分支都走 `soldWithCapacity`，這條是死字串。
   */
  ticketTypes: {
    /** Web `ticketTypes.title` */
    title: "票種管理",
    subtitle: "設定現場報名可選的票種",
    /** Web `ticketTypes.add` */
    add: "新增票種",
    /** Web `ticketTypes.edit` */
    edit: "編輯票種",
    /** Web `ticketTypes.copyLink` / `ticketTypes.copied` */
    copyLink: "複製報名連結",
    copied: "已複製",
    copyFailed: "無法複製連結，請稍後再試",
    /** Web `ticketTypes.empty` */
    empty: "尚未設置任何票種",
    /** Web `ticketTypes.inactive` / `ticketTypes.hidden` */
    inactive: "已停用",
    hidden: "隱藏",
    /** Web `ticketTypes.editAction` / `ticketTypes.deactivate` */
    editAction: "編輯",
    deactivate: "停用",
    /** Web `ticketTypes.soldWithCapacity`（`unlimited` 取代 `{{capacity}}`） */
    soldWithCapacity: (sold: number, capacity: number | null) =>
      capacity == null ? `已售 ${sold} / 無限制` : `已售 ${sold} / ${capacity}`,
    /** Web `ticketTypes.unlimited` */
    unlimited: "無限制",
    /** Web `ticketTypes.code` */
    code: (code: string) => `碼：${code}`,
    /** Web `ticketTypes.registrantType` */
    registrantType: "報名者類型",
    /**
     * 報名者類型顯示名稱。
     *
     * **不沿用** `event.registrantTypeLabels`：那一組的鍵是
     * `EXHIBITOR` / `STAFF` / `VIP`，後端 `enum RegistrantType` 裡
     * **沒有這三個值**，卻缺了 `SPONSOR` / `GUEST` / `VOLUNTEER`。
     * 票種畫面會遍歷整個 enum，用那一組會有值顯示成原始英文。
     */
    registrantTypeLabels: {
      ATTENDEE: "參加者",
      EXHIBITOR_REP: "參展代表",
      SPEAKER: "講者",
      SPONSOR: "贊助商",
      MEDIA: "媒體",
      GUEST: "貴賓",
      VOLUNTEER: "志工",
    } satisfies Record<string, string>,
    /** Web `ticketTypes.loadError`（Web 沒有；Web 是靜默清空，見檔頭） */
    loadError: "載入票種失敗，請稍後再試",
    loading: "讀取中…",

    // ── 表單（Web `ticketTypes.{identifierName,displayName,price,…}`）──────
    /** Web `ticketTypes.identifierName` / `identifierHint`（系統用） */
    identifierName: "識別名稱",
    identifierHint: "系統用，建立後不建議更動",
    /** Web `ticketTypes.displayName` / `displayNamePlaceholder` */
    displayName: "顯示名稱",
    displayNamePlaceholder: "普通參加者",
    /** Web `ticketTypes.price` / `currency` / `capacity` */
    price: "價格",
    currency: "幣種",
    capacity: "容量上限",
    capacityPlaceholder: "留空＝無限制",
    description: "票種說明（可選）",
    /** Web `ticketTypes.paymentMethod` */
    paymentMethod: "付款方式",
    /** Web `ticketTypes.initialTokens` */
    initialTokens: "初始 Token 數量",
    /** Web `ticketTypes.hiddenTicket` / `hiddenHint` / `accessCode` */
    hiddenTicket: "隱藏票種",
    hiddenHint: "（需要訪問碼才能報名）",
    accessCode: "訪問碼",
    accessCodePlaceholder: "VIP2026",
    /**
     * 付款方式顯示名稱。
     *
     * Web 直接渲染 `FREE` / `BANK_TRANSFER` 這兩個原始 enum 值（它的
     * `<select>` 用 `m.value` 當文字）。App 顯示中文，並保留原始值在提示裡
     * ——現場操作員與工程師對話時需要同一個字。
     */
    paymentMethodLabels: {
      FREE: "免費",
      BANK_TRANSFER: "銀行轉帳",
    } satisfies Record<string, string>,
    /** 表單動作 */
    save: "儲存",
    saving: "儲存中…",
    cancel: "取消",
    /**
     * 票種權益（capability）。全部對應 Web `ticketTypes.{capabilities,
     * capabilitiesInheritedHint, capabilitiesOverriddenHint,
     * capabilitiesInheritReset, capabilitiesEnabled…}`。
     */
    capabilities: "票種權益",
    capabilitiesInheritedHint:
      "目前依「報名者類型」自動套用預設權益；勾選任何一項即改為手動指定。",
    capabilitiesOverriddenHint:
      "已手動指定。未勾選的權益不會生效（此設定完全取代預設值）。",
    capabilitiesInheritReset: "還原為預設",
    /** Web `ticketTypes.capability.*` */
    capabilityLabels: {
      NETWORKING: "商業配對",
      EXHIBITOR_DIRECTORY: "瀏覽展商名錄",
      LEADS: "檢視收集到的 Leads",
      WALLET: "Token 錢包",
      SESSIONS: "報名議程場次",
      POLLS: "現場投票",
    } satisfies Record<string, string>,
    /** Web `ticketTypes.capabilitiesEnabled` / `capabilitiesDisabled` */
    capabilitiesEnabled: "票種權益已啟用",
    capabilitiesDisabled: "票種權益尚未啟用",
    /** Web `ticketTypes.capabilitiesEnabledHint` / `capabilitiesDisabledHint` */
    capabilitiesEnabledHint:
      "已依各票種的權益設定限制功能（例：不含「商業配對」的票種無法使用配對）。",
    capabilitiesDisabledHint:
      "目前不依票種限制功能——所有已報名者都能使用商業配對。啟用後才會依各票種權益限制。",
    /** Web `ticketTypes.capabilitiesEnable` / `capabilitiesDisable` */
    capabilitiesEnable: "啟用",
    capabilitiesDisable: "停用",
    /**
     * Web `ticketTypes.capabilitiesEnableConfirm`。
     *
     * App 額外加了標題與取消鈕，因為這裡是自繪 Modal 而不是瀏覽器原生
     * `confirm()`；文案本體逐字照抄。
     */
    capabilitiesEnableConfirmTitle: "啟用票種權益",
    capabilitiesEnableConfirm:
      "啟用後，已報名者若其票種不含某項權益，將「立即」失去對應功能（例如商業配對）。確定要啟用嗎？",
    capabilitiesToggleFailed: "票種權益開關切換失敗，請稍後再試",
    /** 成功訊息 */
    createSuccess: "票種已建立",
    updateSuccess: "票種已更新",
    deactivateSuccess: "票種已停用",
    /** 表單驗證錯誤（Web `ticketTypes.errors.*`，逐條對應） */
    formErrors: {
      /** Web `errors.nameRequired` */
      nameRequired: "識別名稱為必填",
      /** Web `errors.displayNameRequired` */
      displayNameRequired: "顯示名稱為必填",
      /** Web `errors.priceRequired` */
      priceRequired: "價格為必填",
      /** Web `errors.priceInvalid` */
      priceInvalid: "請輸入有效價格",
      /**
       * Web 沒有這條：它的容量欄位允許 0，然後在後端 400。
       * 這一條只在「打了非數字」時出現（`min=1` 的後端限制仍交給後端回）。
       */
      capacityInvalid: "容量上限請填整數，或留空表示無限制",
      /** Web 沒有這條（它的 `Number('abc')` 會變 `NaN` 送到後端）。 */
      tokensInvalid: "初始 Token 數量請填整數",
      /** Web `errors.accessCodeRequired` */
      accessCodeRequired: "隱藏票種必須設置訪問碼",
      /** Web `errors.paymentMethodRequired` */
      paymentMethodRequired: "請至少選一種付款方式",
      /**
       * 報名表 JSON 的語意驗證錯誤。全部逐條對應 Web `errors.*`
       * （Web 的這些訊息是給**建構器 UI** 用的；App 沒有建構器，用文字入口，
       * 所以同一組訊息在這裡是「JSON 哪裡不對」）。
       */
      /** Web `errors.formSchemaInvalid` */
      formSchemaInvalid: "請輸入有效的 JSON schema 物件",
      /** Web `errors.formSchemaDuplicateKeys` */
      formSchemaDuplicateKeys: "表單欄位含重複 key，每個 key 必須唯一",
      /** Web `errors.formSchemaInvalidKey` */
      formSchemaInvalidKey: "欄位 key 只能包含字母、數字、_ 和 -",
      /** Web `errors.formSchemaBadPrice` */
      formSchemaBadPrice: "定價選項包含無效的價格或按金數值",
      /** Web `formEditor.missingRequiredSemantic`（`{{missing}}` → 函式） */
      formSchemaMissingSemantic: (missing: string) =>
        `缺少必備語義：${missing}`,
      /** Web `errors.formSchemaInvalidAllowOtherType` */
      formSchemaInvalidAllowOtherType: "「其他」僅適用於單選/多選欄位",
      /** Web `errors.formSchemaInvalidOtherCollision` */
      formSchemaInvalidOtherCollision:
        "選項值不可與「其他」哨兵值 __other__ 衝突",
      /** Web `errors.formSchemaInvalidSiblingCollision` */
      formSchemaInvalidSiblingCollision:
        "欄位 key 不可與「其他」欄位的 sibling key 衝突",
      /** Web `errors.formSchemaInvalidSemanticType` */
      formSchemaInvalidSemanticType:
        "語義綁定僅支援 text / select 型別（其他型別會導致報名驗證失敗）",
    },
    /**
     * 報名表 JSON 入口。
     *
     * Web 有完整的動態表單建構器；App 沒有（建構器本身就是一大塊 UI）。
     * 這裡改用直接編輯同一份 JSON，語義與存進 DB 的資料完全相同。
     * Web 的 i18n 早就預留了這個入口（`ticketTypes.formSchema` /
     * `formSchemaHint`：「P0 先提供最小 JSON authoring 入口」），文案照抄。
     */
    formSchema: "報名表單設定（JSON）",
    formSchemaHint:
      '選填。留空等同 { "fields": [] }。欄位格式與網頁版相同，存檔前會做語意綁定驗證。',
    /** Web `formEditor.semantic.*`（缺少必填語義時列出用） */
    semanticLabels: {
      email: "Email",
      firstName: "名字",
      lastName: "姓氏",
      phone: "電話",
      company: "公司",
      website: "官網",
    } satisfies Record<string, string>,
    /**
     * 二次確認（**Web 沒有**，App 新增）。
     *
     * Web 的票種編輯器存檔是一次點擊直接寫入，包含改價格與改名額。
     * 價格改了會立刻影響下一筆報名的收費；名額調小於已售數量，會讓公開頁
     * 顯示「已售 12 / 10」而沒有任何錯誤。兩者都是「按下去就來不及」的操作，
     * 所以 App 在送出前把它們攤開講一次。
     *
     * 只列實際變動的項目；沒改價格就不問價格。避免變成反射性按確定的儀式。
     */
    confirm: {
      createTitle: "確認新增票種",
      editTitle: "確認修改票種",
      /** `priceTo` / `capacityTo` 已由呼叫端格式化成顯示字串。 */
      priceLine: (from: string | null, to: string) =>
        from == null ? `價格：${to}` : `價格：${from} → ${to}`,
      capacityLine: (from: string | null, to: string | null) =>
        `名額：${from ?? "無限制"} → ${to ?? "無限制"}`,
      priceNote: "價格變更會立刻套用到下一筆報名。已完成的報名不受影響。",
      capacityNote:
        "名額調到低於已售數量不會擋下存檔，但公開頁會顯示超賣；需要的話請先停用票種。",
      confirmCreate: "確認新增",
      confirmSave: "確認儲存",
      cancel: "再檢查一下",
    },
    /**
     * 寫入失敗的分類文案。
     *
     * 刻意**不回顯後端 `error.message`**（見 `utils/ticket-type-errors.ts`）。
     * 每一句都只說「哪一類失敗」與「可以怎麼辦」。
     */
    mutationErrors: {
      forbidden: "你沒有權限管理此活動的票種",
      notFound: "票種不存在，可能已被其他人刪除。請重新整理。",
      accessCodeConflict: "這個訪問碼已被其他票種使用（跨活動唯一），請換一個",
      invalidFormSchema: "報名表單設定無效，請檢查欄位設定後再試",
      validation: "票種資料未通過後端驗證，請檢查價格、名額與 Token 數量",
      failed: "操作失敗，請稍後再試",
    },
    /**
     * 停用的二次確認（**Web 有確認框，但文案與事實不符**）。
     *
     * Web 的 `ticketTypes.deactivateConfirm` 是
     * 「確定停用票種「{{name}}」？此操作不可逆。」
     * 兩句都經不起查證：
     *
     * 1. **不是「不可逆」**——後端 `DELETE …/ticket-types/:id` 只是把
     *    `isActive` 設成 `false`（`EventTicketTypeService.deactivate`），
     *    而 `UpdateEventTicketTypeDto` 有 `isActive` 欄位，所以同一張票可以
     *    用 PATCH 再開回來。Web 的 UI 沒有做那個入口，但「不可逆」是錯的。
     * 2. **沒有說已售出的票會怎樣**——那是操作員按下確認前最想知道的一件事。
     *
     * 所以這一段文案是**照後端行為重寫的**（查證位置見
     * `services/ticket-type.service.ts` 的 `deactivateTicketType`），
     * 不是照抄 Web。
     */
    deactivateConfirm: {
      title: "停用票種",
      intro: (name: string) => `確定停用「${name}」？`,
      /** `EventRegistrationService:347` / `:1061` 只看 `isActive`，不看歷史資料。 */
      registrationsUnaffected: "已售出的票與既有報名不受影響，報到照常。",
      /** 同上：`!ticketType.isActive` ⇒ `TICKET_TYPE_NOT_FOUND`。 */
      newRegistrationsBlocked: "這個票種不能再被新報名選用。",
      /** `listPublicTicketTypes` 的 where 有 `isActive: true`。 */
      publicPageHidden: "公開報名頁不再顯示這個票種。",
      /** admin 分支不過濾 `isActive`。 */
      adminStillVisible: "後台仍看得到它，標為「已停用」。",
      confirm: "確認停用",
      cancel: "取消",
    },
  },
  /**
   * 匯款覆核（parity `bank-transfers`）。
   *
   * Web 的 i18n 在 `public/locales/zh-Hant/event_manage.json` 的
   * `bankTransfers` 命名空間；側欄名稱是 `layout.bankTransfers`（同一句）。
   * 這裡只收畫面上真的用得到的鍵，每一條都註記對應的 Web 鍵名。
   *
   * ⚠️ 刻意**沒有**搬過來的 Web 字串（不是漏抄）：
   * - `rejectReason`（「拒絕原因（可選）：」）：它是 `window.prompt` 的提示字，
   *   App 用自繪輸入框（見 `bank-transfers.tsx`）。
   *
   * Web 原文用「轉賬」（港／澳用法），這裡照抄不改成「轉帳」——兩邊共用同一批
   * 使用者，同一筆錢在後台與手機上叫同一個名字。
   */
  bankTransfers: {
    /** Web `layout.bankTransfers` / `bankTransfers.title` */
    title: "銀行轉賬審批",
    subtitle: "核對憑證後批准或拒絕一筆匯款",
    loading: "讀取中…",
    /**
     * Web **沒有**這個字串：它的 `load()` 是靜默 `catch`，失敗時畫面會收成
     * 「暫無待審批的轉賬記錄」——看起來跟真的一筆都沒有完全一樣（見
     * `bank-transfers.tsx` 檔頭）。App 把失敗講出來。
     */
    loadError: "載入轉賬清單失敗，請稍後再試",
    /** Web `bankTransfers.all` / `pending` / `approved` / `rejected` */
    tabs: {
      all: "全部",
      pending: "待審批",
      approved: "已批准",
      rejected: "已拒絕",
    },
    /** Web `bankTransfers.total`（i18next `{{count}}` → 函式） */
    total: (count: number) => `共 ${count} 條`,
    /** Web `bankTransfers.emptyPending` / `emptyGeneric` */
    emptyPending: "暫無待審批的轉賬記錄",
    emptyGeneric: "暫無轉賬記錄",
    /** Web `bankTransfers.registrationCode` / `submittedAt` */
    registrationCode: "報名碼",
    submittedAt: "提交時間",
    /** Web `bankTransfers.amount` / `bankRef` */
    amount: "金額",
    bankRef: "轉賬參考號",
    /** Web `bankTransfers.viewProof` / `noProof` */
    viewProof: "查看轉賬憑證",
    noProof: "無憑證",
    /** Web 沒有：Web 是 `<a target="_blank">`，開不起來由瀏覽器自理。 */
    proofOpenFailed: "無法開啟憑證連結，請確認網路後再試",
    /** Web `bankTransfers.approve` / `bankTransfers.reject` */
    approve: "批准",
    reject: "拒絕",
    cancel: "取消",
    /**
     * 批准的二次確認（**Web 沒有這一步**）。
     *
     * Web 是「按下批准 → 立刻送 `PATCH …/review`」，沒有任何確認框。這一頁
     * 放行的是款項，而後端對非 `PENDING` 一律回 `BANK_TRANSFER_ALREADY_REVIEWED`
     * ——換句話說**批准之後在 App 上沒有反向操作**。既然不可逆，按下之前就
     * 必須看得見「誰、多少錢、哪一筆」。
     */
    approveConfirm: {
      title: "批准這筆匯款？",
      intro:
        "批准後這筆報名會變成已付款，並發放該票種的初始 Token。批准在此 App 內無法復原。",
      personLabel: "報名者",
      amountLabel: "金額",
      codeLabel: "報名碼",
      confirm: "確認批准",
    },
    /** Web 沒有：Web 成功後靜默重載，不講話。 */
    approveSuccess: "已批准這筆匯款",
    /**
     * 拒絕的二次確認。
     *
     * Web 的流程是 `window.prompt('拒絕原因（可選）：')`，然後直接送出
     * `REJECTED`——**按「取消」也一樣送**（`prompt` 回 `null`，`null ?? undefined`
     * 之後照送）。App 把「填原因」與「再確認」合成同一個對話框：取消就是取消，
     * 什麼都不送。
     *
     * 原因**不是必填**：後端 `ReviewBankTransferDto.reviewNote` 是
     * `@IsOptional()`，Web 的提示字也寫著「（可選）」。強制必填會是 App 多了
     * 一條 Web 沒有的規則。
     */
    rejectConfirm: {
      title: "拒絕這筆匯款？",
      intro:
        "拒絕後這筆報名會變成已拒絕，且在此 App 內無法復原。原因可以不填，但填了才看得出為什麼。",
      reasonLabel: "拒絕原因（可選）",
      reasonPlaceholder: "例如：匯款金額與報名金額不符",
      /**
       * 原因留空時顯示的最後一行。
       *
       * 為什麼要講出來：空白輸入在畫面上「什麼都沒有」，操作員無從知道自己
       * 剛剛是不是漏打字了。明說「不會留下理由」，是按確認前該知道的事。
       */
      noReason: "（未填寫原因——這筆拒絕不會留下理由）",
      confirm: "確認拒絕",
    },
    /** Web 沒有：Web 成功後靜默重載，不講話。 */
    rejectSuccess: "已拒絕這筆匯款",
    /**
     * 覆核失敗的分類文案（見 `utils/bank-transfer-review.ts`）。
     *
     * 刻意**不回顯後端 `error.message`**：後端訊息可能帶內部路徑、別人的報名碼
     * 或 SQL 片段。每一句只說「哪一類」與「接下來會怎樣」。
     */
    reviewErrors: {
      forbidden: "你沒有權限審批此活動的轉賬",
      notFound: "這筆轉賬記錄不存在，可能已被其他人處理。清單已重新載入。",
      alreadyReviewed: "這筆轉賬已經被審批過了。清單已重新載入。",
      validation: "審批內容未通過後端驗證，請重新整理後再試",
      failed: "操作失敗，請稍後再試",
    },
  },
  /**
   * 組織角色（parity `org-roles`）。
   *
   * Web 的 i18n 在 `public/locales/zh-Hant/event_manage.json` 的 `orgRoles`
   * 與 `role` 兩個命名空間；側欄名稱是 `layout.orgRoles`（同一句）。
   * 這裡只收畫面上真的用得到的鍵，每一條都註記對應的 Web 鍵名。
   *
   * ⚠️ 刻意**沒有**搬過來的 Web 字串（不是漏抄）：
   * - `removeConfirm`（「確定移除此管理員？」）：它是 `window.confirm` 的一行字，
   *   App 的確認框要顯示「要移除誰」，那一句在這裡不夠用（見 `removeConfirm`）。
   * - `noPermissionInviteToast` / `noPermissionRemoveToast`：Web 用它做 403 的
   *   toast。App 在**按下之前**就把沒有權限的人擋住（`noPermissionHint`），
   *   真的還是 403 時走 `errors.forbidden`——同一個意思不需要兩套字。
   *
   * Web 的 emoji（`✅` / `❌`）一律不搬：App 全站沒有用 emoji 表達成功／失敗，
   * 而是靠 `InlineBanner` 的 tone 與顏色。
   */
  orgRoles: {
    /** Web `layout.orgRoles` / `orgRoles.title` */
    title: "管理員邀請",
    /** Web `orgRoles.subtitle` */
    subtitle: "管理活動擁有者、協調員及操作員的存取權限",
    loading: "讀取中…",
    /** Web `orgRoles.loadFailed`（去掉 `❌`） */
    loadFailed: "無法載入管理員名單，請稍後再試",
    /** Web `orgRoles.existing` */
    existing: "現有管理員",
    /** Web `orgRoles.empty` */
    empty: "暫無管理員",
    /** Web `orgRoles.yourRole` */
    yourRole: "你的角色",
    /** Web `orgRoles.viewOnly` */
    viewOnly: "僅供檢視",
    /** Web `orgRoles.noPermissionTitle` */
    noPermissionTitle: "你沒有權限管理活動管理員",
    /** Web `orgRoles.noPermissionHint`（i18next `{{role}}` → 函式） */
    noPermissionHint: (role: string) =>
      `只有活動擁有者及 SUPER_ADMIN 可以邀請或移除管理員。你目前的角色是「${role}」，但仍可查看現有管理員名單。`,
    /**
     * 角色名稱。**六個值全列**，含 `OWNER`。
     *
     * Web 的 i18n `role` 命名空間本來就有這六個（`OWNER` 也在），但它的頁面
     * 另外手寫了一個只含三個的 `roleLabels`（`org-roles/page.tsx:274-278`），
     * 於是清單上遇到 `VOLUNTEER` / `MEDIA` 時會渲染一個**空白徽章**——i18n 有字
     * 卻沒有被用到。這裡直接用完整的一張表，並由
     * `utils/org-role-display.ts` 的 `orgRoleLabel()` 對不認得的值退回原字串。
     */
    roleLabels: {
      OWNER: "擁有者",
      SUPER_ADMIN: "Super Admin",
      COORDINATOR: "Coordinator",
      OPERATOR: "Operator",
      VOLUNTEER: "Volunteer",
      MEDIA: "Media",
    },
    /**
     * 一列的狀態。**這兩個不是後端 `OrgRoleStatus` 的值**
     * （後端只有 `ACTIVE` / `REVOKED`），而是
     * `utils/org-role-display.ts:orgRoleState()` 由 `acceptedAt` 推導出來的。
     */
    stateLabels: {
      active: "已生效",
      pending: "待接受",
    },
    /**
     * 「待接受」是什麼意思——只在真的有這種列出現時才顯示。
     *
     * 為什麼要解釋：後端對「email 還沒有帳號」的邀請會留下 `acceptedAt: null`，
     * 而**系統沒有任何管道把邀請 token 送給對方**（後端不寄信、Web 也沒有接受
     * 頁面）。所以這一列會一直是「待接受」。只寫「待接受」會讓人以為對方漏看信，
     * 實際上那封信從來沒有寄出。
     */
    pendingHint:
      "「待接受」代表對方還沒有帳號，或尚未接受邀請。系統目前不會寄送邀請信。",
    /** Web `orgRoles.inviteNew` */
    inviteNew: "邀請新管理員",
    /** Web `orgRoles.email` */
    email: "電子郵件",
    emailPlaceholder: "name@example.com",
    /** 角色欄位的標籤（Web 沒有：它的 `<select>` 只有 `aria-label`）。 */
    roleField: "角色",
    /** Web `orgRoles.invite` / `orgRoles.sending`（`...` → `…`） */
    invite: "邀請",
    sending: "發送中…",
    /** Web `orgRoles.inviteSuccess`（去掉 `✅`；i18next `{{email}}` → 函式） */
    inviteSuccess: (email: string) => `已邀請 ${email}`,
    /**
     * email 空白的本地提示。
     *
     * Web 靠 `<input required>` 讓瀏覽器自己擋；App 沒有那個機制，所以要有一句話。
     * **只驗非空**——多驗格式會比 Web 嚴格（理由見 `utils/org-role-invite.ts`）。
     */
    emailRequired: "請輸入電子郵件",
    /**
     * 邀請的二次確認（**Web 沒有這一步**）。
     *
     * Web 是「按下邀請 → 立刻送 `POST …/org-roles/invite`」，沒有任何確認框。
     * 這個動作給出的是**後台權限**，而確認框上的兩行（對誰、什麼角色）是唯一
     * 能在送出前發現「貼錯 email」或「選錯角色」的資訊。
     */
    inviteConfirm: {
      title: "邀請這個人管理活動？",
      intro:
        "對方會取得這場活動的後台權限。若該電子郵件已有帳號，權限會立即生效。",
      emailLabel: "電子郵件",
      roleLabel: "角色",
      confirm: "確認邀請",
    },
    /**
     * 邀請／移除失敗的分類文案（見 `utils/org-role-display.ts`）。
     *
     * 刻意**不回顯後端 `error.message`**：後端訊息可能帶內部路徑或別人的 email。
     * 每一句只說「哪一類」與「接下來會怎樣」。
     *
     * `forbidden` 與 `failed` 必須分開：前者是永久的（這個人就是沒有權限，重試
     * 一萬次也一樣），後者是暫時的。把兩者都講成「請稍後再試」，使用者會一直
     * 重試一件永遠不會成功的事。
     */
    errors: {
      forbidden: "你沒有權限管理此活動的管理員",
      alreadyExists: "這個電子郵件已經是此活動的管理員",
      notFound: "找不到這筆管理員記錄，可能已被其他人移除。名單已重新載入。",
      validation: "輸入的內容未通過後端驗證，請確認電子郵件後再試",
      failed: "操作失敗，請稍後再試",
    },
    /** Web `orgRoles.remove` */
    remove: "移除",
    /** Web `orgRoles.removeSuccess`（去掉 `✅`；i18next `{{email}}` → 函式） */
    removeSuccess: (email: string) => `已移除 ${email}`,
    /**
     * 移除的二次確認。
     *
     * Web 只有一行 `window.confirm`（`orgRoles.removeConfirm`：確定移除此管理員？），
     * **沒有說要移除誰**。清單一長，那一句話就等於沒有確認作用——按下去才知道
     * 按到哪一列。App 把「誰、email、什麼角色」三行都列出來。
     */
    removeConfirm: {
      title: "移除這位管理員？",
      intro: "對方會立刻失去這場活動的後台權限。",
      personLabel: "管理員",
      emailLabel: "電子郵件",
      roleLabel: "角色",
      confirm: "確認移除",
    },
    /**
     * SUPER_ADMIN 那一列沒有移除鈕時的唯一說明。
     *
     * Web 是**靜默地不畫按鈕**（`org-roles/page.tsx:295` 的
     * `r.role !== 'SUPER_ADMIN'`），什麼都不說。一列明明有角色卻沒有動作鈕，
     * 在現場看起來像壞掉；一句話就能把「設計如此」與「壞掉」分開。
     */
    superAdminLocked: "Super Admin 不可由此頁移除",
  },
  /**
   * 未匹配路由（`app/+not-found.tsx`）。
   * W-12：先前不存在此檔，無法解析的深連結會落到 expo-router 的預設畫面。
   * 「返回活動列表」沿用 `settings.backToEvents`，不另立重複字串。
   */
  notFound: {
    title: "找不到頁面",
    hint: "此連結可能已失效或有誤",
  },
} as const;

export default copy;
