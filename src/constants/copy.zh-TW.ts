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
    /** 可關閉橫幅（fatal/info banner）關閉鈕的讀屏標籤。消費端：`components/ui/InlineBanner` */
    dismiss: "關閉提示",
    /** 必填欄位的讀屏標籤。消費端：`components/ui/FieldInput` */
    requiredLabel: (label: string) => `${label}，必填`,
    /** 密碼欄位顯示／隱藏切換鈕的讀屏標籤。消費端：`components/ui/FieldInput` */
    revealPassword: "顯示密碼",
    hidePassword: "隱藏密碼",
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
    unknownStatus: "未知狀態",
    quickActions: "快速操作",
    badgesTitle: "Badge",
    backToOverview: "返回概覽",
    modulePlaceholderTitle: "功能建置中",
    tokenPlaceholderHint:
      "Token 櫃台以 Web 為主（WP-A4）。App 只保留入口，不做完整櫃台。",
    tokenOpenWeb: "在網頁打開櫃台",
    registrationsPlaceholderHint:
      "名單、搜尋與詳情將於 WP-A5 交付。目前僅保留入口。",
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
   * 鍵集合刻意取 **repo 內兩個宣告的聯集**：`types/api.types.ts` 宣告
   * `DRAFT / PUBLISHED / REGISTRATION_OPEN / ONGOING / ENDED / CANCELLED`，
   * 本檔另依後端 `prisma` 宣告 `COMPLETED` / `ARCHIVED`。任一值漏掉，畫面就會
   * 把原始 enum（英文）直接端給操作者。
   *
   * 尚未有文案的是 `ENDED`（只在 `api.types.ts` 出現）；刻意不在此推測它的
   * 顯示文字，遇未知值仍回退為原始字串。
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
    autoResetIn: "即將自動重置",
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
    requestOverride: "申請主管覆核",
    overrideBlockedBanner:
      "覆核 API 尚未開放（BLOCKED／待後端 B-2）。現場請人工放行並記錄。",
    overrideBlockedToast: "後端覆核端點尚未就緒，無法自動放行",
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
    walkInSuccess: "已建立報名",
    walkInPaymentNote:
      "此票需要付款。報名已建立，但尚未完成付款，不能當成已入場。",
    walkInGoCheckIn: "前往簽到",
    walkInGoNfc: "前往寫卡",
    walkInNeedEmail: "請輸入有效的 Email",
    walkInNeedTicket: "請先選擇票種",
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
    registeredAt: "報名",
    copyCode: "複製報名編號",
    codeCopied: "已複製報名編號",
    viewDetail: "查看詳情",
    sectionProfile: "基本資料",
    sectionRegistration: "報名",
    sectionCheckIn: "簽到",
    sectionToken: "Token 流水",
    sectionNfc: "綁定 NFC",
    sectionOrg: "所屬社團",
    nfcEmptyTitle: "查不到綁定卡",
    nfcEmptyHint: "後端還不能用報名編號反查 NFC，這裡顯示 —。",
    orgEmptyTitle: "沒有社團資料",
    orgEmptyHint: "沒有依使用者查社團的接口，這裡顯示 —。",
    tokenEmptyTitle: "沒有流水",
    tokenEmptyHint: "此報名還沒有 Token 交易，或目前帳號讀不到。",
    phone: "電話",
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
    writtenUid: "卡片編號",
    replaceTitle: "換卡 / 補發 / 退卡",
    replaceBlocked: "等待後端 WP-N2。作廢舊卡的端點尚未就緒，這些操作暫不可用",
    replaceCard: "換卡",
    reissueCard: "補發",
    returnCard: "退卡",
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
