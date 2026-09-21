/**
 * 報到畫面「結果卡」與「總簽到計數」的顯示推導（`F-01`、`F-03`）。
 *
 * 這個模組存在的理由：`resolveCheckInErrorMessage` 判定得再準，只要畫面
 * **不把判定結果顯示出來**，操作者看到的就還是一樣的畫面。上一輪把 5xx 分支
 * 加進了 `check-in-errors.ts` 並補了單元測試，但**沒有驗 render**——於是
 * 閘道 502（伺服器壞了）與 404（真的沒這筆報名）在畫面上逐字相同
 * （`docs/evidence/UI-REVIEW/82-checkin-502.txt` 對 `81-checkin-404.txt`）。
 *
 * 因此把「結果卡要顯示哪幾行字」抽到這裡，讓畫面與測試共用同一個來源：
 * 畫面不再有第二條文案路徑，測試也能直接斷言操作者會看到的字。
 */
import { copy } from "@/constants/copy.zh-TW";
import type {
  CheckInOutcomeKind,
  CheckInUiState,
} from "@/types/check-in.types";

/** `phase: "outcome"` 的唯一形狀別名，避免每個消費端各寫一次 `Extract` */
export type CheckInOutcome = Extract<CheckInUiState, { phase: "outcome" }>;

/**
 * 結果卡標題：三態的固定文案。
 *
 * 鍵集合刻意取 `CheckInOutcomeKind` 的完整聯集——新增一種結果態時
 * `tsc` 會在這一張表上失敗，而不是讓畫面靜默落到別的標題。
 */
const OUTCOME_HEADLINES: Record<CheckInOutcomeKind, string> = {
  valid: copy.checkIn.validHeadline,
  duplicate: copy.checkIn.duplicateHeadline,
  invalid: copy.checkIn.invalidHeadline,
};

export function getCheckInOutcomeHeadline(kind: CheckInOutcomeKind): string {
  return OUTCOME_HEADLINES[kind];
}

/**
 * 結果卡的第二行——**為什麼**會是這個結果。
 *
 * 這是 `F-01` 的修正核心：標題（「無效報名」）在三種失敗之間本來就相同，
 * 唯一能讓操作者分辨「這張票不存在」與「伺服器壞了」的資訊是這一行。
 * 少了它，`copy.checkIn.serverError`（「伺服器暫時異常，請改用人工核對或
 * 稍後重試」）永遠不會出現在畫面上。
 *
 * 回傳 `null` 代表這一行不會帶來新資訊（與標題逐字相同，或訊息是空白），
 * 呼叫端據此不渲染——避免出現一行與標題重複的字（成功態就是這種情形）。
 */
export function getCheckInOutcomeDetail(
  outcome: CheckInOutcome,
): string | null {
  const message = outcome.message.trim();

  if (message === "" || message === getCheckInOutcomeHeadline(outcome.kind)) {
    return null;
  }

  return message;
}
