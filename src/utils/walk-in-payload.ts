import { EVENT_CONSENT_TOS_VERSION } from "@/utils/walk-in-validation";

export type WalkInRegistrationInput = {
  ticketId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
};

export type WalkInRegistrationBody = {
  ticketTypeId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  consent: { tosVersion: string; privacyAcceptedAt: string };
};

/**
 * 現場補報名的送出 payload（`ADM-02`／S4）。
 *
 * 與 `walk-in.tsx` 原本的 inline 物件**逐欄等值**（含「空白欄位一律 `undefined`，
 * 不送空字串」與「`privacyAcceptedAt` 為呼叫當下的 ISO 字串」）。抽出來的理由只有
 * 一個：AdminApp 沒有元件層測試（`node:test` 無 jsdom／RN renderer），payload
 * 留在螢幕檔裡就永遠測不到「consent 有沒有真的送出去」——而那是 S4 在 ADM 端唯一的
 * 可觀察契約（誰都不能假裝 gate 不存在，也不能靜默不送同意）。
 */
export function buildWalkInRegistrationBody(
  input: WalkInRegistrationInput,
): WalkInRegistrationBody {
  const trimmed = (value: string) => value.trim();
  return {
    ticketTypeId: input.ticketId,
    email: trimmed(input.email),
    firstName: trimmed(input.firstName) || undefined,
    lastName: trimmed(input.lastName) || undefined,
    phone: trimmed(input.phone) || undefined,
    company: trimmed(input.company) || undefined,
    consent: {
      tosVersion: EVENT_CONSENT_TOS_VERSION,
      privacyAcceptedAt: new Date().toISOString(),
    },
  };
}
