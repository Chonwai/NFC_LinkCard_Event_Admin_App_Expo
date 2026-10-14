# 04 — Architecture Options and Recommendation

## 0. Decision framing

The question is not "how do we bring the App up to date". `01-drift-audit.md` shows that catching
up is a _symptom_; the mechanism is that **the App commits at 1/10th–1/14th the rate of both
upstream repos and there is no machine-readable contract to tell it when it has fallen behind**
(D-2, D-4, D-10).

So the question is: **what structure makes it cheap to be 2 weeks behind, and detectable when you
are 6 months behind?** That reframing is what the research independently arrived at:

> _"A user running a four-month-old build is a normal, common, permanent condition. There is no
> 'deploy the client.'"_ — research §A1.4

> _"The management response is not 'work faster' — it is to make the lag **measured and bounded**."_
> — research takeaway 13

---

## 1. The one constraint that eliminates half the option space

Before comparing options, settle what the App is _for_, because several options are only viable if
the App has no unique capability.

**The App's irreplaceable capability is NFC card writing (A10).** Web NFC (`NDEFReader`) is not
implemented in Safari:

> _"Web Bluetooth and Web NFC are not implemented in Safari at the time of writing, so any iOS
> requirement here points to native."_ — research §A2.1, `[S]`
> https://koddelta.com/en/blog/pwa-or-native-app

> _"NFC integration (like tapping phones to wristbands) … web NFC is possible on Android Chrome for
> certain use cases, but on iOS it might still be restricted to native apps."_ — research §A2.1, `[S]`

**Consequence.** Any option that retires the native app (Option D) forfeits write-on-site badge
issuance on iOS, which is `nfc-bind.tsx` (682 LOC) — the single largest screen in the App and the
one capability with no web equivalent. The App must survive. The only open question is its
_scope_.

---

## 2. Options

### Option 0 — Status quo (baseline, for comparison)

Add features ad hoc, as they come up, driven by whatever an organiser reports.

| Criterion           | Reading                             |
| ------------------- | ----------------------------------- |
| Cost now            | 0                                   |
| Cost over 12 months | Highest — this audit is the receipt |
| Detects drift       | No                                  |
| Bus factor          | Single-person                       |

Already falsified by `01-drift-audit.md` D-5 (13 of 15 contract-relevant changes unabsorbed).

---

### Option A — "Parity push": build the 23 missing screens natively

| Criterion        | Reading                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cost             | ~23 screens; the FE equivalents total ≈ 6,500 LOC of page code plus ~30 `lib/events/*` modules. Even at a favourable 1:1.5 ratio for mobile, ≈ 9,000–10,000 LOC plus services. |
| Value delivered  | Low. §D of the gap matrix shows these are desk workflows: multi-column tables, bulk CSV import, payout config.                                                                 |
| Drift prevention | **None.** It widens the surface that must then be kept in sync.                                                                                                                |
| Reversibility    | Low — every new screen is a new maintenance obligation.                                                                                                                        |

**Rejected.** Research §D3.1 found no evidence that a broad native admin surface is _inherently_ a
trap, and Bizzabo ships a broad one — but Bizzabo's surface is tactile work (badging, session access,
lead retrieval, wearable pairing), not desktop configuration. LinkCard's missing 23 are the
configuration kind.

---

### Option B — Contract-first "tactile subset" (recommended)

Five pillars, none of which require merging repositories.

#### B1. A machine-readable contract for the event vertical — starting small

D-4 is the root cause: `src/events/` has **0** OpenAPI annotations while `swagger-jsdoc` is already
wired and `src/docs/api-schemas.ts` already holds 1,198 lines of reusable schemas. The
infrastructure exists; the annotations do not.

The research is explicit that the _first_ move must be the smallest one:

> _"`openapi-typescript` + `openapi-fetch` is ~6 kb with zero runtime, so there is no bundle-size
> argument against shipping the same generated types into the Expo app. This converts silent drift
> into compile errors **inside the Admin App repo** — the one gate that fires without the app's CI
> having to know about the backend."_ — research takeaway 2, `[HIGH]`

And that annotating everything first would be the wrong order:

> _"...they do not care whether that document is hand-written, jsdoc-derived, or zod-generated."_
> — research §B1.2

**Concretely:** annotate the **13 endpoints the App already consumes**, plus the endpoints needed by
the small door-first backlog (§5), generate `types.d.ts` into a checked-in artifact, and let the App
compile against it. Expand coverage from there. Do **not** attempt a 121-endpoint annotation sprint.

Honest limit, stated up front:

> _"for a separate repo that does not build against the producer's spec, none of schema-diff, CDC, or
> generated-client catches the lag. The missing mechanism is … **telemetry on which contract version
> each live client is on.**"_ — research takeaway 3, `[MED]`, and §B3.4 ❓

That missing mechanism is pillar B3.

#### B2. A pure-data shared package — tokens and enums only

D-10: the two Expo apps share a _copy_ of `theme.ts`, and the copies have already diverged past the
point where `diff` is meaningful. The research's prescription is unusually specific:

> _"make it a **pure data package** (tokens as platform-agnostic TS objects, no React, no native
> module). A data-only package sidesteps every failure mode in §C1.3 (singleton React, autolinking,
> hoisting) because there is nothing to hoist. Do **not** jump to a shared RN UI component library."_
> — research takeaway 7, `[HIGH]`

This matters because Expo documents the exact failure mode that a React-bearing shared package
introduces:

> _"Runtime issues happen when a package has been written to act as a singleton. … A common example is
> the `react` package."_ — research §C1.3, `[P]`
> https://github.com/expo/fyi/blob/main/resolving-dependency-issues.md

**Concretely:** a package containing design tokens, `TICKET_CAPABILITIES` keys, registration status
enums, and the capability-name vocabulary — consumed by the Promoter App, the Admin App, and the
Frontend. Referenced by a per-app dependency, **not** a root workspace (research §C1.2 option 1:
the lowest-friction path that does not require converting to a full monorepo).

#### B3. A runtime capability + version handshake

The backend already contains the right _data_ — `EventTicketType.capabilities` and
`Event.ticketCapabilitiesEnabled` — but it lives only in the DB (D-7) and only the Frontend reads it.

> _"The strongest pattern is exactly this, with one addition: 'the backend becomes the primary source
> of truth for feature support', and the client's declarations should be **generated from backend
> contracts** rather than hand-maintained."_ — research takeaway 11, `[HIGH]`

The three-layer shape recurs across independent sources (research §A1.3):

| Layer     | Mechanism                                                 | Catches                          |
| --------- | --------------------------------------------------------- | -------------------------------- |
| Manifest  | which client versions ship against which contract version | release-time mistakes            |
| Contract  | generated `types.d.ts` (B1)                               | compile-time drift               |
| Handshake | `min_supported_client` + capability flags at login        | runtime lag — the permanent case |

Companion mechanism for release latency:

> _"The 'runtimeVersion' property allows us to guarantee that an update is compatible with a specific
> build's native code."_ — research §A3, quoting Expo docs `[HIGH]`

So: **admin-layer screens ship over EAS Update; only new native capability needs a store trip.** This
is what makes "the web admin shipped on Tuesday" survivable.

#### B4. A written scope policy — with the escape hatch made legitimate

D-9: `token.tsx` already implements the "this belongs on the web" pattern, but by accident and
without a stated rule. The risk of formalising it naively is Apple Guideline 4.2:

> _"Your app should include features, content, and UI that elevate it beyond a repackaged website."_
> — research §A1.5, `[HIGH]` (primary Apple text)
> https://developer.apple.com/app-store/review/guidelines/

**Important nuance.** Guideline 4.2 prohibits the app _being_ a WebView shell. It does not prohibit an
individual screen from deep-linking out to the browser — which is exactly what `token.tsx` does today
via `Linking.openURL`, opening the system browser rather than embedding a WebView. The policy is
therefore:

- The app must be **door-first and genuinely native** (it is: camera, NFC, offline-tolerant flows).
- A small, enumerated set of desk surfaces may be ➖ with an explicit "Open on desktop" action.
- That set is **capped and reviewed**, not grown opportunistically.

#### B5. A door-first backlog, not a parity backlog

Only capabilities passing the §D criterion in `03-gap-matrix.md` are candidates. That is a short list
(§5 below), not 23 screens.

---

### Option C — Merge into a real monorepo (pnpm workspace + Turborepo)

| Criterion       | Reading                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared packages | Best-in-class — Expo's docs say monorepo support is built into `expo/metro-config` and is _less_ configuration, not more (research §C1.1)                                                  |
| Migration cost  | 5 repos with independent remote history; Vercel (Frontend), Vercel/EAS (App), and backend CI all re-wire                                                                                   |
| Blast radius    | Highest of any option — this workspace runs **multiple concurrent agent sessions** (1108 backend commits since 2026-09-25), so a repo-topology change lands on top of other in-flight work |
| Reversibility   | Low                                                                                                                                                                                        |
| Prerequisite    | At least two genuinely shared **code** packages. Today there are **zero** — only a duplicated token file.                                                                                  |

**Deferred, not rejected.** The evidence for deferring is that Option C's benefit is proportional to
the number of shared packages, and that number is currently ~1 (a token file), which B2 solves
without the migration.

---

### Option D — Retire the native app, go PWA

| Criterion                | Reading                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocks on                | **iOS NFC write is impossible** — Web NFC is not in Safari (research §A2.1)                                                                          |
| Also blocked by          | Apple Guideline 4.2 if a WebView shell is used; iOS web push requires add-to-home-screen (research §A2.3), which MDM-managed door devices may forbid |
| What it _would_ work for | Camera QR check-in and offline queueing — both are documented as web-capable (research §A2.2)                                                        |

**Rejected.** It forfeits A10 (`nfc-bind.tsx`, 682 LOC) and the on-site badge-issuance product.

---

### Option E — Promote the App to primary, demote the web console

**Rejected.** The split is by input density and hardware proximity, not by seniority
(research §D1.5). Ticketing, CSV import, and payouts are not phone work.

---

## 3. Comparison

Scores: ● strong, ◐ workable, ○ weak.

| Criterion                         | 0 Status quo | A Parity push | **B Contract-first subset** | C Monorepo | D PWA | E Promote App |
| --------------------------------- | ------------ | ------------- | --------------------------- | ---------- | ----- | ------------- |
| Stops recurrence of this audit    | ○            | ○             | **●**                       | ●          | ◐     | ○             |
| Cost to start                     | ●            | ○             | **●**                       | ○          | ◐     | ○             |
| Preserves NFC issuance            | ●            | ●             | **●**                       | ●          | ○     | ●             |
| Value per unit of work            | ○            | ○             | **●**                       | ◐          | ◐     | ○             |
| Reversibility                     | ●            | ◐             | **●**                       | ○          | ○     | ◐             |
| Works with multi-session workflow | ●            | ◐             | **●**                       | ○          | ◐     | ○             |
| Respects Apple review rules       | ●            | ●             | **●**                       | ●          | ◐     | ●             |

---

## 4. Recommendation

**Adopt Option B**, sequenced as `05-remediation-plan.md` describes:

1. **Phase 0 — Stop the bleeding (days).** Refresh the App's stale orientation doc (D-11); record the
   scope policy (B4) so future work has a rule to check against; declare the ➖ list.
2. **Phase 1 — Contract floor (the highest-leverage work).** Annotate the App's 13 consumed endpoints,
   emit a checked-in `openapi.json` + generated `types.d.ts`, wire a CI drift gate. Correct the
   semantic drift found in D-5 against the generated types.
3. **Phase 2 — Shared data package.** Extract tokens + enums; consume from both Expo apps and the
   Frontend; add a CI check that the package is the only source (making D-10 non-recurring).
4. **Phase 3 — Runtime handshake.** `min_supported_client` + capability flags + EAS Update
   `runtimeVersion` discipline.
5. **Phase 4 — Door-first features.** The short list from §5.

**Revisit Option C when** two or more genuinely shared _code_ packages exist (i.e. after Phase 2 plus
one more), or when cross-repo atomic changes become routine. Record that trigger now so the decision
is not re-litigated from scratch.

---

## 5. The door-first feature list (Phase 4 candidates)

Derived from `03-gap-matrix.md` §D, not from "what the web has".

| Candidate                              | Why it passes the criterion                                                                                  | Evidence                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Session / workshop door check-in (A16) | Standing at a room door, phone in hand, ≤ 5 taps                                                             | `sessions-polls.routes.ts` `POST …/sessions/:id/checkin` exists          |
| Undo / correct a check-in (A6)         | Door staff make mistakes 100× more often than desk staff                                                     | `POST /registrations/:id/status` (`67cd592f`) exists; FE already uses it |
| Capability visibility (B6)             | Not a screen — the App must _know_ whether sessions/wallet are on for this event, or it will offer dead ends | `Event.ticketCapabilitiesEnabled`, `event_ticket_types.capabilities`     |
| Email status + resend (B8/B9)          | Debatable — passes "≤ 5 taps" but is arguably desk work. **Recommend a decision record**, not an assumption  | `a4f60b5b`, `5e19476a`                                                   |
| Badge export (A14)                     | Fails the criterion (CSV, large file) → ➖                                                                   | `GET …/nfc/badges/export`                                                |
| Wallet top-up / deduct (A19)           | Passes "≤ 5 taps" but is a _financial_ action → needs an explicit risk decision                              | `premium.routes.ts`                                                      |

**Explicitly deferred, with reasons** (not silently dropped):

| Deferred                                | Reason                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline check-in / queue-and-sync (A20) | Absent on **both** surfaces — a net-new product decision. Note that the industry answer is edge-first local storage with conflict-free merge on reconnect (research §A2.4), which is a system design, not a screen. |
| Badge printing (A21)                    | Requires hardware procurement.                                                                                                                                                                                      |
| All §B desk capabilities                | Fail the input-density criterion.                                                                                                                                                                                   |

---

## 6. What this option deliberately does _not_ do

- It does not build 23 screens.
- It does not convert to a monorepo.
- It does not adopt `Deprecation`/`Sunset` headers yet — the research is explicit that the additive
  rule is stage one and the RFC 8594/9745 headers are stage two:

  > _"Publish the policy now; wire the headers when there is a second client version to protect."_
  > — research takeaway 14, `[HIGH]`

- It does not claim the drift is eliminated. It claims the drift becomes **measured and bounded**,
  which is the strongest claim the evidence supports.
