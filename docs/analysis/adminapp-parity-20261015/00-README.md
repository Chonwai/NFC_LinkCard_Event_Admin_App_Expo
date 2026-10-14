# LC-ADMP — Event Admin App ↔ Frontend/Backend Parity Audit & Sustainable Plan

**Date:** 2026-10-15
**Loop:** LC-ADMP (Neo, Discover→Plan→Verify)
**Scope:** `LinkCard_Event_Admin_App_Expo` (Expo/RN companion app) vs the event vertical of
`LinkCard_Frontend` (Next.js admin console) and `LinkCard_ExpressJS_Backend` (Express + Prisma).

## Index

| #   | File                         | Contents                                                      |
| --- | ---------------------------- | ------------------------------------------------------------- |
| 00  | `00-README.md`               | This index, method, and evidence rules                        |
| 01  | `01-drift-audit.md`          | Measured drift: commits, API surface, screens, schema, tokens |
| 02  | `02-industry-research.md`    | Deep research (≥60 sources)                                   |
| 03  | `03-gap-matrix.md`           | Per-capability gap matrix App vs Web vs BE                    |
| 04  | `04-architecture-options.md` | Options A/B/C with tradeoffs + recommendation                 |
| 05  | `05-remediation-plan.md`     | Phased plan, effort, DoD                                      |
| 06  | `06-tech-debt-prevention.md` | Contract/codegen/CI guards so this never recurs               |
| 07  | `07-verification.md`         | Independent review + evidence log                             |

## Method

- **Discover:** git history, route/service inventories, LOC, schema, token hashes measured
  directly from the working trees on 2026-10-15. No estimates where a measurement exists.
- **Research:** one dedicated deep-research unit with a written spec; sources cited inline.
- **Plan:** options are evaluated against explicit criteria (adoption cost, blast radius,
  testability, release cadence, bus factor), not preference.
- **Verify:** an independent reviewer audits this pack against the evidence bar below.

## Evidence bar

1. Every factual claim about the codebase carries a **file path** (+ line where useful) or a
   **command that reproduces it**.
2. Every industry claim carries a **URL**.
3. Anything unverified is marked **UNVERIFIED** and is not used as a premise for a recommendation.
4. Effort estimates state their basis (screens × LOC precedent × risk).
