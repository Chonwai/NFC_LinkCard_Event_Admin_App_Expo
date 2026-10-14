# Admin App — Native Scope Policy

**Status:** ADOPTED · **Date:** 2026-10-15 · **Owner:** _unassigned — see §6_
**Prevents:** `D-9` (an escape hatch existing by accident) and the failure mode of "build every
missing screen natively"

---

## 1. Why this document exists

The parity audit found the Admin App committing at roughly **1/9.5 of the Frontend's and 1/14 of the
backend's rate** on product code, against a backend surface of **121** event endpoints of which the
app consumes **14**. That is not a defect by itself — a narrow scope is a legitimate design.

What _is_ a defect is that **the line between "native" and "belongs on the web" was never written
down.** One screen (`token.tsx`) already implements the "open it in the browser" pattern, but it did so
by accident, and nothing tells a future contributor whether a second such screen is acceptable.

This policy makes the line explicit, closes it, and states how to change it.

---

## 2. The criterion

A capability belongs in the **native** app only if it passes the hardware **or** the input test:

| Test                   | Belongs natively if…                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Hardware proximity** | it needs a sensor or radio — camera, NFC, BLE, printer                        |
| **Input density**      | it is used **standing up**, with ≤ 5 taps, and reading ≤ 2 screens of context |
| **Offline tolerance**  | it must survive a flaky network at a venue                                    |

It belongs on the **web** console if any of these is true:

| Test                                                                       | Belongs on web if… |
| -------------------------------------------------------------------------- | ------------------ |
| Multi-column table, CSV, or bulk edit is involved                          |                    |
| More than two screens of context must be read at once                      |                    |
| It is one-time setup (ticket types, capabilities, page content, org roles) |                    |
| It is a financial or legal action (payouts, refunds, plan changes)         |                    |

> **Attribution — read this before quoting the criterion.** This is **our** synthesis, derived from two
> source families in `docs/analysis/adminapp-parity-20261015/02-industry-research.md` (hardware access
> in §A2.1, vendor feature splits in §D1). **No source states it.** The research labels it as synthesis
> itself (§D3.2) and records the underlying question as unanswered (§D3.1 ❓). Its most serious
> counterexample is Bizzabo, which ships a _broad_ native surface — but that surface is broadly
> _tactile_ (badging, session access, lead retrieval, wearable pairing), which is why the criterion
> uses input density rather than screen count. Treat this as an argued position, not a citation.

---

## 3. What is native today

| Native and correct                                                        | Evidence                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| QR camera check-in (3s lookup cap, 15s success hold, "continue scanning") | `src/app/(auth)/[eventId]/check-in.tsx`                |
| NFC write / read-back / exchange                                          | `nfc-bind.tsx`, `nfc-read.tsx`, `nfc-exchange.tsx`     |
| Walk-in registration with dynamic fields + consent                        | `walk-in.tsx`                                          |
| Door-side attendee lookup and registrant detail                           | `registrations.tsx`, `registrant/[registrationId].tsx` |
| Badge inventory browse                                                    | `badges.tsx`                                           |
| Supervisor check-in override                                              | `check-in.tsx`                                         |
| Desk handoff (check-in → write card → prefill)                            | `src/utils/desk-handoff.ts`                            |

These pass the hardware or input test. **They are the app's reason to exist**, and three of them
(NFC write, the `/t/{eventId}/{tagUid}` resolver, the desk handoff) have **no web equivalent at all**.

---

## 4. The ➖ list (closed)

Screens that deliberately open the web console instead of reimplementing it.

| Screen              | Target                                    | Rationale                                                    |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `…/[eventId]/token` | `${WEB_BASE_URL}/manage/{eventId}/wallet` | Token ledger + top-up is a wide table and a financial action |

**That is the entire list — one entry.** Adding a second entry requires a pull request that edits this
table and states which test the candidate fails. It is not a judgement call made in a screen file.

---

## 5. The escape hatch is a deep link, not a WebView

A ➖ screen may open the **system browser** (`Linking.openURL`). It may **not** wrap the web console in
a WebView, and the app as a whole may not become a shell around the web console:

> _"Your app should include features, content, and UI that elevate it beyond a repackaged website. If
> your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store."_
> — App Store Review Guidelines §4.2 (primary source:
> https://developer.apple.com/app-store/review/guidelines/)

`token.tsx` uses `Linking.openURL` and is compliant. A future contributor who "simplifies" that into a
WebView would put the app's listing at risk — which is why this paragraph exists.

**The app must remain genuinely native.** It does: camera, NFC, and the desk handoff are not
reimplementable on the web on iOS (Web NFC is not implemented in Safari — MDN compatibility table for
`NDEFReader`: Safari _no support_, Safari on iOS _no support_, Chrome Android _full support 89_).

---

## 6. Explicitly out of scope for the app

Each of the following fails a test above. They are **not** gaps to be closed; they are deliberate
boundaries. Product decisions that could change them are tracked in
`docs/20261015_ADM_Deferred_Decisions.md`.

| Capability                                          | Why it is not native                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Ticket types CRUD                                   | one-time setup, long forms → web (`manage/[eventId]/ticket-types`)                          |
| Ticket capability editor + per-event rollout switch | one-time setup → web                                                                        |
| Event profile / settings                            | one-time setup → web                                                                        |
| Page content / sections                             | layout composition → web                                                                    |
| Polls                                               | authoring is a table; the _voting_ surface is attendee-side, not admin-side                 |
| Exhibitors CRUD, import, invites, company page      | CSV + multi-column → web                                                                    |
| Org roles / staff invites                           | one-time setup → web                                                                        |
| Bank transfers                                      | financial → web                                                                             |
| Business matching admin                             | multi-column queue → web                                                                    |
| Exhibitor networking inbox                          | inbox + threading → web                                                                     |
| Attendee / exhibitor CSV export                     | file generation → web                                                                       |
| Workshop sessions CRUD                              | authoring → web                                                                             |
| Association vertical                                | not the event app's job                                                                     |
| Badge inventory CSV export                          | file generation → web                                                                       |
| Offline check-in / queue-and-sync                   | **absent on both surfaces** — a programme, not a screen. See the deferred decision `DD-01`. |
| Badge printing                                      | requires hardware procurement. See `DD-04`.                                                 |

**Ownership note (honest).** The audit found the app's own documentation went stale within 32 days
(`D-11`), and this repo currently has no named owner for the app ↔ contract boundary. §7 asks for one.

---

## 7. The recurring task this policy creates

Two things must stay true, or the drift returns:

1. **Re-run the drift measurement quarterly.** The commands are in
   `docs/analysis/adminapp-parity-20261015/01-drift-audit.md` §2–§3 and §10 of
   `08-evidence-log.md`. The alarm is the commit-rate ratio, not any single missing feature.
2. **Review every `src/events/**` change against an additive-only rule.** The checklist is
   `06-tech-debt-prevention.md` Rule 1.

Both need a name attached. Until one exists, this policy is a document rather than a control.
