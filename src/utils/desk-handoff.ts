/**
 * `WP-18`（`11` §2.1）報到台 → 寫卡頁交棒的**純邏輯**。
 *
 * 為什麼獨立成模組（Loop AB · Batch A 驗收 `M-03`）：這兩段原本長在畫面檔裡，
 * 而 AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），驗收只能
 * 「讀原始碼比對字串」——抓得到整段被刪，抓不到等價重寫與邊界行為。搬到
 * `src/utils/**` 之後即可沿用既有慣例（`nfc-utils.ts`／`registration-display.ts`）
 * 對**行為**下斷言，畫面只負責把結果接上 UI。
 *
 * 界線：本檔**不含任何 React／RN 依賴，也不碰 state**。查詢本身由呼叫端注入
 * （`resolveAttendee` 的 `lookup` 參數），所以測試不必 mock 網路層或 RN runtime。
 */
import { copy } from "@/constants/copy.zh-TW";
import type { Registration } from "@/types/api.types";
import { getRegistrationDisplayName } from "@/utils/registration-display";

export interface AttendeeContext {
  registrationId: string;
  code: string;
  displayName: string;
  /** X-23 預設：讀 BE by-code 回傳的完整 profileUrl，不在 App 內自組 origin */
  profileUrl: string | null;
}

/** `confirm` 態的完整形狀（畫面 `FlowState` 的其中一支）。 */
export type AttendeeConfirmContext = AttendeeContext & { phase: "confirm" };

/** 查詢單一報名（由畫面注入 `registrationService.getByCode`）。 */
export type RegistrationLookup = (
  eventId: string,
  code: string,
) => Promise<{ registration: Registration }>;

export type AttendeeLookupResult =
  { ok: true; ctx: AttendeeConfirmContext } | { ok: false; reason: string };

/**
 * `by-code` 回應 → `confirm` 態所需的人員資訊。
 * 缺 `id` 時回 null，由呼叫端沿用既有錯誤文案（不靜默吞掉）。
 */
export function toAttendeeContext(
  registration: Registration,
  code: string,
): AttendeeConfirmContext | null {
  if (!registration.id) return null;
  // 空字串／純空白一律收斂成 `null`：`string | null` 不該有第三種「有值但沒值」的
  // 形狀（`M-02` 同族）；下游（`writeAndBind` 的守衛、`profilePathLabel`）本來就
  // 以 falsy 判斷，收斂後行為一致且意圖明確。
  const profileUrl = registration.profileUrl?.trim() ?? "";
  return {
    phase: "confirm",
    registrationId: registration.id,
    code,
    displayName: getRegistrationDisplayName(registration),
    profileUrl: profileUrl === "" ? null : profileUrl,
  };
}

/**
 * `11` `WP-18`：把後端回的絕對 `profileUrl` 收斂成要寫進卡的路徑（`/p/{slug}`）。
 *
 * 現場只需要認路徑；origin 由後端與寫卡頁各自持有，這個畫面不再組第二份。
 * 解析不出來時退回原文——讓操作者看到後端真正回了什麼，而不是一片空白。
 */
export function profilePathLabel(
  profileUrl: string | null | undefined,
): string | null {
  if (!profileUrl || !profileUrl.trim()) return null;
  const value = profileUrl.trim();
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

/**
 * 只負責「查詢 + 整形」，**不碰任何 state**：這樣按鈕與自動查詢都能用它，
 * 而 effect 本體也不會出現同步 setState（`react-hooks/set-state-in-effect`）。
 *
 * `lookup` 由呼叫端注入，是為了讓這個交棒序列在沒有 RN renderer 的測試環境裡
 * 也能對**行為**下斷言（而不是掃原始碼字串）。見 `tests/desk-handoff.test.mjs`。
 */
export async function resolveAttendee(
  eventId: string,
  rawCode: string,
  lookup: RegistrationLookup,
): Promise<AttendeeLookupResult> {
  try {
    const { registration } = await lookup(eventId, rawCode);
    const ctx = toAttendeeContext(registration, rawCode);
    if (!ctx) return { ok: false, reason: copy.nfc.bindFailed };
    return { ok: true, ctx };
  } catch {
    return { ok: false, reason: copy.checkIn.registrationNotFound };
  }
}
