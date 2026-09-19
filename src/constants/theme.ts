/**
 * LinkCard Promoter App — 三層設計 token 系統（單一真相來源）
 *
 * Layer 1 primitive  ：原始色票／數值。元件層「禁止」引用。
 * Layer 2 semantic   ：意圖語意。元件層「唯一」可引用的一層。
 * Layer 3 components ：元件別 alias（色彩 + 幾何綁定）。
 *
 * 對比度基準（WCAG 2.x，已實測）：
 *   #FFFFFF on #7C3AED = 5.70 ｜ on #6D28D9 = 7.10
 *   #111827 on #FFFFFF = 17.74 ｜ #374151 on #FFFFFF = 10.31
 *   #4B5563 on #F9FAFB = 7.23   ｜ #6B7280 on #FFFFFF = 4.83（非文字下限）
 *   #6D28D9 on #F3E8FF = 6.02   ｜ #15803D on #F0FDF4 = 4.79
 *   #B91C1C on #FEF2F2 = 5.91   ｜ #B45309 on #FFFBEB = 4.84
 * 禁用：legacy 淺灰（gray-400，對比 2.54）全面禁用、#111827 on 紫底、
 *       #E5E7EB/#D1D5DB 當互動邊界、白字 on #16A34A / #D97706、滿版紫底。
 *       （以語意名稱描述，避免字面色碼再次流入程式碼；見 §1.4 清理對照表）
 */
import {
  Platform,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from "react-native";

/* ==========================================================================
 * Layer 1 — Primitive（元件層禁止引用）
 * ========================================================================== */
export const primitive = {
  palette: {
    purple: {
      50: "#FAF5FF",
      100: "#F3E8FF",
      600: "#7C3AED",
      700: "#6D28D9",
    },
    gray: {
      950: "#030712",
      900: "#111827",
      700: "#374151",
      600: "#4B5563",
      500: "#6B7280",
      200: "#E5E7EB",
      100: "#F3F4F6",
      50: "#F9FAFB",
    },
    white: "#FFFFFF",
    green: {
      50: "#F0FDF4",
      700: "#15803D",
    },
    red: {
      50: "#FEF2F2",
      /** F-1（C12）：`danger` 按鈕的按壓底色；原本與 `bg` 同值（皆 red-50）導致零回饋 */
      100: "#FEE2E2",
      700: "#B91C1C",
      /** F-1（C12）：`dangerSolid` 按鈕的按壓底色；原本與 `bg` 同值（皆 red-700）導致零回饋 */
      800: "#991B1B",
    },
    amber: {
      50: "#FFFBEB",
      700: "#B45309",
    },
  },
  alpha: {
    overlay: "rgba(17, 24, 39, 0.55)",
    scrimCamera: "rgba(3, 7, 18, 0.62)",
    scrimCameraStrong: "rgba(3, 7, 18, 0.82)",
    pressedOnLight: "rgba(17, 24, 39, 0.06)",
    pressedOnDark: "rgba(255, 255, 255, 0.18)",
  },
  numeric: {
    fontSizes: {
      badge: 11,
      micro: 12,
      caption: 13,
      label: 14,
      body: 15,
      bodyLg: 16,
      h3: 17,
      h2: 20,
      h1: 24,
      display: 28,
    },
    lineHeights: {
      badge: 15,
      micro: 18,
      caption: 20,
      label: 22,
      body: 24,
      bodyLg: 26,
      h3: 24,
      h2: 28,
      h1: 34,
      display: 38,
    },
    weights: {
      regular: "400",
      medium: "500",
      semibold: "600",
    },
    space: {
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      7: 32,
      8: 48,
    },
    radius: {
      none: 0,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      full: 999,
    },
  },
} as const;

/* ==========================================================================
 * 幾何（Geometry）— spacing / radius / layout / 字體階層 / elevation
 * ========================================================================== */

/** 8pt 基礎間距刻度；`space[1] = 4` 為唯一非 8 倍數的例外（hairline gap） */
export const space = primitive.numeric.space;

/** 語意間距 alias —— 元件層請優先使用這一組，而非裸數字 */
export const spacing = {
  /** 頁面版心左右內距 */
  screen: space[5],
  /** 卡片內距 */
  card: space[4],
  /** 元素間距 */
  gap: space[3],
  /** 區塊之間 */
  section: space[6],
  /** 區塊群組之間 */
  group: space[7],
  /** 頁尾呼吸空間（避免被 tab bar 遮擋） */
  safeFooter: space[8],
} as const;

export const radius = {
  sm: primitive.numeric.radius.sm,
  md: primitive.numeric.radius.md,
  lg: primitive.numeric.radius.lg,
  xl: primitive.numeric.radius.xl,
  full: primitive.numeric.radius.full,
} as const;

/** 觸控目標與固定容器尺寸（WCAG 2.5.5 / 本案凍結門檻） */
export const layout = {
  /** 最小觸控目標（不用 44 當下限） */
  touchMin: 48,
  /** 主要 CTA 高度 */
  ctaHeight: 56,
  /** 一般按鈕高度 */
  buttonHeight: 48,
  /** 相鄰觸控目標最小間距 */
  touchGapMin: 8,
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    hero: 64,
  },
  /** Tab bar 內容高度（不含 safe-area bottom inset） */
  tabBarHeight: 52,
  /** ScreenHeader 高度（不含 safe-area top inset） */
  headerHeight: 56,
  /** 固定容器內文字縮放上限（badge / chip / 按鈕） */
  maxFontScaleFixed: 1.3,
  /** 一般正文縮放上限 */
  maxFontScaleBody: 1.6,
  /** 小螢幕斷點（低於此寬度時 StatTile 轉 2×2） */
  breakpointNarrow: 360,
} as const;

/**
 * 繁中字型：必須顯式指定，否則 iOS/Android 標點會退回簡中樣式。
 * 未在 allowlist 內的平台一律「不設 fontFamily」，交給系統預設（優雅降級，不崩潰）。
 */
const cjkFontFamily = Platform.select<string | undefined>({
  ios: "PingFang TC",
  android: "Noto Sans TC",
  default: undefined,
});

const fontFamily = {
  /** 繁中正文／標題 */
  sans: cjkFontFamily,
  /** 等寬（tagUid / activationToken / URL） */
  mono: Platform.select<string | undefined>({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
  /** 西文數字裝飾（僅用於 QR 交付頁的大數字，不套負 letter-spacing） */
  display: Platform.select<string | undefined>({
    ios: "SF Pro Display",
    android: "sans-serif-medium",
    default: undefined,
  }),
} as const;

type TypeTokenName =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "bodyLg"
  | "body"
  | "label"
  | "caption"
  | "micro"
  | "badge"
  | "mono"
  | "monoSm";

/**
 * 字體階層（繁中調校）
 * - 標題僅 3 階（h1 24 / h2 20 / h3 17），修正現況 5 種標題字級的破碎問題
 * - 正文 lineHeight ≥ 1.5×（實際 1.5–1.63），標題 1.36–1.42，badge 1.36
 * - 繁中標題字重 600（非 700）；≤14px 一律不用 700
 */
export const type: Record<TypeTokenName, TextStyle> = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.display,
    lineHeight: primitive.numeric.lineHeights.display,
    fontWeight: primitive.numeric.weights.semibold,
    letterSpacing: 0,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.h1,
    lineHeight: primitive.numeric.lineHeights.h1,
    fontWeight: primitive.numeric.weights.semibold,
    letterSpacing: 0,
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.h2,
    lineHeight: primitive.numeric.lineHeights.h2,
    fontWeight: primitive.numeric.weights.semibold,
    letterSpacing: 0,
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.h3,
    lineHeight: primitive.numeric.lineHeights.h3,
    fontWeight: primitive.numeric.weights.semibold,
    letterSpacing: 0,
  },
  bodyLg: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.bodyLg,
    lineHeight: primitive.numeric.lineHeights.bodyLg,
    fontWeight: primitive.numeric.weights.regular,
    letterSpacing: 0,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.body,
    lineHeight: primitive.numeric.lineHeights.body,
    fontWeight: primitive.numeric.weights.regular,
    letterSpacing: 0,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.label,
    lineHeight: primitive.numeric.lineHeights.label,
    fontWeight: primitive.numeric.weights.medium,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.caption,
    lineHeight: primitive.numeric.lineHeights.caption,
    fontWeight: primitive.numeric.weights.regular,
    letterSpacing: 0,
  },
  micro: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.micro,
    lineHeight: primitive.numeric.lineHeights.micro,
    fontWeight: primitive.numeric.weights.medium,
    letterSpacing: 0,
  },
  badge: {
    fontFamily: fontFamily.sans,
    fontSize: primitive.numeric.fontSizes.badge,
    lineHeight: primitive.numeric.lineHeights.badge,
    fontWeight: primitive.numeric.weights.semibold,
    letterSpacing: 0,
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: primitive.numeric.fontSizes.label,
    lineHeight: primitive.numeric.lineHeights.label,
    fontWeight: primitive.numeric.weights.regular,
    letterSpacing: 0,
  },
  monoSm: {
    fontFamily: fontFamily.mono,
    fontSize: primitive.numeric.fontSizes.caption,
    lineHeight: primitive.numeric.lineHeights.caption,
    fontWeight: primitive.numeric.weights.regular,
    letterSpacing: 0,
  },
};

/**
 * 陰影策略（凍結 D-3）：卡片 = 白底 + 細邊框，**不用陰影**。
 * 只有浮層可用；以 factory 形式提供，讓「忘記設底色」在結構上不可能發生。
 *
 * P1（R2/R3）：改為單一 `boxShadow` 字串（CSS 語法），三平台一致：
 * - RN 0.86.2：`boxShadow` 為原生樣式屬性（`ReactNativeStyleAttributes.boxShadow`）
 * - react-native-web 0.21.2：`StyleSheet/preprocess` 將字串直接透傳為 CSS `box-shadow`
 * 原本 `Platform.select` 的 `default` 分支（web）只有 `backgroundColor`，
 * 導致 BottomSheet / ScanStepShell footer 在 web 完全沒有 elevation（R2）；
 * 且 `shadow*` props 為 RNW 已棄用寫法（R3）。
 *
 * 陰影色 = `primitive.palette.gray[950]` 依原 `shadowOpacity`（0.12 / 0.10）合成的 rgba。
 * `backgroundColor` 保留：浮層必須是不透明的 `surface` 底色。
 */
const elevation = {
  /** 平面：卡片、清單項、統計卡 */
  flat: {} as ViewStyle,
  /** 浮起：BottomSheet、Modal、Popover */
  raised: (surface: string = primitive.palette.white): ViewStyle => ({
    backgroundColor: surface,
    /** `rgba(3, 7, 18, ...)` = primitive.palette.gray[950] @ 12% */
    boxShadow: "0px 3px 12px rgba(3, 7, 18, 0.12)",
  }),
  /** 由上緣浮起：底部固定 CTA 容器 */
  overlay: (surface: string = primitive.palette.white): ViewStyle => ({
    backgroundColor: surface,
    /** `rgba(3, 7, 18, ...)` = primitive.palette.gray[950] @ 10% */
    boxShadow: "0px -2px 16px rgba(3, 7, 18, 0.10)",
  }),
} as const;

/* ==========================================================================
 * Layer 2 — Semantic（元件層唯一可引用的一層）
 * ========================================================================== */
export const semantic = {
  text: {
    primary: primitive.palette.gray[900],
    secondary: primitive.palette.gray[700],
    muted: primitive.palette.gray[600],
    link: primitive.palette.purple[600],
    danger: primitive.palette.red[700],
    /** 紫底／深色底上的文字。與 text.primary 分離，避免零對比陷阱 */
    onPrimary: primitive.palette.white,
    /** 白底上的 disabled 標籤（4.83，唯一允許的淺灰文字下限） */
    disabled: primitive.palette.gray[500],
  },
  bg: {
    /** 頁面底 */
    canvas: primitive.palette.gray[50],
    /** 卡片／輸入框底 */
    surface: primitive.palette.white,
    /** 內凹區塊底（如展開的卡片清單底） */
    surfaceSunken: primitive.palette.gray[100],
    /** 品牌極淺底（tab active pill、選中態） */
    brandSoft: primitive.palette.purple[50],
    /** 品牌淺底（次要 chip / tag 底） */
    brandSoftStrong: primitive.palette.purple[100],
    /** Modal 遮罩 */
    overlay: primitive.alpha.overlay,
    /** 相機遮罩（深色，承載可讀文字） */
    scrim: primitive.alpha.scrimCamera,
    /** 相機遮罩（較重，用於鎖定層） */
    scrimStrong: primitive.alpha.scrimCameraStrong,
    /** 按壓回饋（淺色底上） */
    pressedOnLight: primitive.alpha.pressedOnLight,
    /** 按壓回饋（深色底上） */
    pressedOnDark: primitive.alpha.pressedOnDark,
  },
  border: {
    /** 裝飾用（卡片、分隔線）。**不可**用於互動元素邊界 */
    decorative: primitive.palette.gray[200],
    /** 裝飾用（更淡的內層分隔） */
    decorativeSubtle: primitive.palette.gray[100],
    /** 互動邊界：輸入框、checkbox、chip、按鈕外框（4.83 ≥ 3:1） */
    interactive: primitive.palette.gray[500],
    /** 互動邊界（選中／品牌態） */
    interactiveSelected: primitive.palette.purple[600],
    /** 聚焦環 */
    focus: primitive.palette.purple[600],
    /** 錯誤邊界（非文字，≥3:1） */
    danger: primitive.palette.red[700],
  },
  action: {
    primary: primitive.palette.purple[600],
    primaryPressed: primitive.palette.purple[700],
    /** disabled 底（淺紫，搭 text.onPrimary 為低對比 → 另見 §3.3 Button 規格） */
    primaryDisabled: primitive.palette.purple[100],
    /**
     * disabled 底（最終採用：中性灰底 + `text.disabled` 標籤）。
     *
     * **L-1 結案**：原為 `gray[100]`（#F3F4F6）→ 標籤 `#6B7280` on `#F3F4F6` = **4.39:1**。
     * disabled 按鈕標籤是 16px/600，不屬 WCAG 的 large text，需達 4.5:1。
     * 改走 `gray[50]`（#F9FAFB）→ **4.63:1** ✅（實測值見本輪回報）。
     * 唯一消費者為 `components.button.disabled.bg`（`Chip` / `FieldInput` 的 disabled
     * 路徑目前無實際呼叫點）。
     *
     * **L-3 更正（R6）**：本註解原記 `4.59:1`，與同一色對在計畫 §1.3 及附錄 A.6 的
     * `4.63` 不一致。重算 `#6B7280` on `#F9FAFB` = **4.6259:1** → 取 **4.63:1**。
     * 僅更正註解數值，**未動任何 token 值**。
     */
    primaryDisabledBg: primitive.palette.gray[50],
    onPrimary: primitive.palette.white,
    secondaryBg: primitive.palette.white,
    secondaryLabel: primitive.palette.purple[600],
    ghostLabel: primitive.palette.purple[600],
    dangerBg: primitive.palette.red[50],
    dangerLabel: primitive.palette.red[700],
    dangerSolid: primitive.palette.red[700],
  },
  icon: {
    default: primitive.palette.gray[600],
    inverse: primitive.palette.white,
    brand: primitive.palette.purple[600],
    /** tab bar 未選中（非文字，4.83 ≥ 3:1） */
    muted: primitive.palette.gray[600],
    disabled: primitive.palette.gray[500],
    danger: primitive.palette.red[700],
  },
  status: {
    /** 可用（卡片庫存）— #6D28D9 on #F3E8FF = 6.02 */
    available: {
      fg: primitive.palette.purple[700],
      bg: primitive.palette.purple[100],
      border: primitive.palette.purple[600],
    },
    /** 待認領 / 進行中 — #6D28D9 on #FAF5FF ≥ 5.31 */
    pending: {
      fg: primitive.palette.purple[700],
      bg: primitive.palette.purple[50],
      border: primitive.palette.purple[600],
    },
    /** 已寫 / 已認領 — #15803D on #F0FDF4 = 4.79 */
    success: {
      fg: primitive.palette.green[700],
      bg: primitive.palette.green[50],
      border: primitive.palette.green[700],
    },
    /** 注意 / 低光源 — #B45309 on #FFFBEB = 4.84 */
    warning: {
      fg: primitive.palette.amber[700],
      bg: primitive.palette.amber[50],
      border: primitive.palette.amber[700],
    },
    /** 錯誤 / 損壞 — #B91C1C on #FEF2F2 = 5.91 */
    danger: {
      fg: primitive.palette.red[700],
      bg: primitive.palette.red[50],
      border: primitive.palette.red[700],
    },
    /** 中性（已交付 / 已過期）— #374151 on #F3F4F6 = 9.24 */
    neutral: {
      fg: primitive.palette.gray[700],
      bg: primitive.palette.gray[100],
      border: primitive.palette.gray[200],
    },
  },
  /** 唯讀資訊列底色（灰底，永遠不是「狀態」） */
  surfaceSunken: primitive.palette.gray[100],
} as const;

/* ==========================================================================
 * Layer 3 — Components（元件別 alias；色彩 + 幾何綁定）
 * ========================================================================== */
export const components = {
  button: {
    primary: {
      bg: semantic.action.primary,
      bgPressed: semantic.action.primaryPressed,
      label: semantic.action.onPrimary,
      borderColor: "transparent",
      borderWidth: 0,
      minHeight: layout.ctaHeight,
      paddingHorizontal: space[5],
      radius: radius.md,
    },
    secondary: {
      bg: semantic.action.secondaryBg,
      bgPressed: semantic.bg.brandSoft,
      label: semantic.action.secondaryLabel,
      borderColor: semantic.border.interactiveSelected,
      borderWidth: 1,
      minHeight: layout.buttonHeight,
      paddingHorizontal: space[5],
      radius: radius.md,
    },
    ghost: {
      bg: "transparent",
      bgPressed: semantic.bg.brandSoft,
      label: semantic.action.ghostLabel,
      borderColor: "transparent",
      borderWidth: 0,
      minHeight: layout.buttonHeight,
      paddingHorizontal: space[4],
      radius: radius.md,
    },
    danger: {
      bg: semantic.action.dangerBg,
      /**
       * F-1（C12）：原為 `semantic.status.danger.bg`，與 `bg` **同值** → 按壓無底色變化。
       * 改走更深的 red-100；標籤 `#B91C1C` on `#FEE2E2` = 5.30 ✅（AA 正文）
       */
      bgPressed: primitive.palette.red[100],
      label: semantic.action.dangerLabel,
      borderColor: semantic.border.danger,
      borderWidth: 1,
      minHeight: layout.buttonHeight,
      paddingHorizontal: space[5],
      radius: radius.md,
    },
    dangerSolid: {
      bg: semantic.action.dangerSolid,
      /**
       * F-1（C12）：原為 `primitive.palette.red[700]`，與 `bg` **同值** → 按壓無底色變化。
       * 改走更深的 red-800；白字 on `#991B1B` = 8.31 ✅
       */
      bgPressed: primitive.palette.red[800],
      label: semantic.action.onPrimary,
      borderColor: "transparent",
      borderWidth: 0,
      minHeight: layout.buttonHeight,
      paddingHorizontal: space[5],
      radius: radius.md,
    },
    disabled: {
      bg: semantic.action.primaryDisabledBg,
      label: semantic.text.disabled,
      borderColor: semantic.border.decorative,
      borderWidth: 1,
    },
  },
  card: {
    bg: semantic.bg.surface,
    borderColor: semantic.border.decorative,
    borderWidth: 1,
    radius: radius.lg,
    padding: space[4],
    /** 卡片不做陰影（凍結 D-3） */
    elevation: elevation.flat,
  },
  cardSunken: {
    bg: semantic.bg.surfaceSunken,
    borderColor: semantic.border.decorative,
    borderWidth: 1,
    radius: radius.md,
    padding: space[3],
    elevation: elevation.flat,
  },
  badge: {
    radius: radius.full,
    paddingHorizontal: space[2],
    minHeight: 24,
    justifyContent: "center",
    borderWidth: 1,
    iconSize: layout.icon.sm,
    gap: space[1],
  },
  chip: {
    radius: radius.full,
    paddingHorizontal: space[4],
    minHeight: layout.touchMin,
    borderWidth: 1,
    gap: space[2],
    inactive: {
      bg: semantic.bg.surface,
      borderColor: semantic.border.interactive,
      label: semantic.text.secondary,
    },
    active: {
      bg: semantic.action.primary,
      borderColor: semantic.action.primary,
      label: semantic.action.onPrimary,
    },
  },
  field: {
    bg: semantic.bg.surface,
    borderColor: semantic.border.interactive,
    borderColorFocused: semantic.border.focus,
    borderColorError: semantic.border.danger,
    borderWidth: 1,
    radius: radius.sm,
    minHeight: layout.buttonHeight + space[2],
    paddingHorizontal: space[4],
    radiusFocused: radius.sm,
    /** 聚焦環寬度（外框 + 內描邊雙軌以避開 Android 不支援 outline 的限制） */
    focusRingWidth: 2,
  },
  tabBar: {
    height: layout.tabBarHeight,
    bg: semantic.bg.surface,
    borderColor: semantic.border.decorative,
    activeLabel: semantic.action.primary,
    inactiveLabel: semantic.icon.muted,
    activePillBg: semantic.bg.brandSoft,
    activePillRadius: radius.md,
    iconSize: layout.icon.lg,
  },
  header: {
    height: layout.headerHeight,
    bg: semantic.bg.canvas,
    titleColor: semantic.text.primary,
  },
  sheet: {
    bg: semantic.bg.surface,
    radius: radius.xl,
    padding: space[5],
    handleColor: semantic.border.decorative,
  },
  skeleton: {
    base: primitive.palette.gray[100],
    highlight: primitive.palette.gray[200],
    radius: radius.sm,
  },
  focusRing: {
    color: semantic.border.focus,
    width: 2,
  },
} as const;

/* ==========================================================================
 * 相容層（deprecated）已於 C12 完全移除
 *
 * C1 為了讓 26 個引用 `theme.ts` 的檔案逐檔遷移而不破壞編譯，曾保留
 * `colors` / `typography` / `spacing.screenPadding` / `spacing.cardPadding` 四個
 * deprecated export。C2–C11 已將所有呼叫點改為 `semantic.*` / `type.*` /
 * `spacing.screen` / `spacing.card`，因此 C12 一次移除；若仍有殘留引用，
 * `npx tsc --noEmit` 會精確指出檔名行號（計畫 §7.2 C12 / §8.4 R8）。
 * ========================================================================== */

/** hairline 分隔線寬度 */
export const hairline = StyleSheet.hairlineWidth;

/**
 * 建議的 metadata 列樣式組合（避免各頁重複手寫）
 * 使用方式：`<Text style={[type.caption, metaText]} maxFontSizeMultiplier={layout.maxFontScaleBody} />`
 */
export const metaText: TextStyle = { color: semantic.text.muted };
