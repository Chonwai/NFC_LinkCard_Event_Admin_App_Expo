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
  },
  checkIn: {
    scanHint: "掃描報名 QR code",
    manualMode: "手動輸入",
    scanMode: "掃描模式",
    codePlaceholder: "輸入報名編號",
    submit: "查詢",
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
    resultTitle: "報到結果",
  },
  nfc: {
    writeTitle: "NFC 寫卡",
    bindSuccess: "NFC 綁定成功",
    bindFailed: "NFC 綁定失敗",
    iosWriteNotSupported: "iOS 不支援寫入，請改用 Android 裝置",
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
} as const;

export default copy;
