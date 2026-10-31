import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

/**
 * 票種寫入（新增／修改／停用）的錯誤分類。
 *
 * 與 `registration-claim-batch.ts` 的 `classifySendError` 同一條紀律：
 * **只讀 `code` / `status`，不回顯後端 `error.message`。** 後端訊息沒有經過
 * 任何審核，可能帶內部路徑、SQL 片段或別的活動的票種名稱；把它原樣丟到
 * 畫面上，等於把後端的實作細節與別人的資料外洩給操作員。
 *
 * 為什麼不直接用 `getApiErrorMessage`：那支就是「把後端 message 原樣回傳」，
 * `polls.tsx` 用它，但本輪的指示明確要求分類式處理。
 *
 * 分類是**畫面的輸入**，不是結論：`ticket-types.tsx` 只把 `kind` 翻成文案，
 * 不判斷 status。這樣分類規則改了只改這一個檔。
 *
 * ## 後端實際會回的錯誤（`EventTicketTypeController.handleError`）
 *
 * | code / status | 什麼時候 |
 * | --- | --- |
 * | `403 INSUFFICIENT_PERMISSION` | 不是活動擁有者／協作者 |
 * | `404 EVENT_NOT_FOUND` | 活動不存在 |
 * | `404 EVENT_TICKET_TYPE_NOT_FOUND` | 票種不屬於這個活動（或已不存在） |
 * | `409 EVENT_TICKET_TYPE_ACCESS_CODE_CONFLICT` | 訪問碼撞到別的票種（DB `@unique`，**跨活動**唯一） |
 * | `400 INVALID_FORM_SCHEMA` | `formFieldsJson` 過不了語意綁定驗證 |
 * | `400 VALIDATION_ERROR` | DTO 驗證失敗（價格小數位、容量 0、tokens…） |
 * | `500` | 其他 |
 */
export type TicketMutationOutcome =
  | { kind: "forbidden" }
  | { kind: "notFound" }
  | { kind: "accessCodeConflict" }
  | { kind: "invalidFormSchema" }
  | { kind: "validation" }
  | { kind: "failed" };

export function classifyTicketMutationError(
  error: unknown,
): TicketMutationOutcome {
  const code = getApiErrorCode(error);
  const status = getApiErrorStatus(error);

  // 先看 code：後端把語意放在 code 裡，status 只是粗分類。
  if (code === "EVENT_TICKET_TYPE_ACCESS_CODE_CONFLICT") {
    return { kind: "accessCodeConflict" };
  }
  if (code === "INVALID_FORM_SCHEMA") {
    return { kind: "invalidFormSchema" };
  }
  if (code === "VALIDATION_ERROR") {
    return { kind: "validation" };
  }
  if (code === "EVENT_TICKET_TYPE_NOT_FOUND" || code === "EVENT_NOT_FOUND") {
    return { kind: "notFound" };
  }
  if (code === "INSUFFICIENT_PERMISSION") {
    return { kind: "forbidden" };
  }

  // code 認不得時退回 status。順序：403 → 404 → 409 → 400。
  // 409 放在 400 前面是因為「唯一鍵衝突」比「格式錯誤」更能解釋使用者的處境。
  if (status === 403) return { kind: "forbidden" };
  if (status === 404) return { kind: "notFound" };
  if (status === 409) return { kind: "accessCodeConflict" };
  if (status === 400) return { kind: "validation" };

  return { kind: "failed" };
}
