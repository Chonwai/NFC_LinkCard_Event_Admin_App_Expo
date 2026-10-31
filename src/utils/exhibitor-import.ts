import { copy } from "@/constants/copy.zh-TW";
import type { ExhibitorImportPreview } from "@/types/exhibitor.types";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/api-error";

/**
 * 展商名單匯入的**純規則**（不碰畫面、不碰網路）。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/exhibitorImport.ts`。
 * 那一支把「打 API」與「組錯誤報表」混在同一個檔案裡；App 分成兩層——
 * 呼叫在 `src/services/exhibitor.service.ts`，規則在這裡。理由與
 * `utils/guest-import.ts` 相同：畫面只負責排版，規則要能被 Node 測試直接
 * 載入（不打網路、不載入 RN）。
 */

/**
 * 預覽表格的顯示上限。**照抄 Web 的 `MAX_PREVIEW_ROWS`**（import 頁 `:57`）。
 *
 * 為什麼要有上限：500 列的匯入如果全畫出來，手機上會變成一份無法掃視的
 * 清單，而且真正要看的「哪幾列有錯」會被淹掉。Web 也是只列前 100 列，並用
 * 一句「僅顯示前 N 列」交代其餘——**不假裝這就是全部**。
 */
export const MAX_PREVIEW_ROWS = 100;

/**
 * 把後端錯誤碼翻成操作員看得懂的一句話。
 *
 * 順序與 Web 相同：**先認得 code，再退回後端訊息，最後才用泛用字串**。
 *
 * 為什麼不能只用 `getApiErrorMessage`：後端對同一個狀態可能回中文訊息，也可能
 * 回英文 fallback（`mapError` 的預設字串是
 * `'Failed to preview exhibitor import'`）。直接顯示那個字串，操作員會看到一句
 * 他無法行動的英文；而 `FILE_TOO_LARGE` 這種碼我們其實知道該怎麼講。
 *
 * 誠實邊界：認不得的 code 仍然顯示後端訊息（如果有的話）。**不吞掉它**——
 * 一句看不懂的英文訊息，比一句聽起來很合理但不對的中文好。
 */
export function importErrorText(error: unknown): string {
  const code = getApiErrorCode(error);
  const table: Record<string, string> = copy.exhibitors.import.errors;
  const known = code != null && code in table ? table[code] : null;
  return (
    known ?? getApiErrorMessage(error, copy.exhibitors.import.errors.UNKNOWN)
  );
}

/**
 * 這份預覽能不能按「確認匯入」。
 *
 * **這是 App 與 Web 的刻意差異**，不是實作漏洞。
 *
 * Web 的 disable 條件只有 `preview.summary.valid === 0`
 * （`exhibitors/import/page.tsx:481`），所以 500 列裡有 1 列錯時，按下去會
 * **建立其餘 499 家**，而畫面上那句「有錯誤 1」不會阻止任何人。事後沒有任何
 * 畫面能解釋「我匯了 500 筆，結果只有 499 家」。
 *
 * App 沿用 `registrations` 匯入已拍板的同一條規則
 * （`utils/guest-import.ts` 的 `hasBlockingRows`）：**有一列無效就整批不給
 * 匯入**。重跑是安全的——後端 `confirm` 是 per-row 交易且 `skip_existing`
 * 冪等，同一份檔案再送一次不會重複建立。
 *
 * 還有一個條件：`summary.valid === 0` 時也不能按（與 Web 相同）。一列都建不
 * 出來的匯入不是匯入，是同一個 `NO_VALID_ROWS` 錯誤的往返。
 */
export function canConfirmImport(
  preview: ExhibitorImportPreview | null,
): boolean {
  if (!preview) return false;
  return preview.summary.valid > 0 && preview.summary.invalid === 0;
}
