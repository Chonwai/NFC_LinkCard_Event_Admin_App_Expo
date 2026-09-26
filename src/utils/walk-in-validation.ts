import { isValidEmail } from "@/utils/validation";

export type WalkInConsentState = {
  ticketId: string;
  email: string;
  consent: boolean;
};

export type WalkInConsentResult =
  | { ok: true }
  | {
      ok: false;
      key: "walkInNeedTicket" | "walkInNeedEmail" | "walkInNeedConsent";
    };

/** Pure guard for ADM-02: ticket → email → consent order. */
export function validateWalkInConsent(
  state: WalkInConsentState,
): WalkInConsentResult {
  if (!state.ticketId.trim()) {
    return { ok: false, key: "walkInNeedTicket" };
  }
  if (!isValidEmail(state.email.trim())) {
    return { ok: false, key: "walkInNeedEmail" };
  }
  if (!state.consent) {
    return { ok: false, key: "walkInNeedConsent" };
  }
  return { ok: true };
}

/** C-4: mirror FE CONSENT_TOS_VERSION / BE EVENT_CONSENT_TOS_VERSION */
export const EVENT_CONSENT_TOS_VERSION = "event-tos-v1";
