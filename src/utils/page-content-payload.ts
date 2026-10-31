import type {
  PageSection,
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
