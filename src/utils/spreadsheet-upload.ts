/**
 * 試算表匯入的**共用零件**（報名名單與展商名單兩個匯入流程）。
 *
 * ## 為什麼現在抽出來
 * `registrations` 的匯入先落地（`src/services/registration.service.ts` 的四條
 * 呼叫、`src/components/roster/GuestImportModal.tsx` 的選檔器、
 * `src/utils/guest-import.ts` 的切批）。`exhibitors` 的匯入要的是**同一組**
 * 東西：同一個 `file` 欄位名、同一個 5MB 上限、同一個 Android MIME 放寬清單、
 * 同一個「一批最多 100 筆」。
 *
 * 兩份寫法一開始會一樣，然後在某一次後端調整時只改一邊——那種漂移不會有型別
 * 錯誤，只會在活動當天變成「只有展商匯入寄不出去」。所以這裡只抽**純函式與
 * 常數**，不抽畫面。
 *
 * ## 為什麼這裡不 import `expo-document-picker`
 * `registration.service.ts` 的既有註解已經說明過同一件事：service 依賴 UI 層
 * 套件會讓 Node 測試載不進來。這裡再往前一步——把「允許哪些 MIME」變成一個
 * **資料常數**，選檔動作本身仍留在各自的元件裡（那才是唯一依賴 RN 的地方）。
 *
 * ## 誠實邊界
 * 這裡沒有「格式驗證」。真正的格式由後端用 magic byte 判定
 * （`createSpreadsheetUploadMiddleware`），前端宣告的 MIME 只是給選檔器用的
 * 過濾提示，兩邊不一致時**以後端為準**。
 */

/**
 * 選好的一個檔案（`expo-document-picker` 的 asset 去掉它自己的欄位）。
 *
 * 刻意不直接用 `DocumentPicker.DocumentPickerAsset`：那會讓 service 依賴一個
 * UI 層的套件。這裡只留 RN `FormData` 真正需要的三個欄位。
 */
export interface SpreadsheetFile {
  /** 平台原生的 URI（iOS `file://…`、Android `content://…`）。 */
  uri: string;
  name: string;
  mimeType: string | null;
}

/**
 * 選檔器放行的 MIME 清單（iOS 走 UTI、Android 走各供應商自報）。
 *
 * 刻意放寬到含 `application/octet-stream`：部分 Android 文件供應商對 `.csv`
 * 就回這個值（甚至空值）。後端 `createSpreadsheetUploadMiddleware` 同樣放行，
 * 且真正格式由檔案內容判定——所以放寬不會讓壞檔案混進來，只會讓好檔案進得來。
 */
export const SPREADSHEET_MIME_TYPES = [
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
] as const;

/**
 * 單次 notify 的上限（與後端 `NOTIFY_MAX` / `BATCH_MAX` 同步，兩邊都是 100）。
 *
 * 超過就要切批：後端對超量的請求是**整批拒絕**，不是截斷。所以「剛好 100」
 * 與「101」的差別是「成功」與「全部失敗」。
 */
export const SPREADSHEET_NOTIFY_BATCH_SIZE = 100;

/** 依 `SPREADSHEET_NOTIFY_BATCH_SIZE` 切批（空陣列回空陣列，不造出 `[[]]`）。 */
export function chunkSpreadsheetIds(ids: string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += SPREADSHEET_NOTIFY_BATCH_SIZE) {
    batches.push(ids.slice(i, i + SPREADSHEET_NOTIFY_BATCH_SIZE));
  }
  return batches;
}

/**
 * 組出 multipart body。
 *
 * `append` 的第二個參數在 React Native 是「帶 `uri` 的物件」，型別卻寫成
 * `Blob`（那是瀏覽器的定義）——所以這裡一定要轉型。這不是偷懶：RN 的
 * `FormData` 實作會讀 `uri`／`name`／`type` 去串出檔案區段，傳真的 `Blob`
 * 反而在 RN 上不能用。
 *
 * `extra` 是「檔案以外的純文字欄位」，依插入順序附加。兩個流程各用一個：
 * 報名匯入送 `mode`（`create` / `upsert`）、展商匯入送 `mode`
 * （只有 `skip_existing`）。**不送 `extra` 就一個都不送**——後端對缺席的
 * `mode` 有自己的預設值，多送一個空字串反而會走進「明確拒絕」的分支
 * （展商 `confirm` 就是這樣：`mode` 有值但不等於 `skip_existing` ⇒ 400）。
 */
export function buildSpreadsheetFormData(
  file: SpreadsheetFile,
  extra?: Record<string, string>,
): FormData {
  const body = new FormData();
  body.append("file", {
    uri: file.uri,
    name: file.name,
    // 後端白名單接受 `application/octet-stream`，所以 Android 回報不出 MIME
    // 時退回它不會被擋；檔名本身仍帶著 `.csv`／`.xlsx`。
    type: file.mimeType ?? "application/octet-stream",
  } as unknown as Blob);
  for (const [key, value] of Object.entries(extra ?? {})) {
    body.append(key, value);
  }
  return body;
}
