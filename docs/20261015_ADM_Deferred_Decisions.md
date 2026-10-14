# Admin App — Deferred Decisions Register

**Date opened:** 2026-10-15
**Purpose:** make every deliberate non-decision **visible**, so "not done" is distinguishable from
"never considered".

Each row is a decision **someone must make**. None of them can be settled by an engineer alone — they
are product, risk, or procurement calls. `Status: OPEN` means the audit deliberately did not pick for
you.

---

## DD-01 — Offline check-in / queue-and-sync

| Field                 | Value                                                       |
| --------------------- | ----------------------------------------------------------- |
| **Status**            | **OPEN** · needs a product owner                            |
| **Raised**            | parity audit `D-8` correction; gap matrix `A20`             |
| **Severity if wrong** | High — door-side failure is non-recoverable during an event |

**Context.** Offline check-in is **absent on both surfaces** — the Expo app and the web console. This
is not a parity gap; it is a capability nobody has built. The research calls it table stakes for events
over roughly 100 attendees (`02-industry-research.md` §D2.1), and the audit's own risk narrative
(`D-6`) says the door is where failure is non-recoverable.

The industry answer is not a screen — it is a system design: **edge-first admission** (the admission
decision is made on local hardware, with local durable storage and conflict-free merge on reconnect).
The one published conflict rule the research could find was a vendor heuristic, not a standard
(`02` §A2.5 ❓).

**Options**

| #   | Option                                                        | Cost                    | Risk                                            |
| --- | ------------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
| A   | Build edge-first offline check-in                             | a programme, not a task | high complexity, needs a sync/conflict design   |
| B   | Pre-load the attendee list + queue writes locally             | moderate                | duplicate check-ins unless conflicts are stated |
| C   | Accept the risk; rely on venue wifi + fallback to paper       | none                    | silent failure exactly when it matters          |
| D   | Scope it to a specific high-value event type (e.g. workshops) | moderate                | partial coverage may confuse operators          |

**Recommendation from the audit:** decide explicitly, and if C is chosen, **write that down here** —
an unowned risk is worse than a deferred one.

---

## DD-02 — Email status chip + resend inside the app

| Field      | Value                  |
| ---------- | ---------------------- |
| **Status** | **OPEN**               |
| **Raised** | gap matrix `B8` / `B9` |

**Context.** The backend exposes per-registration email status (`a4f60b5b`) and a re-queue endpoint
(`5e19476a`); the web console uses both. The app does not.

It passes the "≤ 5 taps" test, so it is _arguably_ door-side work — but it is equally arguably a desk
task ("why didn't this person get their ticket?" is usually a pre-event question).

**Decision needed:** is "resend this attendee's ticket" a door-side action? If yes, it becomes a small
feature (`P4-4`). If no, it stays on web and the scope policy should record it.

---

## DD-03 — Wallet top-up / deduct on a door device

| Field      | Value                            |
| ---------- | -------------------------------- |
| **Status** | **OPEN** — risk decision, not UX |
| **Raised** | gap matrix `A19`                 |

**Context.** The app already reads the token ledger (read-only). Writing (top-up / deduct) is
available on web only. Putting a **financial mutation** on a phone at a busy door is a different risk
class from everything else in the app: no auditor present, high time pressure, hard to reverse.

**Decision needed:** allow it, gate it behind a supervisor role, or keep it web-only. If allowed, it
needs its own confirmation + audit-trail requirement.

---

## DD-04 — Badge printing

| Field      | Value                  |
| ---------- | ---------------------- |
| **Status** | **OPEN** — procurement |
| **Raised** | gap matrix `A21`       |

**Context.** Absent on both surfaces. Requires hardware selection (printer model, label stock, driver
support on iOS) before any software decision is meaningful.

**Decision needed:** is on-site badge printing in scope for the next events at all?

---

## DD-05 — The 29 duplicated files between the two Expo apps

| Field      | Value                                    |
| ---------- | ---------------------------------------- |
| **Status** | **OPEN** · larger than the token package |
| **Raised** | parity audit `D-10` / `D-14`             |

**Context.** `comm -12` between the two apps' `src/` trees returns **29 identically-named files, zero
byte-identical** — including all 9 `components/ui/*`, seven `utils/*`, three `services/*`,
`auth.store.ts`, `api.types.ts`, `config.ts`, `theme.ts`, `copy.zh-TW.ts`. At least five are ≥ 0.92
similar. Two have already diverged **semantically** (`theme.ts` `tabBarHeight` 52 vs 56; `config.ts`
different failure behaviour).

**Options**

| #   | Option                                                      | Notes                                                                                                                            |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A   | Extract a **pure-data** package first (tokens + enums only) | the audit's recommendation; no React, no native module ⇒ none of Expo's documented singleton/autolinking failure modes can occur |
| B   | Also package the 9 UI components                            | a much larger job; requires wiring two build systems                                                                             |
| C   | Leave as copies, add a normalised-drift guard               | cheapest; makes divergence _visible_ but not impossible                                                                          |

**Recommendation:** A then C, and revisit B only after the token package has survived a release. Full
reasoning in `docs/analysis/adminapp-parity-20261015/04-architecture-options.md` §B2 and
`06-tech-debt-prevention.md` Rule 3.

---

## DD-06 — Contract floor: annotate all 121 endpoints, or only the consumed 14?

| Field      | Value                                          |
| ---------- | ---------------------------------------------- |
| **Status** | **DECIDED** (audit recommendation, reversible) |
| **Raised** | parity audit `D-4`                             |

**Decision.** Annotate **only the 14 endpoints the app consumes**, generate a checked-in client, and let
compile errors catch drift. Expand from there.

**Why not all 121.** The research's own tooling analysis (`02` §B1.2) is that generators consume a
_document_ and do not care how much is covered. A 121-endpoint annotation sprint would be a large,
low-feedback project; a 14-endpoint one produces a working gate immediately.

**Residual risk, stated.** A generated client catches **shape** drift, not **lag**. The lag mechanism
(the `min_supported_client` handshake + client-version telemetry) is Phase 3 and has **no published
prior art** the research could find (`02` §B3.4 ❓) — it has to be invented.

---

## DD-07 — Is `LinkCard_Frontend` the reference implementation?

| Field      | Value                               |
| ---------- | ----------------------------------- |
| **Status** | **DECIDED** (audit recommendation)  |
| **Raised** | `06-tech-debt-prevention.md` Rule 7 |

**Decision.** Yes. The contract is derived from the web event admin console; the app is a **declared
subset consumer**. When they disagree, the web is presumed correct unless a decision record says
otherwise — with one exception: the app's native-only capabilities (NFC write, the card URL resolver,
the desk handoff) are app-owned, and the web is **not** the reference for them.

**Consequence to accept:** adding a web admin capability does **not** create an app obligation. It
creates an obligation to _triage_ — adopt, defer with a reason here, or declare ➖ in the scope policy.

---

## Open decisions summary

| ID    | Topic                        | Type                 | Status                          |
| ----- | ---------------------------- | -------------------- | ------------------------------- |
| DD-01 | Offline check-in             | product risk         | **OPEN**                        |
| DD-02 | Email status / resend in app | product              | **OPEN**                        |
| DD-03 | Wallet top-up at the door    | financial risk       | **OPEN**                        |
| DD-04 | Badge printing               | procurement          | **OPEN**                        |
| DD-05 | 29 duplicated files          | engineering strategy | **OPEN** (approach recommended) |
| DD-06 | Contract floor scope         | tooling              | DECIDED                         |
| DD-07 | Reference implementation     | governance           | DECIDED                         |
