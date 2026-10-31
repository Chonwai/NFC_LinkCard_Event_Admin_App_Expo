import { copy } from "@/constants/copy.zh-TW";
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
