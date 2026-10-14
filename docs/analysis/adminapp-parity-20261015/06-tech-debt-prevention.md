# 06 — Tech-Debt Prevention

`05-remediation-plan.md` is a finite piece of work. This file states what must **stay true
afterwards**, or the drift returns. Each rule names the finding it prevents and the mechanism that
enforces it. A rule with no mechanism is not a rule.

---

## Rule 1 — `/api/v1/events` is additive-only

**Prevents:** D-5 (13 of 15 contract-relevant changes silently unabsorbed).
**Mechanism:** a written policy on the event vertical, plus the Phase-1 compile gate.

Adopt the two most-followed published policies rather than inventing one. Stripe's enumerated list of
what it _considers backward-compatible_ (research §B3.2, `[P]`):

> _"Adding new API resources. Adding new optional request parameters to existing API methods. Adding
> new properties to existing API responses. Changing the order of properties in existing API
> responses. Changing the length or format of opaque strings…"_
> https://docs.stripe.com/api-versions

GitHub's breaking-change taxonomy is the negation, and it is more useful as a review checklist
(research §B3.2, `[P]`):

> _"Removing an entire operation · Removing or renaming a parameter · Removing or renaming a response
> field · Adding a new required parameter · Making a previously optional parameter required ·
> Changing the type of a parameter or response field · Removing enum values · Adding a new validation
> rule to an existing parameter · Changing authentication or authorization requirements."_
> https://docs.github.com/en/rest/about-the-rest-api/breaking-changes

**Applied to LinkCard as a PR checklist for `src/events/**`:**

| Change                                                     | Class        | Requires                                     |
| ---------------------------------------------------------- | ------------ | -------------------------------------------- |
| Add an endpoint                                            | additive     | nothing                                      |
| Add an optional request field                              | additive     | nothing                                      |
| Add a response field                                       | additive     | generated client regenerated (Phase 1 gate)  |
| Remove/rename a parameter or response field                | **breaking** | new version or a declared deprecation window |
| Make an optional parameter required                        | **breaking** | same                                         |
| Change validation so previously-accepted input is rejected | **breaking** | same                                         |

The last row is the one that has actually bitten this codebase: `bec79d8b` (code normalisation) and
`c46445ee`/`f60b616e` (multi-select coercion) were both validation-semantics changes on paths the App
calls. They were correct changes. Under this rule they would have been **flagged**, not forbidden.

---

## Rule 2 — The generated client is the contract, and CI proves it

**Prevents:** D-4 (zero event OpenAPI annotations), and Rule 1's silent erosion.
**Mechanism:** Phase 1 P1-2/P1-5.

```
BE:  annotate → emit openapi.json → commit generated types.d.ts
CI:  regenerate → fail if the committed copy differs
App: compile against types.d.ts → drift becomes a type error in the App's own repo
```

Research takeaway 3 is the honest caveat and must be repeated here so nobody over-trusts this:

> _"...for a separate repo that does not build against the producer's spec, none of schema-diff, CDC,
> or generated-client catches the lag."_ `[MED]`

**Therefore Rule 2 is a floor, not a ceiling.** It catches _shape_ drift. It does not catch _lag_.
Rule 4 exists for lag.

---

## Rule 3 — Shared values live in one pure-data package

**Prevents:** D-10 (duplicated `theme.ts`, already diverged past diffability).
**Mechanism:** Phase 2 P2-5 guard.

The constraint is load-bearing, not stylistic. Expo documents the failure mode a React-bearing shared
package introduces:

> _"Runtime issues happen when a package has been written to act as a singleton. … A common example is
> the `react` package."_ — research §C1.3, `[P]`
> https://github.com/expo/fyi/blob/main/resolving-dependency-issues.md

**Rule:** the shared package may contain only plain data and types. Any pull request that adds a
`react`, `react-native`, or native-module import to it is rejected by the CI guard, not by reviewer
discipline.

**Explicitly not yet:** a shared RN **component** library. Two apps, no monorepo tooling, and a
component library requires wiring two build systems (research §C2.1).

> **But be precise about what exists (review finding V-01, `01-drift-audit.md` §8).** The App does not
> merely lack a component library — it has **two copies** of one. The two Expo apps share **29
> identically-named files**, including all ten `components/ui/*` components, none byte-identical and
> at least five ≥ 0.92 similar. So the rule is "do not _package_ these yet", not "there is nothing to
> package". The duplicated UI kit is the real candidate, and it is a larger piece of work than the
> token package this rule covers. Scope it after Phase 2, as an open decision in
> `05-remediation-plan.md` §7.

---

## Rule 4 — Every client is version-identifiable

**Prevents:** the permanent-lag condition (D-2, D-6).
**Mechanism:** Phase 3 P3-1/P3-6.

The three-layer shape recurs independently across sources (research §A1.3):

| Layer     | What it answers                                           | Where it lives                                     |
| --------- | --------------------------------------------------------- | -------------------------------------------------- |
| Manifest  | which client versions ship against which contract version | release notes / release process                    |
| Contract  | what the shapes are                                       | generated `types.d.ts` (Rule 2)                    |
| Handshake | is _this_ client still supported, right now               | `min_supported_client` + capability flags at login |

**This is the rule with the least public guidance.** The research searched for a published telemetry
pattern for "how many live clients are on contract version X" and found none — it is recorded as an
open question (research §B3.4 ❓, takeaway 3). So LinkCard must **invent** the cheap version:
log the client's contract version on the first authenticated request, and alert when a live client
drops below `min_supported_client`.

A mediocre metric that exists beats a perfect one that does not.

---

## Rule 5 — Native scope is a written, closed list

**Prevents:** D-9 (the escape hatch exists by accident), and Option A's failure mode (build everything).
**Mechanism:** Phase 0 P0-2.

The criterion (§D of `03-gap-matrix.md`) is **hardware proximity + input density**, not "does the web
have it". The ➖ list is **closed and enumerated**: adding to it is a decision, and a reviewable one.

Guard against misreading: Apple Guideline 4.2 forbids the app _being_ a repackaged website —

> _"Your app should include features, content, and UI that elevate it beyond a repackaged website."_
> — research §A1.5, `[HIGH]` (primary) https://developer.apple.com/app-store/review/guidelines/

— it does not forbid a screen deep-linking to the system browser. `token.tsx`'s `Linking.openURL` is
compliant; a WebView shell would not be. The policy document must say this explicitly, or a future
contributor will "simplify" the escape hatch into a WebView and lose the app.

---

## Rule 6 — Release cadence is decoupled from the store

**Prevents:** the "web shipped Tuesday, app stuck in review" asymmetry behind D-2.
**Mechanism:** Phase 3 P3-5.

> _"The 'runtimeVersion' property allows us to guarantee that an update is compatible with a specific
> build's native code."_ — research §A3, quoting Expo docs `[HIGH]`

**Policy:**

- Admin-layer screens (a new screen over an existing endpoint, copy changes, new flows) ship via
  **EAS Update**.
- Only new native capability requires a store submission. Bump `runtimeVersion` when adding or
  removing a **native library**, when editing the **native project** (`ios/**`), or when modifying
  `app.json`. The first version of this rule omitted `ios/**` — and this repo **does** commit an
  `ios/` Xcode project (18 tracked files), so the omission mattered.
- Budget for the first submission of a release being **rejected** — the research's data point is
  roughly a 2-day cost per rejection (research §A3.2, `[MED-HIGH]`).

> **Do not assume OTA works today (review finding V-03).** There is **no `expo-updates` dependency**
> (`grep -c expo-updates package.json` → 0), no `updates` block in `app.json`, and no
> `runtimeVersion`/`channel` in `eas.json`. Enabling EAS Update adds a **native module**, so it needs
> a rebuild and a store submission. Treat it as a prerequisite with its own cost
> (`05-remediation-plan.md` P3-5, which prices it at 3.5 days rather than 1.5).

---

## Rule 7 — One reference implementation, named

**Prevents:** ambiguity about which surface defines correctness — the root of D-3 and §B of the gap
matrix.
**Mechanism:** a stated designation.

**Designate `LinkCard_Frontend`'s event admin console as the reference implementation.** The contract
is derived from _it_; the App is a **declared subset consumer**. This has three consequences that must
be written down:

1. When web and App disagree, the web is presumed correct unless a decision record says otherwise.
2. Adding a web admin capability does **not** create an App obligation. It creates an obligation to
   _triage_ — adopt, defer with a reason, or declare ➖.
3. The App's C1–C6 capabilities (`03-gap-matrix.md` §C) are the documented exception: NFC write, the
   resident-card URL resolver, and the desk handoff have **no** web equivalent, so they are App-owned
   and the web is not the reference for them.

---

## Rule 8 — Drift is measured, quarterly, by the same command

**Prevents:** the situation returning unnoticed for weeks.
**Mechanism:** re-run the measurement in `01-drift-audit.md` §2 and §3.

| Metric                  | Command                                                                                                                                                                                          | Threshold                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Commit-rate ratio       | `rev-list --count --since=<90d>` on all three repos, **code paths only**                                                                                                                         | App code commits < 1/9 of the smaller upstream ⇒ investigate |
| Endpoint inventory      | `grep -rhoE 'router\.(get\|post\|put\|patch\|delete)\(' src/events/routes/*.routes.ts \| wc -l` (→ 121) and `grep -rhoE "[\"'\`]/api/[^\"'\`]_" <App>/src \| sed 's/^[^/]_//' \| sort -u` (→ 14) | recorded for comparison, not a gate                          |
| Contract coverage       | annotated endpoints ÷ **consumed** endpoints                                                                                                                                                     | coverage < 50 % of consumed endpoints ⇒ investigate          |
| Consumed-endpoint drift | diff the App's endpoint list against the generated contract                                                                                                                                      | any removal or signature change ⇒ **act**                    |

> **The first version of this table was not runnable** (review finding V-17): it contained a literal
> `…` inside a regex, and it compared an annotation count under `src/events` against route counts
> under `src/events/routes/*` — two different file sets — so the ratio was not computable. Both
> inventory commands above reproduce (121 and 14). The metric that matters is **annotated endpoints vs
> consumed endpoints**, because the floor only has to cover what a client actually calls.

This is the tripwire that turns `01-drift-audit.md` from a one-off report into an instrument.

---

## 9. What _not_ to adopt yet

**Do not build a `Deprecation`/`Sunset` regime now.** The standards are real and clearly specified —
RFC 9745 defines `Deprecation` as a stage-one timestamp; RFC 8594 defines `Sunset` as stage two
(decommissioning) and states explicitly that `Sunset` is _not_ appropriate for the first stage — but
the research's recommendation is to sequence them:

> _"Publish the policy now; wire the headers when there is a second client version to protect."_
> — research takeaway 14, `[HIGH]`

**Also do not** adopt header-based API versioning, date-stamped versions, or a public API version
negotiation scheme. The primary sources converge on coexistence rather than a winning scheme
(research §B3.3), and LinkCard has exactly one API version and no external partners.

---

## 10. Ownership and bus factor

Every rule above assumes someone runs the guard. Two facts from the audit bear on this:

- The Admin App has had **15 code commits in 3 weeks** and **0 since 2026-10-12**. Rules 1–8 add no
  daily work, but Rule 8 (quarterly measurement) is a recurring task with no owner today.
- The App's documentation went stale within 32 days (D-11), which is the symptom of ownership that is
  reactive rather than assigned.

**Minimum viable ownership:** one named owner for "App ↔ contract" who runs Rule 8 quarterly and
reviews any `src/events/**` change against Rule 1's checklist. That is a role, not a full-time job.
