import { copy } from "@/constants/copy.zh-TW";
import type { GuestImportPreview } from "@/types/api.types";
import {
  chunkSpreadsheetIds,
  SPREADSHEET_NOTIFY_BATCH_SIZE,
} from "@/utils/spreadsheet-upload";

/**
 * 貴賓名單匯入的**純規則**（不碰畫面、不碰網路）。
 *
 * 為什麼要拉出來：這三條規則在 Web 是散在 `RegistrationImportPanel.tsx` 的
 * JSX 與 `registrationImport.ts` 的迴圈裡，其中「一批最多 100 筆」那條在
 * 兩邊各寫一次就會漂移——`IMPORT_NOTIFY_BATCH_SIZE` 是與 BE `NOTIFY_MAX`
 * 同步的常數，寫錯不會有型別錯誤，只會在超過 100 筆時整批 400。
 *
 * 這裡只放「值 → 字串」與「陣列 → 陣列」的轉換，UI 只負責排版。
 */

/**
 * 單次 notify 的上限（與 BE `NOTIFY_MAX` 同步）。
 *
 * 超過就要切批：BE 對超量的請求是**整批拒絕**，不是截斷。所以「剛好 100」
 * 與「101」的差別是「成功」與「全部失敗」。
 *
 * 值本體在 `@/utils/spreadsheet-upload`——展商名單匯入的 notify 用的是同一個
 * 上限（後端也是同一個 `BATCH_MAX`）。這裡只是保留原本的名字給既有呼叫端。
 */
export const GUEST_IMPORT_NOTIFY_BATCH_SIZE = SPREADSHEET_NOTIFY_BATCH_SIZE;

/** 依 `GUEST_IMPORT_NOTIFY_BATCH_SIZE` 切批（空陣列回空陣列，不造出 `[[]]`）。 */
export function chunkRegistrationIds(ids: string[]): string[][] {
  return chunkSpreadsheetIds(ids);
}

/**
 * 一列無效資料的錯誤摘要：`#3：ticketType 找不到 / email 格式不正確`。
 *
 * 與 Web 同一個格式（`row.errors.map(e => e.message).join(' / ')`）。
 * 為什麼合併成一行而不是列出陣列：一列可能同時有多個欄位錯，操作員要的是
 * 「第 3 列哪裡錯」，不是「每個錯誤各佔一行把面板撐爆」。
 */
export function invalidRowText(row: {
  row: number;
  errors: { message: string }[];
}): string {
  return copy.roster.guestImport.invalidRow(
    row.row,
    row.errors.map((error) => error.message).join(" / "),
  );
}

/**
 * 一列所有錯誤的 `suggestions`，**依 `name` 去重**。
 *
 * 後端在 `TICKET_TYPE_NOT_FOUND` / `AMBIGUOUS_TICKET_TYPE` 時直接給出「本來
 * 可以填什麼」。同一個建議可能從多個錯誤重複出現，所以先去重再顯示——否則
 * 操作員會以為那是兩個不同選項。
 */
export function suggestionNames(row: {
  errors: { suggestions?: { name: string }[] }[];
}): string[] {
  const seen = new Map<string, string>();
  for (const error of row.errors) {
    for (const choice of error.suggestions ?? []) {
      if (!seen.has(choice.name)) seen.set(choice.name, choice.name);
    }
  }
  return [...seen.values()];
}

/**
 * 預覽結果的關鍵數字（畫面那四個格子）。
 *
 * `valid` 用陣列長度而不是 `totalRows - invalid - duplicates`：後端的三個
 * 分類不是互斥分割（一列可以既重複又無效），用減法會在邊界情況算出負數。
 */
export function previewCounts(preview: GuestImportPreview | null): {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
} {
  if (!preview) return { total: 0, valid: 0, invalid: 0, duplicates: 0 };
  return {
    total: preview.totalRows,
    valid: preview.valid.length,
    invalid: preview.invalid.length,
    duplicates: preview.duplicates.length,
  };
}

/**
 * 有無「阻擋匯入」的無效列。
 *
 * 與 Web 同一條判定：**只要有一列無效就不能按確認**。允許部分匯入會讓
 * 「我匯了 500 筆」與「實際建立 480 筆」之間的落差沒有任何畫面能解釋。
 */
export function hasBlockingRows(preview: GuestImportPreview | null): boolean {
  return (preview?.invalid.length ?? 0) > 0;
}
