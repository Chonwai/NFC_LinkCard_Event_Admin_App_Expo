# 01 — Drift Audit (measured 2026-10-15)

All numbers below were produced by running the listed command against the working trees on
2026-10-15. No number in this document is estimated.

> **Repair note (post independent review).** An independent review unit re-ran every command in this
> document (`07-verification.md`, findings V-07…V-12, V-19, V-20). Three measurements did not
> reproduce and have been corrected below: the App's commit counts, the schema-migration count, the
> App's consumed-endpoint count, and the App screen LOC total. This document now states a **frozen
> baseline SHA per section**, because the pack's own documentation commits move the App's HEAD (the
> review correctly flagged that §1 and §2 were captured at different commits without saying so).

---

## 1. Repository baseline

**Frozen measurement baseline** — every count in §2–§7 was taken with the App at `d2379da`, the
Frontend at `7fe5587`, and the backend at `500ee997`:

| Repo                            | Branch        | Frozen SHA | Date       | Worktree at measurement | Worktree now |
| ------------------------------- | ------------- | ---------- | ---------- | ----------------------- | ------------ |
| `LinkCard_Frontend`             | `development` | `7fe5587`  | 2026-10-15 | clean                   | clean        |
| `LinkCard_ExpressJS_Backend`    | `development` | `500ee997` | 2026-10-15 | **5 in-flight files**   | clean        |
| `LinkCard_Event_Admin_App_Expo` | `main`        | `d2379da`  | 2026-10-11 | clean                   | docs only    |
| `LinkCard_Promoter_App_Expo`    | (n/a)         | `d3970fc`  | 2026-09-30 | clean                   | clean        |
| `LinkCard_MiniProgram`          | (n/a)         | `100c45e`  | 2026-10-05 | clean                   | clean        |

Reproduce:

```sh
for r in LinkCard_Event_Admin_App_Expo LinkCard_Frontend LinkCard_ExpressJS_Backend \
         LinkCard_Promoter_App_Expo LinkCard_MiniProgram; do
  printf '%s  ' "$r"; git -C $r log -1 --format='%h|%ad' --date=short
  git -C $r status --porcelain | wc -l
done
```

**Finding D-1 (framing correction).** The Admin App's HEAD is 4 days old, not "10+ days".
But HEAD date is the wrong metric: the App's _last `src/` commit_ is `ea56f71` (2026-10-11),
and the App has had **zero** product-code commits since 2026-10-12 while both upstream repos
committed on 2026-10-15. The drift is real, but it must be measured against
**what the App consumes**, not against calendar days.

**Finding D-12 (the baseline itself moves).** By the end of this audit the App's HEAD was
`880ac01` and the backend's was `f723173b` — the App moved because **this pack's own commits** moved
it, and the backend moved because **another concurrent session** committed to it. Two consequences:
(a) any re-measurement must name the SHA, never "HEAD"; (b) the audit's own `01`–`07` commits are
part of the churn it describes.

**Finding D-13 (the backend was not clean when audited).** The backend had **5 in-flight files** at
measurement time — `src/events/services/EventSessionService.ts`, `src/utils/transaction-retry.ts`,
two unit-test files, and an untracked review doc
(`git -C LinkCard_ExpressJS_Backend status --porcelain`). `EventSessionService.ts` is in the exact
hot area Phase 1 of the plan touches. It was clean again at repair time, which is the normal
behaviour of this workspace and is the reason §6 of `05-remediation-plan.md` exists.

---

## 2. Change volume — the asymmetry

Measured at the frozen baseline above (App `d2379da`, FE `7fe5587`, BE `500ee997`).

| Metric                                                      | Frontend                                         | Backend                | Admin App      |
| ----------------------------------------------------------- | ------------------------------------------------ | ---------------------- | -------------- |
| All commits since 2026-09-25                                | **239**                                          | 1108                   | **25**         |
| **Code** commits since 2026-09-25                           | **143** (`app components lib hooks store types`) | **210** (`src prisma`) | **15** (`src`) |
| All commits since 2026-10-12                                | 52                                               | —                      | —              |
| **Code** commits since 2026-10-12                           | 31                                               | 34 (`src prisma`)      | **0**          |
| Unique files changed since 2026-09-25 in the event vertical | —                                                | 64 (`src/events/**`)   | —              |

Reproduce (**the revision must come before `--`; after the pathspec git treats it as another
pathspec and silently returns a wrong count** — this bit the first version of this document):

```sh
A=d2379da; F=7fe5587; B=500ee997
git -C LinkCard_Frontend rev-list --count --since=2026-09-25 $F                                   # 239
git -C LinkCard_Frontend log --since=2026-09-25 --oneline --no-merges $F \
  -- app components lib hooks store types | wc -l                                                # 143
git -C LinkCard_Frontend rev-list --count --since=2026-10-12 $F                                   # 52
git -C LinkCard_Frontend log --since=2026-10-12 --oneline --no-merges $F \
  -- app components lib hooks store types | wc -l                                                # 31
git -C LinkCard_ExpressJS_Backend rev-list --count --since=2026-09-25 $B                          # 1108
git -C LinkCard_ExpressJS_Backend log --since=2026-09-25 --oneline --no-merges $B \
  -- src prisma | wc -l                                                                          # 210
git -C LinkCard_ExpressJS_Backend log --since=2026-10-12 --oneline --no-merges $B \
  -- src prisma | wc -l                                                                          # 34
git -C LinkCard_Event_Admin_App_Expo rev-list --count --since=2026-09-25 $A                       # 25
git -C LinkCard_Event_Admin_App_Expo log --since=2026-09-25 --oneline --no-merges $A \
  -- src | wc -l                                                                                 # 15
git -C LinkCard_Event_Admin_App_Expo log --since=2026-10-12 --oneline --no-merges $A \
  -- src | wc -l                                                                                 # 0
git -C LinkCard_ExpressJS_Backend log --since=2026-09-25 --name-only \
  --pretty=format: --no-merges $B -- src/events | sed '/^$/d' | sort -u | wc -l                  # 64
```

**Superseded values, recorded for auditability.** The first version of this section reported App
`27` / `53`. Both were _measurement artefacts_, not different commits of truth:

- App `27` was taken **after** two of this pack's own commits (`f3fd191`, `0fe7e96`). At the declared
  baseline `d2379da` the value is **25**; at `0fe7e96` it is 27. The review reconstructed this
  (V-07) and it is exactly the hazard Finding D-12 describes.
- FE `53` reproduces under no recipe; the value at the frozen SHA is **52** all / **31** code.

> The backend's 1108 _all_ commits against 210 _code_ commits is itself a finding — the workspace
> carries very heavy documentation/session churn — but the comparison that matters is code against code.

**Finding D-2.** On product code the Admin App moves at **15 commits against the Frontend's 143 and
the backend's 210** since 2026-09-25 — that is **~1/9.5 of the Frontend and ~1/14 of the backend**
(one ratio, used consistently across this pack). Since 2026-10-12 it has moved **not at all**. That
is the underlying mechanism of the drift — not any single missed feature.

---

## 3. API surface asymmetry

| Metric                                     | Count                         |
| ------------------------------------------ | ----------------------------- |
| Endpoints under `/api/v1/events` (backend) | **121** across 11 route files |
| Endpoints the Admin App calls              | **14**                        |
| App coverage of the event API surface      | **~11.6 %**                   |

Per-file endpoint counts (backend):

```sh
for f in LinkCard_ExpressJS_Backend/src/events/routes/*.routes.ts; do
  printf '%s  %s\n' "$(grep -cE 'router\.(get|post|put|patch|delete)\(' "$f")" "$(basename "$f")"
done
```

| File                            | Endpoints |
| ------------------------------- | --------- |
| `events.routes.ts`              | 23        |
| `exhibitors.routes.ts`          | 18        |
| `event-ops.routes.ts`           | 14        |
| `registrations.routes.ts`       | 14        |
| `sessions-polls.routes.ts`      | 14        |
| `premium.routes.ts`             | 11        |
| `engagement.routes.ts`          | 10        |
| `connection-requests.routes.ts` | 7         |
| `exhibitor-import.routes.ts`    | 4         |
| `registration-import.routes.ts` | 4         |
| `exhibitor-invites.routes.ts`   | 2         |
| **Total**                       | **121**   |

The App's 14 endpoints — grep must include **double** quotes; two of them are double-quoted, and the
`/api/v1/...` entry is a comment fragment, not a call:

```sh
grep -rhoE "[\"'\`]/api/[^\"'\`]*" LinkCard_Event_Admin_App_Expo/src \
  | sed 's/^[^/]*//' | sort -u
```

```
POST /api/auth/login
GET  /api/users/me
GET  /api/v1/events/my-managed
GET  /api/v1/events/by-id/:eventId
GET  /api/v1/events/:eventId/ticket-types
GET  /api/v1/events/:eventId/registrations
GET  /api/v1/events/:eventId/registrations/by-code/:code
POST /api/v1/events/:eventId/registrations/checkin
POST /api/v1/events/:eventId/registrations/checkin/override
GET  /api/v1/events/:eventId/nfc/lookup
POST /api/v1/events/:eventId/nfc/bind
POST /api/v1/events/:eventId/nfc/exchange
GET  /api/v1/events/:eventId/nfc/badges
GET  /api/v1/events/:eventId/wallet/:registrationId/transactions
```

**Finding D-3.** The App's surface is not "the backend minus a few things" — it is a
**narrow door-side slice**: authenticate, list my events, look up a registrant, check them in,
write/read/exchange an NFC card, count badges. That is a coherent product scope. The problem
is not its narrowness; it is that the slice has **no machine-readable definition of where its
edges are**, so it cannot tell when the edge moved.

---

## 4. Machine-readable contract: absent exactly where it matters

```sh
grep -rc "@openapi\|@swagger" LinkCard_ExpressJS_Backend/src --include='*.ts' \
  | awk -F: '{s+=$2} END {print s}'                       # 48
grep -rc "@openapi\|@swagger" LinkCard_ExpressJS_Backend/src/events --include='*.ts' \
  | awk -F: '{s+=$2} END {print s+0}'                     # 0
wc -l LinkCard_ExpressJS_Backend/src/docs/api-schemas.ts  # 1198
```

**Finding D-4 (root cause).** `swagger-jsdoc` + `swagger-ui-express` are wired
(`src/swagger.ts`, 1,198 lines of reusable schema definitions in `src/docs/api-schemas.ts`),
but **`src/events/` contains zero `@openapi` annotations**. The event vertical — the entire
surface the Admin App depends on — has **no machine-readable contract**. Every client
(Frontend, Admin App, Promoter App, MiniProgram) re-derives the contract by hand from reading
TypeScript and from production failures.

This is the single highest-leverage fact in this audit. It explains why Finding D-2 produces
Finding D-5 rather than being absorbed.

---

## 5. Silent behaviour changes on endpoints the App already calls

The App is not broken — no evidence of a live outage. But the backend changed the semantics
of endpoints the App consumes, and the App did not move. Selected commits
(`git log --since=2026-09-12 --oneline -- <file>`):

| Backend commit         | Change                                                                                 | App status                           |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| `f0567480`             | `checkIn` response gains `profileUrl` (additive)                                       | **Consumed** (`c8e32e6`, 2026-10-05) |
| `4c023824`             | `checkIn` returns `isActivated` 3-state; desk payload contract locked                  | **Consumed** (`dad010b`, 2026-10-05) |
| `b64bca95`             | `checkIn` response gains `tokenBalance`                                                | Not used                             |
| `d30eedb8`             | `nfc/lookup` gains rate limiting; `displayName` no longer falls back to email          | **Unverified against App**           |
| `e225418b`             | `registrations/by-code` now sends `Cache-Control: no-store`                            | Harmless                             |
| `bec79d8b`             | Manually entered registration codes are normalised server-side                         | Affects App's manual-entry path      |
| `7edb0aca`             | New per-code secondary rate-limit knob (`BYCODE_PER_CODE_LIMIT`, default disabled)     | App is a heavy `by-code` caller      |
| `c46445ee`, `f60b616e` | Multi-select values coerced to `string[]` before validation (BUG-REG-001)              | App sends walk-in payloads           |
| `99770535`             | New `updateRegistrationStatus` service (revoke check-in / manual check-in)             | Not in App                           |
| `67cd592f`             | New `POST /registrations/:id/status` (supervisor-level correction, NEW-34)             | Not in App                           |
| `a4f60b5b`             | Per-registration email status exposed on admin registration list, with batched queries | **FE has it; App does not**          |
| `5e19476a`             | New admin endpoint to re-queue the confirmation email                                  | Not in App                           |
| `00255eb4`             | Resend-activation now recreates a missing account instead of 404ing                    | Not in App                           |
| `87cfbb3b`             | Archiving a registration releases its workshop seat                                    | App cannot archive                   |
| `a2f7ff15`             | VIP / guest-list import (template / preview / confirm / notify)                        | Not in App                           |

**Finding D-5.** Of 15 contract-relevant backend commits since 2026-09-12, the App absorbed
**2**. Thirteen are either silently unabsorbed or unverified. Several of them change the
semantics of the App's own hot path (manual code entry, `by-code` lookups, walk-in payloads).

**Finding D-6 (risk, not defect).** There is no evidence the App is currently broken in
production. The risk is that the App's _users_ — door staff, mid-event, with no fallback —
will discover a semantic change at the worst possible moment. Door-side failure is
non-recoverable during an event.

---

## 6. Schema drift

81 migrations total; **20 created since 2026-09-01**, **8 of them since 2026-10-01**:

```sh
cd LinkCard_ExpressJS_Backend
ls -1 prisma/migrations | grep -c '^2'                                       # 81
ls -1 prisma/migrations | grep '^2' | awk -F_ '$1 >= "20260901"' | wc -l    # 20
ls -1 prisma/migrations | grep '^2' | awk -F_ '$1 >= "20261001"' | wc -l    # 8
```

> The `grep '^2'` guard is required. Without it, `migration_lock.toml` is counted too (its `$1` is
> `migration`, which sorts above `2026…`), which inflates the 2026-10-01 count to 9. The first
> version of this document omitted the guard and reported 9. (Review finding V-09.)

```
20260903 promoter user soft-delete                              20260923 canonicalize event tag UIDs
20260903 align pics consent status                               20260925 event registration consent
20260912 event NFC badge batch                    ← App writes badges
20260915 promoter role + env mapping                             20260925 activation email fields
20260915 createdByPromoterId FK                                  20261002 sales CRM contacts
20260915 FK indexes createdByPromoterId                          20261002 contact identity partial unique
20260918 promoter self-activate audit                            20261004 exhibitor member invite email obs.
20260922 relax nfc_write_records.card_id                         20261006 active email registration unique
20260922 unique nfc_write_records.tag_uid         ← App writes cards
                                                                 20261008 connection request + notif. outbox
                                                                 20261012 email delivery events
                                                                 20261013 ticket type capabilities        ← FE + BE only
                                                                 20261013 ticket capabilities enabled     ← FE + BE only
```

Reproduce: `ls -1 LinkCard_ExpressJS_Backend/prisma/migrations | awk -F_ '$1 >= "20260901"'`

**Finding D-7.** The two `ticket_capabilities*` migrations (2026-10-13) are the clearest
example: the Frontend shipped a per-event rollout switch and a ticket-capability editor
(`6e6bc7e`, `a6a4a5d`, `cbf177e`), and the Admin App has **no representation of capabilities
at all**. An organiser using only the App cannot see or toggle the gate that determines
whether attendees get business matching, wallet, or sessions.

---

## 7. Screen asymmetry

Backend-managed **event** console pages in the Frontend (`app/(event)/manage/[eventId]/**`,
plus `manage/events`) and their sizes:

| Frontend page                                 | LOC       | Admin App equivalent                 |
| --------------------------------------------- | --------- | ------------------------------------ |
| `ticket-types/page.tsx`                       | 1431      | ✗ (App reads ticket-types read-only) |
| `registrations/page.tsx`                      | 1470      | partial (`registrations.tsx`, 644)   |
| `badges/page.tsx`                             | 890       | partial (`badges.tsx`, 574)          |
| `settings/page.tsx`                           | 451       | ✗                                    |
| `sessions/page.tsx`                           | 422       | ✗                                    |
| `sessions/[sessionId]/registrations/page.tsx` | —         | ✗                                    |
| `profile/page.tsx`                            | 380       | ✗                                    |
| `content/page.tsx`                            | 376       | ✗                                    |
| `polls/page.tsx`                              | 323       | ✗                                    |
| `org-roles/page.tsx`                          | 295       | ✗                                    |
| `bank-transfers/page.tsx`                     | 251       | ✗                                    |
| `exhibitors/page.tsx`                         | 243       | ✗                                    |
| `exhibitors/import/page.tsx`                  | —         | ✗                                    |
| `manage/events/page.tsx`                      | —         | ✓ (`home.tsx`, 354)                  |
| `app/check-in/[eventId]/page.tsx` + `/nfc`    | 328 + 159 | ✓ (`check-in.tsx`, 957 — **richer**) |

Admin App screens (12 files: 10 event-scoped + 2 app-level). **Total 5,315 LOC** — the first
version of this document said 5,479, which is inconsistent with its own per-file figures (review
finding V-11). This number is the calibration anchor for every estimate in `05-remediation-plan.md`,
so it matters:

```
 354 home.tsx        250 settings.tsx     517 overview.tsx      957 check-in.tsx
 644 registrations.tsx                230 registrant/[registrationId].tsx
 574 badges.tsx      682 nfc-bind.tsx     283 nfc-read.tsx      452 nfc-exchange.tsx
 304 walk-in.tsx      68 token.tsx                              ─────
                                                              5315 total
```

**Finding D-8.** The App is not uniformly behind. In **check-in** it is ahead: 957 LOC of
camera + NFC + manual-entry + 15s success-state + desk-handoff logic, versus 487 LOC of web
check-in. The App's genuine value is _door-side, sensor-driven_ work — camera, NFC, and the
check-in → write-card → prefill handoff. It is behind everywhere else — and the "everywhere else"
is largely **desk work that the web console already does better**.

> **Correction (review finding V-04).** The first version of this finding said the App's value was
> "offline-tolerant" work. That was wrong and contradicted this pack's own gap matrix: offline
> check-in is recorded as **✗ on both surfaces** (`03-gap-matrix.md` A20) and deferred as net-new
> in `05-remediation-plan.md` Phase 4. The App has **no** offline queue-and-sync. See D-14.

**Finding D-9 (the design tension).** `token.tsx` (68 LOC) is not a feature — it is a
documented placeholder that opens `WEB_BASE_URL/manage/{eventId}/wallet`. That is the
"thin shell" pattern emerging **by accident**, in one screen, without a stated policy. Half
the drift in this audit is caused by the absence of an explicit rule about which surfaces
belong natively and which belong on the web.

---

## 8. Shared-code drift

**This section was materially wrong in the first version of this document and is rewritten in full.**
It searched for one filename (`find . -name 'theme.ts'`) and concluded there was essentially no shared
code. An independent review (finding V-01) re-ran the scan on **file names across the whole `src/`
tree** and found **29 identically-named files** between the two Expo apps:

```sh
comm -12 <(cd LinkCard_Promoter_App_Expo/src   && find . -type f | sort) \
         <(cd LinkCard_Event_Admin_App_Expo/src && find . -type f | sort) | wc -l   # 29
```

The duplicated set includes **all ten `components/ui/*` components** (`Button`, `Card`, `EmptyState`,
`FieldInput`, `Icon`, `InlineBanner`, `Logo`, `ScreenHeader`, `Skeleton`, `useFocusRing`), seven
`utils/*` modules, three `services/*`, `stores/auth.store.ts`, `types/api.types.ts`,
`constants/config.ts`, `constants/theme.ts`, and `constants/copy.zh-TW.ts`. **Zero of the 29 are
byte-identical.** At least five are ≥ 0.92 similar after normalisation — `EmptyState.tsx` 0.971,
`Card.tsx` 0.950, `Icon.tsx` 0.925, `Logo.tsx` 0.830 — which is the worst of both worlds: similar
enough to look like a shared library, different enough that neither is authoritative.

Two divergences are **semantic**, not cosmetic:

| File                     | Divergence                                                                                                                                                                                                                                                                                                                               | Consequence                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `constants/theme.ts`     | `tabBarHeight` is **56** in Promoter and **52** in the Admin App; Promoter additionally defines `none: primitive.numeric.radius.none`, `buttonHeightSm: 48`, `iconBox: 32`, `skeletonRows: 3`; Promoter **exports** `fontFamily`, `elevation` and a `theme` aggregate, the Admin App keeps them module-private and has no default export | the same named token resolves to different values in the two apps   |
| `constants/config.ts`    | Promoter **fails closed** when its API URL is missing; the Admin App **silently falls back to production**                                                                                                                                                                                                                               | a misconfigured build talks to production instead of failing loudly |
| `components/ui/Card.tsx` | Promoter's `useFocusRing()` returns a `showVisibleRing` field, the Admin App's returns `focused`                                                                                                                                                                                                                                         | behavioural, not visual                                             |

The first version of this document said the `theme.ts` diff "is dominated by _formatting_". Formatting
_inflates_ the raw diff (1,130 lines), but after normalising whitespace, indentation and quote style,
**seven semantic differences remain** — including a changed token _value_. The raw-diff framing made
the drift look cosmetic. It is not. (Review finding V-02.)

No monorepo tooling exists to catch any of this:

```sh
find . -maxdepth 2 \( -name 'pnpm-workspace.yaml' -o -name 'turbo.json' \
  -o -name 'nx.json' -o -name 'lerna.json' \) -not -path '*/node_modules/*'
# (empty)
```

**Finding D-10.** There is **no shared package, no workspace, and no generated client** across five
repos. Every contract in this system is a human convention.

**Finding D-14.** There is also **no owner** for the duplication: 29 near-duplicate files exist with
no marker saying which copy is canonical. This is a larger surface than the "duplicated token file"
the first version described, and it changes Option C's stated prerequisite in
`04-architecture-options.md` — see that document's repair note.

---

## 9. Documentation drift

`LinkCard_Event_Admin_App_Expo/docs/.project-context.md` is dated **2026-09-13** and declares:

- "**Testing**: 無 test framework" — false; `tests/` now holds **25** `.test.mjs` files plus
  **4** under `tests/journeys/`, and `package.json` defines a `test` script
  (`ls -1 tests/*.test.mjs | wc -l` → 25; `ls -1 tests/journeys/*.test.mjs | wc -l` → 4).
  **Sharper still**: the repo already has a CI workflow that runs them —
  `.github/workflows/ci.yml` executes `regenerate:typed-routes`, `typecheck`, `lint`,
  `format:check` and `npm test`. The document is not just stale, it describes a repo
  that never existed in this form. (Review finding V-20.)
- "Route Inventory (Pages) … 底下 **4 個子頁面**" — stale; the event stack has 10 screens
  (`src/app/(auth)/[eventId]/_layout.tsx`).
- "API Endpoint Inventory" lists **8** endpoints — the App now calls **14**.

**Finding D-11.** The App's own orientation document is 32 days old and wrong on three
counts. A new contributor trusting it would build against a system that no longer exists.

---

## 10. Summary of findings

| ID   | Finding                                                                             | Severity     |
| ---- | ----------------------------------------------------------------------------------- | ------------ |
| D-1  | Drift is in _consumed surface_, not calendar days                                   | context      |
| D-2  | App commits at ~1/9.5 of the Frontend and ~1/14 of the backend on product code      | **High**     |
| D-3  | App's 14 endpoints are a coherent narrow slice, not a half-built console            | context      |
| D-4  | **Zero OpenAPI annotations in `src/events/` — no machine-readable contract**        | **Critical** |
| D-5  | 13 of 15 contract-relevant backend commits unabsorbed/unverified since 2026-09-12   | **High**     |
| D-6  | Door-side failure is non-recoverable; the risk is asymmetric                        | **High**     |
| D-7  | Ticket capability model exists only in FE+BE; App has no representation             | **Medium**   |
| D-8  | App is _ahead_ on check-in (957 vs 487 LOC) and behind everywhere else              | context      |
| D-9  | `token.tsx` shows a "thin shell" pattern exists by accident, with no policy         | **Medium**   |
| D-10 | No shared package / workspace / generated client across 5 repos                     | **High**     |
| D-11 | App's own `.project-context.md` is 32 days stale and wrong on 3 counts              | **Medium**   |
| D-12 | The baseline moves during the audit — name SHAs, never "HEAD"                       | **Medium**   |
| D-13 | The backend worktree was **not** clean when the audit ran (5 in-flight files)       | **Medium**   |
| D-14 | 29 near-duplicate files between the two Expo apps, with no marker of canonical copy | **High**     |
| D-15 | `ios/` is committed (18 files) and `expo-updates` is absent — OTA is unavailable    | **High**     |

### D-15 in detail (added by the repair round)

The plan's Phase 3 treats EAS Update as the answer to store-release latency. That is not true today:

```sh
git -C LinkCard_Event_Admin_App_Expo ls-files ios | wc -l    # 18 — a committed native project
grep -c expo-updates LinkCard_Event_Admin_App_Expo/package.json   # 0
```

`app.json` has no `updates` block and `eas.json` has no `runtimeVersion` or `channel`. Enabling OTA
requires adding a **native module** ⇒ a rebuild and a store submission. This is a prerequisite with
its own cost, not an existing capability. (Review finding V-03.)
