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
