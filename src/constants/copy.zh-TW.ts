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
  },
  event: {
    overviewTitle: "活動概覽",
    checkInTitle: "Check-in",
    registrations: "報名人數",
    checkedIn: "已報到",
    exhibitors: "參展商",
    unknownStatus: "未知狀態",
    quickActions: "快速操作",
    badgesTitle: "Badge",
    /**
     * W-12：`eventId` 路由參數缺失（空字串 / `undefined`）時的空態文案。
     * 消費端：`overview.tsx` / `check-in.tsx` / `nfc-bind.tsx`。
     */
    unavailableTitle: "找不到活動",
    unavailableHint: "此連結可能不完整，或活動已被移除",
  },
  /**
   * 活動狀態標籤（6 值）——直接鏡射後端 `EventStatus` enum
   * （`LinkCard_ExpressJS_Backend/prisma/schema.prisma`）。
   * 消費端：`app/(auth)/home.tsx` 的 `STATUS_LABEL`。
   */
  eventStatus: {
    draft: "草稿",
    published: "已發布",
    ongoing: "進行中",
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
    boundRegistration: "綁定報名：",
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
    walkInPlaceholderHint: "完整表單將於名單模組（WP-A5）交付；目前僅保留入口。",
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
  nfc: {
    writeTitle: "NFC 寫卡",
    bindSuccess: "NFC 綁定成功",
    bindFailed: "NFC 綁定失敗",
    iosWriteNotSupported: "iOS 不支援寫入，請改用 Android 裝置",
    /** ↓ 以下為既有 namespace 之擴充（A6）：原為 `nfc-bind.tsx` 硬編中文 */
    badgeTypeWristband: "手環",
    badgeTypeCard: "卡片",
    stepLookupHint: "① 輸入報名編號以查詢參加者",
    stepChooseTypeHint: "② 選擇 Badge 類型，然後將空白 NFC 卡靠近手機背面",
    startWrite: "開始寫入 NFC 卡",
    retype: "重新輸入",
    writing: "寫入中，請保持卡片靠近…",
    continueNext: "繼續下一張",
  },
  settings: {
    title: "設定",
    logout: "登出",
    appVersion: "App 版本",
    nfcStatus: "NFC 狀態",
    nfcSupported: "支援",
    nfcNotSupported: "不支援",
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
