import type { Registration } from "@/types/api.types";
import { WEB_BASE_URL } from "@/constants/config";
import { copy } from "@/constants/copy.zh-TW";

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

export function getRegistrationDisplayName(reg: Registration): string {
  const fromProfile = trimOrNull(reg.profile?.fullName);
  if (fromProfile) return fromProfile;
  const parts = [reg.firstName, reg.lastName]
    .map((p) => trimOrNull(p ?? undefined))
    .filter(Boolean)
    .join(" ");
  if (parts) return parts;
  return (
    trimOrNull(reg.profile?.email) ??
    trimOrNull(reg.email ?? undefined) ??
    copy.checkIn.dash
  );
}

export function getRegistrationCompany(reg: Registration): string {
  return (
    trimOrNull(reg.profile?.company) ??
    trimOrNull(reg.company ?? undefined) ??
    copy.checkIn.dash
  );
}

/**
 * 票種／報名類型：優先票種名，否則 registrantType（含 ATTENDEE 中文化）。
 *
 * 順序上 `displayName` **必須排第一**：後端兩條會回票種的路徑
 * （`listRegistrations` 與 `getRegistrationByCode` 的 select）都只選
 * `displayName`，從來沒有 `name`／`title`。舊版型別宣告了不存在的欄位，於是
 * 每一列都退到 `registrantType`（所有一般票都顯示「參加者」）——看起來像「沒有票種」，
 * 實際上是「讀錯了欄位」。`name`／`title` 保留兼容舊資料。
 */
export function getRegistrationTicketType(reg: Registration): string {
  const ticket =
    trimOrNull(reg.ticketType?.displayName) ??
    trimOrNull(reg.ticketType?.name) ??
    trimOrNull(reg.ticketType?.title);
  if (ticket) return ticket;

  const raw = trimOrNull(reg.registrantType ?? undefined);
  if (!raw) return copy.checkIn.dash;

  const key = raw.toUpperCase();
  const mapped =
    copy.checkIn.registrantTypeLabels[
      key as keyof typeof copy.checkIn.registrantTypeLabels
    ];
  return mapped ?? raw;
}

export function getRegistrationEmail(reg: Registration): string {
  return (
    trimOrNull(reg.profile?.email) ??
    trimOrNull(reg.email ?? undefined) ??
    copy.checkIn.dash
  );
}

export function getRegistrationTokenBalance(reg: Registration): number | null {
  return typeof reg.tokenBalance === "number" ? reg.tokenBalance : null;
}

export function getRegistrationCheckedInAt(reg: Registration): string | null {
  return reg.checkedInAt ?? null;
}

export function getRegistrationCode(reg: Registration): string {
  return trimOrNull(reg.registrationCode) ?? copy.checkIn.dash;
}

/**
 * 待付款報名的付款頁網址（`PENDING_PAYMENT` 列的「複製付款連結」）。
 *
 * Web 的 `CopyLinkButton` 用 `window.location.origin`——瀏覽器自己就是那個
 * origin。App 沒有 `window`，所以 origin 只能取 `WEB_BASE_URL`（與 NFC 寫卡／
 * 名片 URL 共用同一個常數，不另外造第三份「本站網址」）。
 *
 * 路徑與 Web **逐字相同**：`/events/{eventId}/payment?code={code}`
 * （`LinkCard_Frontend/app/(event)/manage/[eventId]/registrations/page.tsx:1174-1177`）。
 * 少一段或多一段，操作者傳給客人的連結就打不開——這是照抄 Web 時最容易錯的
 * 地方，所以由 `tests/registration-display.test.mjs` 釘住形狀。
 *
 * 兩個參數都過 `encodeURIComponent`：對正常報名編號（英數、已正規化為大寫）
 * 輸出與 Web 一字不差，但遇到含 `&`／`#` 的異常值時不會把 query 切壞。
 */
export function buildRegistrationPaymentUrl(
  eventId: string,
  registrationCode: string,
): string {
  return `${WEB_BASE_URL}/events/${encodeURIComponent(eventId)}/payment?code=${encodeURIComponent(registrationCode)}`;
}

export function maskEmail(value: string | null | undefined): string {
  const email = trimOrNull(value ?? undefined);
  if (!email) return copy.checkIn.dash;
  const [user, domain] = email.split("@");
  if (!user || !domain) return copy.checkIn.dash;
  return `${user.slice(0, 1)}***@${domain}`;
}

export function maskPhone(value: string | null | undefined): string {
  const phone = trimOrNull(value ?? undefined);
  if (!phone) return copy.checkIn.dash;
  const compact = phone.replace(/\s/g, "");
  if (compact.length <= 4) return "****";
  return `${"*".repeat(compact.length - 4)}${compact.slice(-4)}`;
}

export function getRegistrationPhone(reg: Registration): string {
  return (
    trimOrNull(reg.profile?.phone) ??
    trimOrNull(reg.phone ?? undefined) ??
    copy.checkIn.dash
  );
}

/** 已簽到（重複態判斷） */
export function isAlreadyCheckedIn(reg: Registration): boolean {
  const status = (reg.status ?? "").toUpperCase();
  if (status === "CHECKED_IN") return true;
  return getRegistrationCheckedInAt(reg) != null;
}

/** 不可直接簽到的狀態（無效／未確認等） */
export function isRegistrationNotCheckInEligible(reg: Registration): boolean {
  const status = (reg.status ?? "").toUpperCase();
  return (
    status === "PENDING" ||
    status === "PENDING_PAYMENT" ||
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "DRAFT"
  );
}
