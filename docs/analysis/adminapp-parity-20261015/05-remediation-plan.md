# 05 — Remediation Plan

## 0. How to read the estimates

**Calibration anchor (measured, not assumed).** Over 2026-09-25 → 2026-10-15 the Admin App produced
**25 commits / 15 touching `src/`**, delivering 10 event-scoped screens + 2 app-level screens
(**5,315 LOC**, measured — an earlier draft of `01` said 5,479, which did not match its own per-file
figures; see review finding V-11), 5 services (394 LOC), and 29 test files (`tests/*.test.mjs` = 25,
`tests/journeys/*.test.mjs` = 4).

So the working rate of this repo is roughly **"three weeks ≈ 5.5k LOC of screen code plus tests"**.

Every estimate below is expressed in **engineer-days** anchored to that, and marked as an
_engineering estimate_. None of it is a measurement. Phase 1 and 2 estimates carry a second,
independent uncertainty: they touch the backend and the Frontend, where other sessions are active
(see §6).

---

## Phase 0 — Stop the bleeding

Goal: remove the _live_ misdirection before doing structural work. All of P0 is documentation and
decision, no product code.

| #    | Task                                                                                                                                        | DoD (verifiable)                                                                                                                                                                                                                                                                                                                    | Est. |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P0-1 | Rewrite `LinkCard_Event_Admin_App_Expo/docs/.project-context.md`                                                                            | Testing section no longer says "無 test framework"; route inventory lists **10** event screens; API inventory lists **14** endpoints; it notes that CI already exists. Verify: `grep -c 'test framework' → 0`; count rows in each table against `ls src/app/(auth)/[eventId]/*.tsx` and the endpoint grep in `01-drift-audit.md` §3 | 0.5  |
| P0-2 | Write `docs/2026xxxx_ADM_Scope_Policy.md`: the native/➖ rule                                                                               | Contains §D's criterion table; contains a **closed, enumerated** ➖ list; states that ➖ surfaces must offer an "Open on desktop" action; states the Apple 4.2 rationale so the rule is not misread as "webview the app"                                                                                                            | 0.5  |
| P0-3 | File the deferred items as explicit decision records                                                                                        | A20 (offline), A21 (printing), and every §B desk capability appear with a reason, not an absence                                                                                                                                                                                                                                    | 0.5  |
| P0-4 | Add a **normalised** token-comparison script (the divergence is semantic, so a formatter config would not address it — review finding V-18) | One path only: `scripts/compare-tokens.mjs` normalises whitespace / quote style / trailing semicolons, diffs the two token files, and **exits non-zero on the 7 known semantic differences**. Prove RED→GREEN by re-introducing one (e.g. set the Admin App's `tabBarHeight` back to 56 and watch it fail)                          | 0.5  |

**Phase 0 total: 2 engineer-days.** Exit criterion: a new contributor reading only the App repo's
docs cannot reach a wrong conclusion about the App's surface.

---

## Phase 1 — Contract floor (highest leverage)

Goal: make the App's contract compile-checked, so drift becomes a build error in the App's own repo.

| #    | Task                                                                                                                                                     | DoD (verifiable)                                                                                                                                                                                                                                                                                | Est. |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P1-1 | Annotate the **14 consumed endpoints** (not all 121) with `@openapi` in `src/events/routes/*.ts`, reusing `src/docs/api-schemas.ts`                      | `grep -c '@openapi' src/events → ≥ 14`; `/api-docs` renders them                                                                                                                                                                                                                                | 3    |
| P1-2 | Emit `openapi.json` as a build artifact and commit a generated `types.d.ts` (`openapi-typescript`)                                                       | Both files exist in the repo and are regenerable by one documented command; diffing a regenerated copy is clean                                                                                                                                                                                 | 1    |
| P1-3 | Make the Admin App compile against the generated types for its service layer                                                                             | `src/services/*.ts` use generated path/response types; `npm run typecheck` passes; a deliberate mutation of a response field **fails typecheck** (RED probe, per `.prettierignore-baseline`-style guard discipline)                                                                             | 3    |
| P1-4 | **Correct the semantic drift from D-5.** Triage all 13 unabsorbed changes; for each, either adopt it in the App or record "acknowledged, not applicable" | A table exists with one row per D-5 item and a verdict; anything adopted has a test                                                                                                                                                                                                             | 4    |
| P1-5 | CI gate: regenerate the contract, fail if the checked-in copy differs                                                                                    | **`.github/workflows/ci.yml` already exists** and runs `regenerate:typed-routes`, `typecheck`, `lint`, `format:check` and `npm test` — so this **adds a step to an existing workflow**, it does not create one. DoD: a new step exists; a deliberate edit to `openapi.json` turns the build red | 0.5  |

**Phase 1 total: ~12 engineer-days**, of which P1-4 is the only one that delivers user-visible
correctness — and it is the one that closes the actual risk (D-6).

> **Ordering note.** Do P1-4 **after** P1-3. Adopting semantic changes against hand-written types is
> exactly how D-5 happened; adopting them against generated types is the whole point.

---

## Phase 2 — Shared data package

Goal: make D-10 non-recurring, without a monorepo migration.

| #    | Task                                                                                                                                                           | DoD (verifiable)                                                                                                                       | Est. |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P2-1 | Extract a **pure-data** package: design tokens (primitive → semantic → component), `TICKET_CAPABILITIES` keys, registration-status enum, capability vocabulary | Package contains **no** `react`, `react-native`, or native-module import. Verify: `grep -rE "from ['\"]react" packages/tokens/src → 0` | 1.5  |
| P2-2 | Consume it from `LinkCard_Event_Admin_App_Expo` via a per-app dependency (research §C1.2 option 1 — no root workspace)                                         | `theme.ts` in the App re-exports from the package or is deleted; `npm run typecheck` + `expo export web` pass                          | 1.5  |
| P2-3 | Consume it from `LinkCard_Promoter_App_Expo`                                                                                                                   | Same DoD; both apps now reference one source                                                                                           | 1.5  |
| P2-4 | _(optional, deferred)_ Consume it from `LinkCard_Frontend`                                                                                                     | Frontend token literals replaced; build + tests pass                                                                                   | 2    |
| P2-5 | CI guard: the package is the only source of these values                                                                                                       | A script fails if a token literal reappears locally; proven RED→GREEN                                                                  | 1    |

**Phase 2 total: ~5.5 engineer-days** for the two Expo apps (7.5 including the Frontend).

> **Risk.** `expo/metro-config` handles monorepos, but if the package lives outside the app root you
> must alias `react`/`react-native` back to the app's copy (research §C1.2 option 2). A **pure-data**
> package cannot hit this, which is the reason for the constraint — not a stylistic preference.

---

## Phase 3 — Runtime handshake and release cadence

Goal: make "the app is 6 weeks old" a _detectable, degradable_ condition rather than a surprise.

| #    | Task                                                                                                    | DoD (verifiable)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Est.                                       |
| ---- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| P3-1 | Backend publishes contract identity + `minSupportedClient` + capability flags on a bootstrap response   | Endpoint returns them; asserted by a backend unit test                                                                                                                                                                                                                                                                                                                                                                                                                       | 2                                          |
| P3-2 | App reads them at login and stores them with the session                                                | A test asserts the values are persisted and re-read on cold start                                                                                                                                                                                                                                                                                                                                                                                                            | 1                                          |
| P3-3 | App degrades: features whose capability flag is off are **hidden, not offered-then-failed**             | Per-capability tests; a feature-off event shows no dead-end entry points                                                                                                                                                                                                                                                                                                                                                                                                     | 2                                          |
| P3-4 | Version gate: below `minSupportedClient`, the App shows an explicit upgrade screen instead of operating | Test asserts the gate fires and that an in-range client is unaffected                                                                                                                                                                                                                                                                                                                                                                                                        | 1                                          |
| P3-5 | Adopt EAS Update + `runtimeVersion` discipline; document the bump rule                                  | **A prerequisite, not configuration** (review finding V-03): the app has **no `expo-updates` dependency**, no `updates` block in `app.json`, and a **committed `ios/` project (18 tracked files)** — enabling OTA adds a native module and therefore needs a rebuild and a store submission. DoD: `expo-updates` installed and an OTA-delivered change observed on a real build; the bump rule documented as "native library, native project (`ios/`), or `app.json` change" | 1.5 → **3.5** (incl. rebuild + submission) |
| P3-6 | Telemetry: which contract version each live client is on                                                | **This is the gap the research could not find published guidance for (research §B3.4 ❓).** Minimum viable form: log contract version + app version on first authenticated request; assert the field exists                                                                                                                                                                                                                                                                  | 2                                          |

**Phase 3 total: ~11.5 engineer-days** (was 9.5 before P3-5's native-rebuild prerequisite was priced in — review finding V-03).

> P3-6 is the item with no off-the-shelf answer. The research's takeaway 3 is explicit that this must
> be _invented_, not adopted. A cheap version — a logged header — is worth more than a perfect design
> that never ships.

---

## Phase 4 — Door-first features (only these)

| #    | Task                                                              | DoD (verifiable)                                                                                                                     | Est. |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| P4-1 | Session / workshop door check-in (A16)                            | `POST …/sessions/:id/checkin` wired; a test asserts the success and duplicate paths; a journey test covers scan → result             | 3    |
| P4-2 | Undo / correct a check-in (A6)                                    | `POST /registrations/:id/status` wired with a confirmation step; test asserts the status transition and the permission-denied branch | 2.5  |
| P4-3 | Capability awareness (B6)                                         | The App's quick actions render from capability flags; a test asserts that an events with `SESSIONS` off shows no session entry       | 2    |
| P4-4 | Decision records for B8/B9 (email status/resend) and A19 (wallet) | Written verdict with reasoning; if accepted, scoped as separate work                                                                 | 0.5  |

**Phase 4 total: ~8 engineer-days**, plus whatever the P4-4 decisions authorise.

**Explicitly not in Phase 4:** offline check-in (A20) and badge printing (A21). Both are absent from
_both_ surfaces — they are net-new product programmes, not parity. Offline in particular is a system
design (edge-first admission, local durability, conflict-free merge; research §A2.4), not a screen.

> **Reconciliation (review finding V-04).** `01-drift-audit.md` D-8 originally called the App's value
> "offline-tolerant". That was wrong: the App has **no** offline queue-and-sync, and this plan defers
> it. The App's real advantage is sensor work (camera, NFC) and the door handoff. Note also that the
> research calls offline check-in table stakes for events over ~100 attendees (`02` §D2.1) while this
> plan defers it — so the deferral is a **product-risk decision that needs an owner**, not a
> technical one. It is listed as an open decision below.

---

## Phase 5 — Optional structural step (gated, not scheduled)

Re-evaluate **Option C (monorepo)** when either trigger fires:

1. Two or more genuinely shared _code_ packages exist (i.e. after Phase 2 plus one more), or
2. Cross-repo atomic changes become routine enough that per-repo PRs are the bottleneck.

Record the trigger now so the decision is not re-litigated from first principles later.

---

## 6. Sequencing and the multi-session constraint

This workspace runs concurrent agent sessions — the backend recorded **1,108 commits** since
2026-09-25 against **210** touching `src/`/`prisma/`, which is what heavy doc/session churn looks like.
Two consequences:

| Constraint                                  | Mitigation                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 touches `src/events/**`, a hot area | Land P1-1 per route file, one commit each, never a bulk rewrite. Check `git status --porcelain -- <file>` before and after.        |
| Phase 2 touches two App repos               | Token extraction is additive first (create the package, keep the old file as a re-export), delete the duplicate in a later commit. |
| Any commit                                  | Always pathspec-scoped (`git commit -- <paths>`), never `git add -A`.                                                              |

**This is not hypothetical.** When the audit ran, the backend worktree was **not** clean: 5 in-flight
entries, including a modified `src/events/services/EventSessionService.ts` — exactly the hot area
Phase 1 touches — and an untracked review doc. It was clean again by the repair round. That is normal
behaviour in a multi-session workspace, and it is why Phase 1 is sequenced as many small per-file
rather than one bulk commit. (Review finding V-08; recorded as D-13 in `01-drift-audit.md`.)

---

## 7. Summary

| Phase                   | Est. (engineer-days) | Delivers                                                   | Closes            |
| ----------------------- | -------------------- | ---------------------------------------------------------- | ----------------- |
| 0 — Stop the bleeding   | 2                    | Correct documentation, stated scope policy                 | D-9, D-11         |
| 1 — Contract floor      | 12                   | Compile-checked contract; 13 semantic drifts triaged       | **D-4, D-5, D-6** |
| 2 — Shared data package | 5.5 (7.5 with FE)    | One token source across Expo apps                          | D-10, D-14        |
| 3 — Runtime handshake   | 11.5                 | Bounded, detectable lag; OTA cadence                       | D-2, D-15         |
| 4 — Door-first features | 8 (+decisions)       | Session door check-in, undo check-in, capability awareness | D-8, E-1          |
| **Total**               | **~39 (41 with FE)** |                                                            |                   |

Phase sums: `2 + 12 + 5.5 + 11.5 + 8 = 39`. Adding `P2-4` (Frontend consumption, 2) gives 41.

The **estimates are estimates**: no engineer-day figure appears in `01`, `03`, `04`, or `06`, so
nothing in those documents can be mistaken for a measurement.

### Open decisions this plan does not make

Each of these is a product decision needing an owner, deliberately left open:

| Decision                                                      | Why it cannot be settled here                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offline check-in (A20) — build, buy, or accept the risk       | The research calls it table stakes over ~100 attendees (`02` §D2.1) and it is absent on **both** surfaces. It is a programme, not a task, and the deferral is a **product-risk** decision. |
| Whether the App gets email status / resend (B8/B9)            | Passes the "≤ 5 taps" test but is arguably desk work.                                                                                                                                      |
| Whether wallet top-up (A19) belongs on a door device          | A financial action on a phone at a busy door is a risk decision, not a UX decision.                                                                                                        |
| Badge printing (A21)                                          | Requires hardware procurement.                                                                                                                                                             |
| Whether to package the 29 near-duplicate UI components (D-14) | Larger than the token package; needs its own scoping after Phase 2.                                                                                                                        |

`06-tech-debt-prevention.md` states what must stay true _after_ these phases, or the drift returns.

---

## 8. How to know it worked

Tripwires — each is a thing that should become **impossible or visible**, with a way to check it:

| Tripwire                                                            | Check                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A backend response field changes and the App does not notice        | App `typecheck` fails (Phase 1)                                                              |
| A token value diverges between the two Expo apps                    | CI guard fails (Phase 2)                                                                     |
| A live client is running a contract older than `minSupportedClient` | It shows the upgrade screen, and the event is logged (Phase 3)                               |
| A desk feature is built into the App "because it was easier"        | It violates the Phase 0 scope policy, and the policy is a reviewable file                    |
| The App falls 30+ days behind again                                 | The commit-rate ratio in `01-drift-audit.md` §2 is re-run quarterly; the number is the alarm |
