import type { BadgeType, CreateNfcBatchParams } from "@/types/api.types";

/**
 * 建立 badge 批次的**純規則**：輸入驗證 + 二次確認要顯示的內容。
 *
 * ## 為什麼驗證要住在這裡而不是 dialog 裡
 *
 * Web 把驗證寫在 `handleCreateBatch` 裡（`Number.isInteger(n) && n >= 1 &&
 * n <= 500`、`isValidCssColor`）。那種寫法只有在「按下按鈕」時才會跑，於是
 * 「什麼算合法」變成一個只能靠手動點擊確認的規則。放在這裡，`tests/badge-batch.test.mjs`
 * 可以逐條釘住邊界（1、500、501、0、"abc"、"5.5"、空字串），而畫面只負責
 * 把錯誤鍵換成文案。
 *
 * ## 上限／下限的來源不是 Web，是後端
 *
 * `BE:src/events/dtos/event-nfc-batch.dto.ts` 的 `count` 是
 * `@IsInt() @Min(1) @Max(500)`。Web 只是**提前**把那組數字複製到前端；
 * 這裡也一樣，但把數字寫成常數，兩邊都指向同一份 DTO。
 *
 * ## 色碼為什麼用「CSS 色集合」而不是本 repo 的 `isValidHexColor`
 *
 * `utils/event-settings-config.ts` 的 `isValidHexColor` 只認 `#rgb` / `#rrggbb`
 * ——那是**活動主題色的預覽護欄**，不是通用色碼驗證。Web 的批次表單用的是
 * `isValidCssColor`（`FE:lib/events/colorUtils.ts`），另外接受 `rgb()`／
 * `rgba()`／`hsl()`／`hsla()`。若這裡改用 hex-only 那支，操作員把
 * `rgb(124,58,237)` 貼進來會被擋——**App 就比 Web 少做了一件事**。
 * 所以照抄 Web 的集合，並在測試裡把兩邊的判定表釘成一樣。
 *
 * 注意後端對 `colorCode` 只有 `@IsString()`，**沒有格式驗證**——這一層是
 * 純前端護欄（避免把任意字串塞進會當 `backgroundColor` 用的欄位）。
 */

/** 後端 `CreateNfcBatchDto.count` 的 `@Min(1)`。 */
export const CREATE_BATCH_MIN = 1;

/** 後端 `CreateNfcBatchDto.count` 的 `@Max(500)`。 */
export const CREATE_BATCH_MAX = 500;

/** 建立失敗的原因鍵。畫面負責換成文案（這裡不引用 `copy`）。 */
export type CreateBatchError = "countRange" | "colorFormat";

/** 表單的原始輸入（全部是字串，因為它們來自 `TextInput`）。 */
export interface CreateBatchInput {
  count: string;
  badgeType: BadgeType | null;
  colorCode: string;
  batchLabel: string;
}

export type CreateBatchParseResult =
  | { ok: true; params: CreateNfcBatchParams }
  | { ok: false; error: CreateBatchError };

/**
 * 這段字串能不能安全地當 CSS 顏色用。
 *
 * 判定集合**逐條對齊** `FE:lib/events/colorUtils.ts` 的 `isValidCssColor`
 * （hex 3/4/6/8、rgb()、rgba()、hsl()、hsla()）。刻意不檢查通道值是否
 * ≤255——Web 也不檢查，而多檢查會讓同一份輸入在兩平台得到不同結果。
 */
export function isValidBadgeColor(value: string): boolean {
  if (!value) return false;
  return (
    /^#[0-9A-Fa-f]{3}$/.test(value) ||
    /^#[0-9A-Fa-f]{4}$/.test(value) ||
    /^#[0-9A-Fa-f]{6}$/.test(value) ||
    /^#[0-9A-Fa-f]{8}$/.test(value) ||
    /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(value) ||
    /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(
      value,
    ) ||
    /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/.test(value) ||
    /^hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(
      value,
    )
  );
}

/**
 * 表單 → 請求參數。
 *
 * 三個選填欄位一律**先 `trim()` 再判斷「有沒有值」**：Web 也是這樣
 * （`colorCode.trim() || undefined`），而空白字串若照送會讓後端存進一個
 * 看起來不存在、實際上存在的空色碼。
 *
 * 空字串／null 的 `badgeType` 代表「不指定」——後端會自己套預設 `CARD`
 * （`CreateNfcBatchDto` 的註解），前端不猜。
 */
export function parseCreateBatchInput(
  input: CreateBatchInput,
): CreateBatchParseResult {
  const count = Number(input.count);
  if (
    !Number.isInteger(count) ||
    count < CREATE_BATCH_MIN ||
    count > CREATE_BATCH_MAX
  ) {
    return { ok: false, error: "countRange" };
  }

  const colorCode = input.colorCode.trim();
  if (colorCode && !isValidBadgeColor(colorCode)) {
    return { ok: false, error: "colorFormat" };
  }

  const batchLabel = input.batchLabel.trim();

  return {
    ok: true,
    params: {
      count,
      ...(input.badgeType ? { badgeType: input.badgeType } : {}),
      ...(colorCode ? { colorCode } : {}),
      ...(batchLabel ? { batchLabel } : {}),
    },
  };
}

/** 建立批次的二次確認要顯示什麼（畫面負責套文案）。 */
export interface CreateBatchConfirmation {
  count: number;
  badgeType: BadgeType | null;
  colorCode: string | null;
  batchLabel: string | null;
}

/**
 * 確認框的內容。
 *
 * 三件事必須在按下確認前看得到，因為它們之後都改不了（批次一旦建立，
 * `batchId` 就固定了；色碼與名稱只能靠肉眼在建之前確認）：
 * **張數**、**載體類型**、**批次名稱**。色碼有填才顯示。
 */
export function buildCreateBatchConfirmation(
  params: CreateNfcBatchParams,
): CreateBatchConfirmation {
  return {
    count: params.count,
    badgeType: params.badgeType ?? null,
    colorCode: params.colorCode ?? null,
    batchLabel: params.batchLabel ?? null,
  };
}

// ---------------------------------------------------------------------------
// 完成批次（回填實體 tagUid）
// ---------------------------------------------------------------------------

/** 完成批次失敗的原因鍵。 */
export type CompleteBatchError = "completeFormat" | "duplicateBadgeId";

/** 一筆回填。 */
export interface CompleteBatchLine {
  badgeId: string;
  realTagUid: string;
}

export type CompleteBatchParseResult =
  | { ok: true; updated: CompleteBatchLine[] }
  | { ok: false; error: CompleteBatchError };

/**
 * 把多行文字解析成回填清單。
 *
 * ## 格式與 Web 完全相同
 *
 * 每行 `badgeId,realTagUid`，空白行忽略，兩端空白 `trim()`。
 * Web 的 `handleComplete` 就是這樣切。
 *
 * ## 多出來的欄位**刻意忽略**
 *
 * `badgeId,realTagUid,備註` 這種從試算表貼上來的三欄資料很常見，
 * Web 的 `const [badgeId, realTagUid] = line.split(',')` 也是取了前兩欄就
 * 不管後面。照抄——把「多一欄」變成錯誤只會讓現場貼不上。
 *
 * ## 與 Web 的差異：重複的 `badgeId` **擋下來**
 *
 * Web 不檢查重複。同一個 `badgeId` 出現兩次時，後端會**逐筆套用**，於是
 * 第二筆的 `realTagUid` 覆蓋第一筆——而手環是**一次性**的：第一張手環的
 * UID 已經被寫進去了，卻從記錄上消失，現場沒有任何方式還原。
 *
 * 這是「照抄 Web 會造成資料遺失」的情形，所以擋。錯誤鍵分開
 * （`duplicateBadgeId` 而不是併進 `completeFormat`），因為處置方式不同：
 * 格式錯要重貼，重複要**挑出哪一筆才對**。
 */
export function parseCompleteBatchInput(
  text: string,
): CompleteBatchParseResult {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { ok: false, error: "completeFormat" };

  const updated: CompleteBatchLine[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const [badgeId, realTagUid] = line.split(",").map((part) => part.trim());
    if (!badgeId || !realTagUid) return { ok: false, error: "completeFormat" };
    if (seen.has(badgeId)) return { ok: false, error: "duplicateBadgeId" };
    seen.add(badgeId);
    updated.push({ badgeId, realTagUid });
  }

  return { ok: true, updated };
}

/** 完成批次的二次確認要顯示什麼（畫面負責套文案）。 */
export interface CompleteBatchConfirmation {
  count: number;
  /** 前幾筆，供人眼核對（完整清單可能上百筆，確認框放不下）。 */
  preview: CompleteBatchLine[];
  /** 還有幾筆沒列進 `preview`。 */
  remaining: number;
}

/**
 * 確認框的內容。
 *
 * 為什麼要顯示前幾筆而不是只顯示「共 N 筆」：貼錯整欄（例如把 `realTagUid`
 * 貼到 `badgeId` 那一欄）時，筆數完全正常，只有內容看得出來。
 */
export function buildCompleteBatchConfirmation(
  updated: readonly CompleteBatchLine[],
  previewSize = 3,
): CompleteBatchConfirmation {
  return {
    count: updated.length,
    preview: updated.slice(0, previewSize),
    remaining: Math.max(0, updated.length - previewSize),
  };
}
