# 01 — Drift Audit (measured 2026-10-15)

All numbers below were produced by running the listed command against the working trees on
2026-10-15. No number in this document is estimated.

---

## 1. Repository baseline

| Repo                            | Branch        | HEAD       | HEAD date  | Worktree |
| ------------------------------- | ------------- | ---------- | ---------- | -------- |
| `LinkCard_Frontend`             | `development` | `7fe5587`  | 2026-10-15 | clean    |
| `LinkCard_ExpressJS_Backend`    | `development` | `500ee997` | 2026-10-15 | clean    |
| `LinkCard_Event_Admin_App_Expo` | `main`        | `d2379da`  | 2026-10-11 | clean    |
| `LinkCard_Promoter_App_Expo`    | (n/a)         | `d3970fc`  | 2026-09-30 | clean    |
| `LinkCard_MiniProgram`          | (n/a)         | `100c45e`  | 2026-10-05 | clean    |

Reproduce:

```sh
for r in LinkCard_Event_Admin_App_Expo LinkCard_Frontend LinkCard_ExpressJS_Backend \
         LinkCard_Promoter_App_Expo LinkCard_MiniProgram; do
  git -C $r log -1 --format='%h|%ad|%s' --date=short
done
```

**Finding D-1 (framing correction).** The Admin App's HEAD is 4 days old, not "10+ days".
But HEAD date is the wrong metric: the App's _last `src/` commit_ is `ea56f71` (2026-10-11),
and the App has had **zero** product-code commits since 2026-10-12 while both upstream repos
committed on 2026-10-15. The drift is real, but it must be measured against
**what the App consumes**, not against calendar days.

---

## 2. Change volume — the asymmetry

| Metric                                                      | Frontend                                         | Backend                | Admin App      |
| ----------------------------------------------------------- | ------------------------------------------------ | ---------------------- | -------------- |
| All commits since 2026-09-25                                | **239**                                          | 1108                   | **27**         |
| **Code** commits since 2026-09-25                           | **143** (`app components lib hooks store types`) | **210** (`src prisma`) | **15** (`src`) |
| Code commits since 2026-10-12                               | 53                                               | 34 (`src prisma`)      | **0**          |
| Unique files changed since 2026-09-25 in the event vertical | —                                                | 64 (`src/events/**`)   | —              |

Reproduce:

```sh
git -C LinkCard_Frontend rev-list --count --since=2026-09-25 HEAD            # 239
git -C LinkCard_Frontend log --since=2026-09-25 --oneline --no-merges \
  -- app components lib hooks store types | wc -l                            # 143
git -C LinkCard_ExpressJS_Backend rev-list --count --since=2026-09-25 HEAD   # 1108
git -C LinkCard_ExpressJS_Backend log --since=2026-09-25 --oneline --no-merges \
  -- src prisma | wc -l                                                       # 210
git -C LinkCard_Event_Admin_App_Expo rev-list --count --since=2026-09-25 HEAD # 27
git -C LinkCard_Event_Admin_App_Expo log --since=2026-09-25 --oneline --no-merges \
  -- src | wc -l                                                              # 15
git -C LinkCard_ExpressJS_Backend log --since=2026-09-25 --name-only \
  --pretty=format: --no-merges -- src/events | sed '/^$/d' | sort -u | wc -l  # 64
```

> The backend's 1108 _all_ commits against 210 _code_ commits is itself a finding — see
> §9 — but the comparison that matters here is code against code.

**Finding D-2.** On product code the Admin App moves at **15 commits against the Frontend's
143 and the backend's 210** since 2026-09-25 — roughly **1/10th and 1/14th**. Since
2026-10-12 it has moved **not at all**. That is the underlying mechanism of the drift — not
any single missed feature.

---

## 3. API surface asymmetry

| Metric                                     | Count                         |
| ------------------------------------------ | ----------------------------- |
| Endpoints under `/api/v1/events` (backend) | **121** across 11 route files |
| Endpoints the Admin App calls              | **13**                        |
| App coverage of the event API surface      | **~10.7 %**                   |

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

The App's 13 endpoints (`grep -rhoE "'/api[^']*'|\`/api[^\`]*\`" src`):

```
POST /api/auth/login
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

81 migrations total; **20 created since 2026-09-01**, **9 of them since 2026-10-01**:

```sh
ls -1 LinkCard_ExpressJS_Backend/prisma/migrations | grep -c '^2'              # 81
ls -1 LinkCard_ExpressJS_Backend/prisma/migrations | awk -F_ '$1 >= "20260901"' | wc -l  # 20
ls -1 LinkCard_ExpressJS_Backend/prisma/migrations | awk -F_ '$1 >= "20261001"' | wc -l  # 9
```

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

Admin App screens (10 event-scoped + 2 app-level, 5,479 LOC total):

```
home.tsx 354 | settings.tsx 250 | overview.tsx 517 | check-in.tsx 957 | registrations.tsx 644
registrant/[registrationId].tsx 230 | badges.tsx 574 | nfc-bind.tsx 682
nfc-read.tsx 283 | nfc-exchange.tsx 452 | walk-in.tsx 304 | token.tsx 68
```

**Finding D-8.** The App is not uniformly behind. In **check-in** it is ahead: 957 LOC of
camera + NFC + manual-entry + 15s success-state + desk-handoff logic, versus 487 LOC of web
check-in. The App's genuine value is _door-side, sensor-driven, offline-tolerant work_.
It is behind everywhere else — and the "everywhere else" is largely **desk work that the web
console already does better**.

**Finding D-9 (the design tension).** `token.tsx` (68 LOC) is not a feature — it is a
documented placeholder that opens `WEB_BASE_URL/manage/{eventId}/wallet`. That is the
"thin shell" pattern emerging **by accident**, in one screen, without a stated policy. Half
the drift in this audit is caused by the absence of an explicit rule about which surfaces
belong natively and which belong on the web.

---

## 8. Shared-code drift

```sh
find . -name 'theme.ts' -not -path '*/node_modules/*'
# ./LinkCard_Promoter_App_Expo/src/constants/theme.ts
# ./LinkCard_Event_Admin_App_Expo/src/constants/theme.ts
```

The Admin App's design tokens were **copied** from the Promoter App
(`docs/.project-context.md`: "`src/constants/theme.ts` — **100% 複製自 Promoter App**").
They have since diverged:

```sh
diff LinkCard_Promoter_App_Expo/src/constants/theme.ts \
     LinkCard_Event_Admin_App_Expo/src/constants/theme.ts
```

The diff is dominated by _formatting_ (Promoter uses single quotes / 4-space indent; Admin App
uses double quotes / 2-space), which means the two files can no longer be compared
byte-wise — the cheapest possible drift detector is already blind. No monorepo tooling exists
to catch this:

```sh
find . -maxdepth 2 \( -name 'pnpm-workspace.yaml' -o -name 'turbo.json' \
  -o -name 'nx.json' -o -name 'lerna.json' \) -not -path '*/node_modules/*'
# (empty)
```

**Finding D-10.** There is **no shared package, no workspace, and no generated client** across
five repos. Every contract in this system is a human convention.

---

## 9. Documentation drift

`LinkCard_Event_Admin_App_Expo/docs/.project-context.md` is dated **2026-09-13** and declares:

- "**Testing**: 無 test framework" — false; `tests/` now holds **25** `.test.mjs` files plus
  **4** under `tests/journeys/`, and `package.json` defines a `test` script
  (`ls -1 tests/*.test.mjs | wc -l` → 25; `ls -1 tests/journeys/*.test.mjs | wc -l` → 4).
- "Route Inventory (Pages) … 底下 **4 個子頁面**" — stale; the event stack has 10 screens
  (`src/app/(auth)/[eventId]/_layout.tsx`).
- "API Endpoint Inventory" lists **8** endpoints — the App now calls **13**.

**Finding D-11.** The App's own orientation document is 32 days old and wrong on three
counts. A new contributor trusting it would build against a system that no longer exists.

---

## 10. Summary of findings

| ID   | Finding                                                                           | Severity     |
| ---- | --------------------------------------------------------------------------------- | ------------ |
| D-1  | Drift is in _consumed surface_, not calendar days                                 | context      |
| D-2  | App commits at ~1/9th the rate of both upstream repos                             | **High**     |
| D-3  | App's 13 endpoints are a coherent narrow slice, not a half-built console          | context      |
| D-4  | **Zero OpenAPI annotations in `src/events/` — no machine-readable contract**      | **Critical** |
| D-5  | 13 of 15 contract-relevant backend commits unabsorbed/unverified since 2026-09-12 | **High**     |
| D-6  | Door-side failure is non-recoverable; the risk is asymmetric                      | **High**     |
| D-7  | Ticket capability model exists only in FE+BE; App has no representation           | **Medium**   |
| D-8  | App is _ahead_ on check-in (957 vs 487 LOC) and behind everywhere else            | context      |
| D-9  | `token.tsx` shows a "thin shell" pattern exists by accident, with no policy       | **Medium**   |
| D-10 | No shared package / workspace / generated client across 5 repos                   | **High**     |
| D-11 | App's own `.project-context.md` is 32 days stale and wrong on 3 counts            | **Medium**   |
