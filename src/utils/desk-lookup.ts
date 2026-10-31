/**
 * `GET …/registrations/desk-lookup` 的**純邏輯**：把「已經報到過的人」從唯讀端點
 * 補回來，而不是再打一次 `checkIn`。
 *
 * ── 為什麼需要這一層 ────────────────────────────────────────────────────────
 * `checkIn()` 對已報到者是**終局 400**（`ALREADY_CHECKED_IN`）且不回任何資料；
 * Web 因此在補寫卡時改用 `desk-lookup`
 * （`LinkCard_Frontend@app/check-in/[eventId]/page.tsx:608` →
 * `lib/events/registrations.ts:193`）。App 先前只有公開且回整包 PII 的 `by-code`
 * 一條路，兩邊看到的不是同一份契約。
 *
 * ── 為什麼抽成純函式 ────────────────────────────────────────────────────────
 * AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），畫面檔只能靠
 * 讀原始碼比對字串（見 `check-in-write-handoff.test.mjs`）。抽到這裡之後，
 * 「已報到分支走 desk-lookup、且不打 checkIn」可以在沒有 renderer 的環境裡對
 * **行為**下斷言。查詢本身由呼叫端注入（`lookupDesk`），所以測試不必 mock 網路層。
 *
 * 界線：本檔**不含 React／RN 依賴，也不碰 state**。
 */
import type { DeskLookupRegistration, Registration } from "@/types/api.types";
import { getRegistrationCheckedInAt } from "@/utils/registration-display";

/** 查詢單一報名的唯讀 desk 視圖（由畫面注入 `registrationService.lookupRegistrationForDesk`）。 */
export type DeskLookup = (
  eventId: string,
  code: string,
) => Promise<{ registration: DeskLookupRegistration }>;

/**
 * `desk-lookup` 有值就用它；否則沿用同一次掃描 already 取得的 `by-code`。
 * 兩邊都沒有時是 `null`——不憑空造值。
 */
function prefer<T>(
  deskValue: T | null,
  fallback: T | null | undefined,
): T | null {
  return deskValue ?? fallback ?? null;
}

/**
 * `desk-lookup` 回應 → 結果卡要用的 `Registration` 視圖。
 *
 * **照實建模，不做「兩者欄位相同」的假設**：`desk-lookup` 的 select 沒有
 * `ticketType`／`tokenBalance`／`isActivated`（見
 * `EventRegistrationService.lookupRegistrationForDesk`）。這些欄位只有在本次
 * 掃描已經由 `by-code` 取得（`fallback`）時才留著；沒有的話就是 `undefined`，
 * 讓畫面既不穿鑿也不謊報。
 *
 * 反過來，`id`／`checkedInAt`／`profileUrl` **一律以 desk 回應為準**：那三個正是
 * 簽到台綁卡與交棒真正要用的欄位。
 */
export function toRegistrationView(
  desk: DeskLookupRegistration,
  fallback?: Registration,
): Registration {
  return {
    ...fallback,
    id: desk.id || fallback?.id || "",
    registrationCode: desk.registrationCode || fallback?.registrationCode || "",
    status: desk.status || fallback?.status || "",
    email: prefer(desk.email, fallback?.email),
    firstName: prefer(desk.firstName, fallback?.firstName),
    lastName: prefer(desk.lastName, fallback?.lastName),
    company: prefer(desk.company, fallback?.company),
    registrantType: prefer(desk.registrantType, fallback?.registrantType),
    checkedInAt: prefer(desk.checkedInAt, fallback?.checkedInAt),
    profileUrl: prefer(desk.profileUrl, fallback?.profileUrl),
  };
}

/**
 * 「已入場」結果卡的最終資料。
 *
 * 兩條來路（`by-code` 先行判定 / `checkIn` 回 `ALREADY_CHECKED_IN`）都走這裡，
 * 所以兩者的欄位來源不會各走各的。
 *
 * **降級是刻意的**：唯讀查詢失敗（403、離線、舊 BE 沒有這條路由）時仍以手邊的
 * `fallback` 講「已入場」。把一次唯讀查詢失敗講成「這張票不存在」才是真正的
 * 誤導——而且現場正是在「卡片沒寫成、人要重掃」的時候最容易撞到這條路。
 */
export async function resolveDuplicateOutcome(
  eventId: string,
  code: string,
  fallback: Registration | undefined,
  lookupDesk: DeskLookup,
): Promise<{ registration?: Registration; checkedInAt: string | null }> {
  let registration = fallback;
  try {
    const { registration: desk } = await lookupDesk(eventId, code);
    registration = toRegistrationView(desk, fallback);
  } catch {
    // 見上方「降級是刻意的」。
  }
  return {
    registration,
    checkedInAt: registration ? getRegistrationCheckedInAt(registration) : null,
  };
}
