import type { Registration } from "@/types/api.types";
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

/** 票種／報名類型：優先 ticketType，否則 registrantType（含 ATTENDEE 中文化） */
export function getRegistrationTicketType(reg: Registration): string {
  const ticket =
    trimOrNull(reg.ticketType?.name) ?? trimOrNull(reg.ticketType?.title);
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
