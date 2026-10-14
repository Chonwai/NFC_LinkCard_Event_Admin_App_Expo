# 03 — Capability Gap Matrix

## Legend

| Symbol | Meaning                                                             |
| ------ | ------------------------------------------------------------------- |
| ✅     | Present and complete for its purpose                                |
| 🟡     | Partial — covers the common path, missing notable branches          |
| ⚠️     | Read-only where the web console allows mutation                     |
| ✗      | Absent                                                              |
| ➖     | Deliberately out of scope — belongs to a desk/large-screen workflow |

Evidence column cites the App file, the Frontend page, and the backend route file.

---

## A. Door-side capabilities (the App's reason to exist)

| #   | Capability                                                               | Web (`LinkCard_Frontend`)                                                                       | App (`…Admin_App_Expo`)                                                                                       | Backend                                                     |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A1  | QR camera check-in                                                       | ✅ `app/check-in/[eventId]/page.tsx` (328 LOC)                                                  | ✅ `[eventId]/check-in.tsx` (957 LOC)                                                                         | `registrations.routes.ts` `POST …/checkin`                  |
| A2  | Manual code entry check-in                                               | ✅                                                                                              | ✅                                                                                                            | same                                                        |
| A3  | Check-in with `isActivated` 3-state (account present / absent / unknown) | ✗                                                                                               | ✅ (`dad010b`)                                                                                                | `4c023824`                                                  |
| A4  | Desk handoff after check-in (profile row + write-card CTA + prefill)     | ✗                                                                                               | ✅ `utils/desk-handoff.ts` (`6dfe941`)                                                                        | `f0567480` `profileUrl`                                     |
| A5  | Supervisor override check-in                                             | ✗                                                                                               | ✅ (`check-in.tsx` `overrideBusy`)                                                                            | `POST …/checkin/override`                                   |
| A6  | Revoke / correct a check-in (undo)                                       | ✅ `onCorrectStatus` in `registrations/page.tsx`; `POST /registrations/:id/status` (`67cd592f`) | ✗                                                                                                             | `registrations.routes.ts`                                   |
| A7  | Walk-in registration at the door                                         | ✗                                                                                               | ✅ `[eventId]/walk-in.tsx` (304 LOC)                                                                          | `registrations.routes.ts` `POST /`                          |
| A8  | Walk-in dynamic-form field rendering + `INVALID_FORM_DATA` desk guidance | —                                                                                               | ✅ (`ea56f71`, `d8880f4`)                                                                                     | —                                                           |
| A9  | Walk-in consent capture                                                  | —                                                                                               | ✅ (`6cd94db`, direction `docs/20260929_ADM_Consent_Gate_Direction.md`)                                       | `20260925` consent migration                                |
| A10 | NFC card write (badge ↔ registration bind)                               | ✗                                                                                               | ✅ `[eventId]/nfc-bind.tsx` (682 LOC)                                                                         | `event-ops.routes.ts` `POST …/nfc/bind`                     |
| A11 | NFC card read-back verification                                          | ✗                                                                                               | ✅ `[eventId]/nfc-read.tsx` (283 LOC)                                                                         | `GET …/nfc/lookup`                                          |
| A12 | NFC business-card exchange                                               | ✗ (web has `nfcTapView`)                                                                        | ✅ `[eventId]/nfc-exchange.tsx` (452 LOC), `utils/nfc-exchange.ts`                                            | `POST …/nfc/exchange`                                       |
| A13 | Badge inventory browse (status pills, batch label)                       | ✅ (890 LOC)                                                                                    | 🟡 `[eventId]/badges.tsx` (574 LOC)                                                                           | `GET …/nfc/badges`                                          |
| A14 | Badge inventory CSV export                                               | ✅                                                                                              | ✗                                                                                                             | `GET …/nfc/badges/export`                                   |
| A15 | Badge batch creation (`UNASSIGNED` pool)                                 | ✅                                                                                              | ✗                                                                                                             | `POST …/nfc/batch`, `…/batch/:id/complete`, `…/batch/claim` |
| A16 | Workshop session check-in at the door                                    | ✅ `manage/[eventId]/sessions/[sessionId]/registrations`                                        | ✗                                                                                                             | `sessions-polls.routes.ts` `POST …/sessions/:id/checkin`    |
| A17 | Attendee roster lookup on the door device                                | ✅ (1470 LOC)                                                                                   | 🟡 `[eventId]/registrations.tsx` (644 LOC) — status filter only, no search                                    | `GET …/registrations`                                       |
| A18 | Registrant detail at the door                                            | ✅ (`RegistrationDetailDrawer`)                                                                 | ⚠️ `registrant/[registrationId].tsx` (230 LOC) — read-only, no actions                                        | `GET …/registrations/:id`                                   |
| A19 | Wallet / token balance + top-up / deduct at the desk                     | ✅ `my-tickets/[registrationId]/wallet`                                                         | ⚠️ `token.tsx` (68 LOC) is a **placeholder that opens the web**; only `GET /wallet/:id/transactions` is wired | `premium.routes.ts`                                         |
| A20 | Offline check-in / queue-and-sync                                        | ✗                                                                                               | ✗                                                                                                             | —                                                           |
| A21 | Badge printing                                                           | ✗                                                                                               | ✗                                                                                                             | —                                                           |

**Read A20 and A21 carefully: they are absent on _both_ surfaces.** The App is not "behind the web" here —
nobody has built it. These are net-new product questions, not parity work.

---

## B. Desk / large-screen capabilities (belongs on web)

| #   | Capability                                                          | Web                                                           | App                                   | Backend                                                  |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| B1  | Event list / my events                                              | ✅ `manage/events`                                            | ✅ `home.tsx` (354 LOC)               | `events.routes.ts` `GET /my-managed`                     |
| B2  | Event overview + live stats                                         | ✅ `manage/[eventId]/page.tsx`                                | ✅ `overview.tsx` (517 LOC)           | `GET /by-id/:eventId`                                    |
| B3  | Event profile / basic info edit                                     | ✅ (380 LOC)                                                  | ✗                                     | `PATCH /:eventId`                                        |
| B4  | Event settings                                                      | ✅ (451 LOC)                                                  | ✗                                     | —                                                        |
| B5  | Ticket types CRUD                                                   | ✅ (1431 LOC)                                                 | ⚠️ read-only via `GET …/ticket-types` | `events.routes.ts` ticket-type routes                    |
| B6  | **Ticket capability editor + per-event rollout switch**             | ✅ (`a6a4a5d`, `6e6bc7e`; `lib/events/ticketCapabilities.ts`) | ✗ **no representation at all**        | `20261013100000`, `20261013120000`                       |
| B7  | Registration list, filters, bulk ops                                | ✅ (1470 LOC)                                                 | ⚠️ read-only subset                   | `registrations.routes.ts`                                |
| B8  | Per-registration email status chip + filter                         | ✅ (`4d5afcb`, `a4f60b5b`)                                    | ✗                                     | `a4f60b5b` — BE attaches `emailStatus` to the admin list |
| B9  | Resend confirmation / activation                                    | ✅ (`3dea442`, `de094d1`, `5e19476a`)                         | ✗                                     | `POST …/registrations/:id/activation-link`, re-queue     |
| B10 | Batch claim resend, select-all / opt-in no-account rows             | ✅ (`a953b62`, `d108482`)                                     | ✗                                     | —                                                        |
| B11 | Guest / VIP list CSV import (template / preview / confirm / notify) | ✅ `RegistrationImportPanel.tsx` (`34e636d`, `a2f7ff15`)      | ✗                                     | `registration-import.routes.ts` (4 endpoints)            |
| B12 | Workshop sessions CRUD                                              | ✅ `manage/[eventId]/sessions` (422 LOC)                      | ✗                                     | `sessions-polls.routes.ts`                               |
| B13 | Session registrations + derived 3-state attendance                  | ✅ (`31ffd32`)                                                | ✗                                     | —                                                        |
| B14 | Session eligibility errors surfaced with specific copy              | ✅ (`491dbf3`)                                                | ✗                                     | `sessionEligibility.ts`                                  |
| B15 | Polls create / activate / close / results                           | ✅ `manage/[eventId]/polls` (323 LOC)                         | ✗                                     | `sessions-polls.routes.ts`                               |
| B16 | Event page content / page sections                                  | ✅ `manage/[eventId]/content` (376 LOC)                       | ✗                                     | `events.routes.ts` `page-sections`                       |
| B17 | Exhibitors CRUD + status                                            | ✅ `manage/[eventId]/exhibitors` (243 LOC)                    | ✗ (stat count only)                   | `exhibitors.routes.ts` (18 endpoints)                    |
| B18 | Exhibitor CSV import                                                | ✅ `manage/[eventId]/exhibitors/import`                       | ✗                                     | `exhibitor-import.routes.ts`                             |
| B19 | Exhibitor invites                                                   | ✅ `accept-exhibitor-invite`                                  | ✗                                     | `exhibitor-invites.routes.ts`                            |
| B20 | Exhibitor company page + publish                                    | ✅ `exhibitor/[id]/manage/company`                            | ✗                                     | `exhibitors.routes.ts` `company-page`                    |
| B21 | Org roles / staff invites                                           | ✅ `manage/[eventId]/org-roles` (295 LOC)                     | ✗                                     | `engagement.routes.ts` `org-roles`                       |
| B22 | Bank transfers                                                      | ✅ `manage/[eventId]/bank-transfers` (251 LOC)                | ✗                                     | `event-ops.routes.ts`                                    |
| B23 | Business matching admin                                             | ✅ `events/[eventId]/matching`                                | ✗                                     | `premium.routes.ts` `matching/*`                         |
| B24 | Exhibitor networking inbox (accept / decline / withdraw)            | ✅ `exhibitor/[id]/manage/network*`                           | ✗                                     | `connection-requests.routes.ts` (7 endpoints)            |
| B25 | Attendee / exhibitor CSV export                                     | ✅                                                            | ✗                                     | `GET …/export/attendees`, `…/export/exhibitors`          |
| B26 | Association vertical                                                | ✅ `(association)/**`                                         | ➖                                    | `associationRoutes`                                      |

**Count: B3–B25 = 23 backend-backed capabilities with a web surface and no App surface.** Most are ➖ by the
criterion in §D below. The ones that are _not_ ➖ are B6, B8, B9, B12/B13, A16.

---

## C. What the App has that the web does not

This section exists because the parity conversation must be symmetric. The App is not a junior
copy of the web console.

| #   | Capability                                                                                                  | App only | Evidence                                                           |
| --- | ----------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| C1  | Native NFC write / read / exchange                                                                          | ✅       | `nfc-bind.tsx` 682, `nfc-read.tsx` 283, `nfc-exchange.tsx` 452     |
| C2  | Camera-based QR check-in tuned for a phone at a door (3s auto-reset, 15s success hold, "continue scanning") | ✅       | `check-in.tsx` (`c8e32e6`)                                         |
| C3  | Desk handoff: check-in → write card → prefill, as one gesture                                               | ✅       | `utils/desk-handoff.ts`, `5c8b7ce`                                 |
| C4  | Resident card URL resolver `/t/{eventId}/{tagUid}` written to the card                                      | ✅       | `a606eae`, `utils/nfc-utils.ts:74`                                 |
| C5  | Card-side profile fallback to the generic event page when no account/profile                                | ✅       | `EventNfcBatchService.ts:219-226` (BE), consumed by App write path |
| C6  | Platform-aware NFC capability messaging (iOS cannot write)                                                  | ✅       | `nfc-bind.tsx` `Platform.OS` branch                                |

**Reading of §A–§C.** The App's defensible scope is **C1–C6 plus A1–A9, A13, A17, A18** — hardware
proximity and door throughput. Everything in §B that is not marked ➖ is _desk work_ that the web
console already does with 10× the screen and a keyboard.

---

## D. Scope criterion (stated, so it can be argued with)

The research (`02-industry-research.md` §D1.5, §D3.1) found the industry splits native vs web by
**input density and hardware proximity**, not by screen count:

> Bizzabo ships check-in, badging, session access control, consent capture, lead retrieval **and**
> wearable pairing in one native app. Cvent's own documentation admits unclosed Android parity.

Applied to LinkCard, the criterion is:

| Test                                                       | Native candidate | Web candidate |
| ---------------------------------------------------------- | ---------------- | ------------- |
| Requires a sensor (camera, NFC, printer, BLE)?             | ✅               |               |
| Used while standing, offline-capable, ≤ 5 taps?            | ✅               |               |
| Requires a multi-column table, CSV, or bulk edit?          |                  | ✅            |
| Requires reading > 2 screens' worth of context?            |                  | ✅            |
| Is a one-time setup (ticket types, capabilities, content)? |                  | ✅            |
| Is a financial/legal action (bank transfer, refund)?       |                  | ✅            |

This criterion produces the recommendation in `04-architecture-options.md` §4: the App's target scope
is **narrow and tactile**, and the correct response to §B is not "build 23 screens".

---

## E. Gap ledger (what must change, by class)

| Class                              | Items                                                                                                     | Nature                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **E-1 Door-side gaps that matter** | A14 (badge export — arguably ➖), A16 (session door check-in), A19 (wallet at desk), A6 (undo a check-in) | Product decisions, small surface           |
| **E-2 Contract gaps**              | B6 (capabilities invisible to the App), B8/B9 (email status + resend), plus silent semantic drift D-5     | **Correctness risk**, not feature gap      |
| **E-3 Structural gaps**            | D-4 (no event OpenAPI), D-10 (no shared package/tokens), D-11 (stale context doc), D-2 (1/12 commit rate) | These _cause_ E-1 and E-2 to recur         |
| **E-4 Explicitly out of scope**    | §B desk capabilities, A20 (offline), A21 (printing)                                                       | Declare ➖ or defer with a decision record |

**The recommendation in `04` and `05` is ordered E-3 → E-2 → E-1, not E-1 → E-2 → E-3.** Fixing
features on top of a contract that cannot describe itself is what produced this audit.
