import type {
  PageCardPayload,
  PageSection,
  PageSectionCard,
  PageSectionGridColumns,
  PageSectionPayload,
} from "@/types/api.types";

/**
 * 落地頁區塊的「表單狀態 → PATCH body」純函式。
 *
 * 為什麼要抽出來：後端 `UpdateEventPageSectionDto` 的每個欄位都是
 * `@ValidateIf(isProvided)`，而 service 端用 `hasOwn(dto, ...)` 決定要不要寫
 * （`EventPageContentService.ts:103-116`）。也就是「送什麼」＝「改什麼」，
 * 送錯一格就是靜默改壞一格。這種規則必須能被 Node 直接測，而
 * `content.tsx` 是畫面——這個 repo 沒有 jsdom／RN renderer，畫面跑不起來
 * （`tests/journeys/j-checkin-state.test.mjs` 的檔頭記載了同一條界線）。
 *
 * ## 與 Web 一字不差的兩條規則
 * 1. `title: title || null`：清空輸入框要送 `null`（＝清空），不是 `""`
 *    （`content/page.tsx:127-132`）。送 `""` 會通過 `IsString` 但被後端
 *    `normalizeNullableText` 轉成 `null`，結果一樣，但語意要靠後端猜；
 *    直接送 `null` 才是明確的「清空」。
 * 2. `gridColumns` 一律帶上，且值域只有 1／2／3。
 *
 * ## App 多的一條防護
 * `gridColumns` 若出現 1／2／3 以外的值（後端 enum 有預設值 2，但型別上是
 * 可選），三顆晶片會全部沒選中，使用者看起來像「欄數不見了」。所以比照
 * `profile.tsx` 的 `toStatus` 退回預設值 2——不吞資訊，只是不把非法值送出去。
 */
export interface SectionFormState {
  title: string;
  description: string;
  gridColumns: PageSectionGridColumns;
  isPublished: boolean;
}

/** 後端 `EventPageContentService.DEFAULT_SECTION_GRID_COLUMNS` 的同一個值。 */
export const DEFAULT_SECTION_GRID_COLUMNS: PageSectionGridColumns = 2;

/** 晶片順序（與 Web 的 `<select>` 選項順序一致）。 */
export const SECTION_GRID_COLUMN_OPTIONS: PageSectionGridColumns[] = [1, 2, 3];

/**
 * 區塊標題上限。
 *
 * 後端是 `@MaxLength(80)`，訊息是英文（`section title cannot exceed 80 characters`），
 * 直接端給現場人員等於沒說。Web 沒有 `maxLength`，超出就吃一個英文 400；
 * App 提前擋在輸入層，網路上不會出現這一發。見檔頭的偏離說明。
 */
export const SECTION_TITLE_MAX = 80;

/** 區塊說明上限（後端 `@MaxLength(240)`）。 */
export const SECTION_DESCRIPTION_MAX = 240;

function toGridColumns(value?: number | null): PageSectionGridColumns {
  return value === 1 || value === 2 || value === 3
    ? value
    : DEFAULT_SECTION_GRID_COLUMNS;
}

/** 伺服器回來的區塊 → 表單狀態（`null` 一律變空字串，供受控輸入使用）。 */
export function toSectionFormState(section: PageSection): SectionFormState {
  return {
    title: section.title ?? "",
    description: section.description ?? "",
    gridColumns: toGridColumns(section.gridColumns),
    isPublished: section.isPublished,
  };
}

/**
 * 表單狀態 → PATCH body。
 *
 * 欄位集合**恰好四個**，一個不多（多了就是多改一格），與 Web 的
 * `handleSave` 逐字對應。
 */
export function toSectionPayload(form: SectionFormState): PageSectionPayload {
  return {
    title: form.title || null,
    description: form.description || null,
    gridColumns: form.gridColumns,
    isPublished: form.isPublished,
  };
}

// ---------------------------------------------------------------------------
// 卡片（card）
// ---------------------------------------------------------------------------

/**
 * 卡片編輯表單。
 *
 * ⚠️ **只有五欄**。`PageSectionCard` 上還有 `badgeText`／`iconKey`／`imageUrl`
 * 三個事件頁改不到的欄位，它們**不進表單**，也因此不會進 PATCH body。
 * 理由見 `content.service.ts` 檔頭：後端 `updateCard` 逐欄 `hasOwn`，
 * 送 `null` 就是清空——在 Web 上傳的卡片圖會被手機清掉。
 */
export interface CardFormState {
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
  isPublished: boolean;
}

/** 卡片標題上限（後端 `@MaxLength(60)` ＋ `@IsNotEmpty`）。 */
export const CARD_TITLE_MAX = 60;

/** 卡片說明上限（後端 `@MaxLength(200)`）。 */
export const CARD_DESCRIPTION_MAX = 200;

/** 按鈕文字上限（後端 `@MaxLength(24)`）。 */
export const CARD_ACTION_LABEL_MAX = 24;

/** 伺服器回來的卡片 → 表單狀態。`title` 是必填，不會是 null。 */
export function toCardFormState(card: PageSectionCard): CardFormState {
  return {
    title: card.title,
    description: card.description ?? "",
    actionLabel: card.actionLabel ?? "",
    actionUrl: card.actionUrl ?? "",
    isPublished: card.isPublished,
  };
}

/**
 * 卡片表單 → PATCH body。
 *
 * **欄位集合恰好五個，一個不多。** 這不是風格問題，是資料保全：
 * `badgeText`／`iconKey`／`imageUrl` 一旦出現在 body 裡（哪怕是原值，
 * 更不用說是 `null`），後端 `hasOwn` 就會把它們寫進去。`imageUrl: null`
 * 等於把 Web 上傳的卡片圖刪掉，而且沒有任何錯誤、沒有任何提示。
 *
 * 注意 `title` 與其他欄的處理**不同**：
 * - 其餘欄位 `x || null`（清空送 null，不是空字串）。
 * - `title` 原樣送出。後端 `UpdateEventPageCardDto.title` 是
 *   `@ValidateIf(isProvided) @IsNotEmpty`，空字串會被擋成 400
 *   `card title cannot be empty`。Web 也是原樣送，這裡不改寫行為——
 *   硬把它轉成 `null` 反而會**跳過**驗證變成靜默不更新。
 */
export function toCardPayload(form: CardFormState): PageCardPayload {
  return {
    title: form.title,
    description: form.description || null,
    actionLabel: form.actionLabel || null,
    actionUrl: form.actionUrl || null,
    isPublished: form.isPublished,
  };
}
