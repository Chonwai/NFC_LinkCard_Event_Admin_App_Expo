# 08 — Evidence Log

Author's reproduction record for the LC-ADMP pack. Every command below was run on **2026-10-15** from
`/Users/chonwai/Desktop/Self/Lab/LinkCard`. Nothing in this loop modified any product code — the entire
deliverable is documentation.

## 1. Frozen measurement baseline

Because the pack's own commits move the Admin App's HEAD, every command in `01-drift-audit.md` names a
SHA rather than `HEAD`:

```sh
A=d2379da   # LinkCard_Event_Admin_App_Expo  (2026-10-11, last commit before this pack)
F=7fe5587   # LinkCard_Frontend             (2026-10-15)
B=500ee997  # LinkCard_ExpressJS_Backend    (2026-10-15)
```

## 2. Change volume (`01-drift-audit.md` §2)

```sh
git -C LinkCard_Frontend rev-list --count --since=2026-09-25 $F                                  # 239
git -C LinkCard_Frontend log --since=2026-09-25 --oneline --no-merges $F \
  -- app components lib hooks store types | wc -l                                               # 143
git -C LinkCard_Frontend rev-list --count --since=2026-10-12 $F                                  # 52
git -C LinkCard_Frontend log --since=2026-10-12 --oneline --no-merges $F \
  -- app components lib hooks store types | wc -l                                               # 31
git -C LinkCard_ExpressJS_Backend rev-list --count --since=2026-09-25 $B                         # 1108
git -C LinkCard_ExpressJS_Backend log --since=2026-09-25 --oneline --no-merges $B \
  -- src prisma | wc -l                                                                         # 210
git -C LinkCard_ExpressJS_Backend log --since=2026-10-12 --oneline --no-merges $B \
  -- src prisma | wc -l                                                                         # 34
git -C LinkCard_Event_Admin_App_Expo rev-list --count --since=2026-09-25 $A                      # 25
git -C LinkCard_Event_Admin_App_Expo log --since=2026-09-25 --oneline --no-merges $A \
  -- src | wc -l                                                                                # 15
git -C LinkCard_Event_Admin_App_Expo log --since=2026-10-12 --oneline --no-merges $A \
  -- src | wc -l                                                                                # 0
git -C LinkCard_ExpressJS_Backend log --since=2026-09-25 --name-only \
  --pretty=format: --no-merges $B -- src/events | sed '/^$/d' | sort -u | wc -l                 # 64
```

**Method note (a real trap, found by the reviewer).** The revision must come **before** `--`. The form
`log … -- <pathspec> <rev>` silently treats `<rev>` as an additional pathspec and returns a wrong
count. The first version of `01-drift-audit.md` contained this error and reported the backend as 212
instead of 210.

## 3. API surface (`01-drift-audit.md` §3, §4)

```sh
for f in LinkCard_ExpressJS_Backend/src/events/routes/*.routes.ts; do
  printf '%s  %s\n' "$(grep -cE 'router\.(get|post|put|patch|delete)\(' "$f")" "$(basename "$f")"
done
# 23 events · 18 exhibitors · 14 event-ops · 14 registrations · 14 sessions-polls · 11 premium
# 10 engagement · 7 connection-requests · 4 exhibitor-import · 4 registration-import · 2 exhibitor-invites
# total 121

grep -rc "@openapi\|@swagger" LinkCard_ExpressJS_Backend/src --include='*.ts' \
  | awk -F: '{s+=$2} END {print s}'                                                              # 48
grep -rc "@openapi\|@swagger" LinkCard_ExpressJS_Backend/src/events --include='*.ts' \
  | awk -F: '{s+=$2} END {print s+0}'                                                            # 0

grep -rhoE "[\"'\`]/api/[^\"'\`]*" LinkCard_Event_Admin_App_Expo/src \
  | sed 's/^[^/]*//' | sort -u                                                                   # 14 (incl. /api/users/me)
```

`/api/users/me` is called at `src/services/auth.service.ts:26`. It was missing from the first version
of the audit, which reported 13.

## 4. Schema (`01-drift-audit.md` §6)

```sh
cd LinkCard_ExpressJS_Backend
ls -1 prisma/migrations | grep -c '^2'                                                            # 81
ls -1 prisma/migrations | grep '^2' | awk -F_ '$1 >= "20260901"' | wc -l                          # 20
ls -1 prisma/migrations | grep '^2' | awk -F_ '$1 >= "20261001"' | wc -l                          # 8
```

The `grep '^2'` guard is required: without it `migration_lock.toml` is counted and the 2026-10-01
figure becomes 9.

## 5. App inventory and shared-code drift (`01-drift-audit.md` §7, §8)

```sh
cd LinkCard_Event_Admin_App_Expo
wc -l "src/app/(auth)/home.tsx" "src/app/(auth)/settings.tsx" \
      "src/app/(auth)/[eventId]/overview.tsx" "src/app/(auth)/[eventId]/check-in.tsx" \
      "src/app/(auth)/[eventId]/registrations.tsx" \
      "src/app/(auth)/[eventId]/registrant/[registrationId].tsx" \
      "src/app/(auth)/[eventId]/badges.tsx" "src/app/(auth)/[eventId]/nfc-bind.tsx" \
      "src/app/(auth)/[eventId]/nfc-read.tsx" "src/app/(auth)/[eventId]/nfc-exchange.tsx" \
      "src/app/(auth)/[eventId]/walk-in.tsx" "src/app/(auth)/[eventId]/token.tsx" | tail -1   # 5315
find src/services -type f | xargs wc -l | tail -1                                              # 394
ls -1 tests/*.test.mjs | wc -l                                                                 # 25
ls -1 tests/journeys/*.test.mjs | wc -l                                                        # 4

comm -12 <(cd ../LinkCard_Promoter_App_Expo/src && find . -type f | sort) \
         <(cd ../LinkCard_Event_Admin_App_Expo/src && find . -type f | sort) | wc -l           # 29

git ls-files ios | wc -l                                                                        # 18
grep -c expo-updates package.json                                                               # 0
ls .github/workflows/                                                                            # ci.yml

find .. -maxdepth 2 \( -name 'pnpm-workspace.yaml' -o -name 'turbo.json' \
  -o -name 'nx.json' -o -name 'lerna.json' \) -not -path '*/node_modules/*'                     # (empty)
```

## 6. Loop channel log

| #   | Unit                  | Agent                  | Dispatch                                                               | Result                 | Notes                                                                                                                   |
| --- | --------------------- | ---------------------- | ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | R1 deep research      | `jarvis-deep-research` | spec file `/tmp/admp-r1-spec.md`, ~110-character prompt referencing it | **first-shot success** | 1,326 lines, 122 distinct URLs, 0 subagents dispatched, 0 git writes, self-reported `OpenCode Go / Deepseek V4.1 Flash` |
| 2   | V1 independent review | `edison-doc-reviewer`  | spec file `/tmp/admp-v1-spec.md`, same short-prompt technique          | **first-shot success** | 408 lines; verdict `PASS WITH FINDINGS`; 0 Critical / 5 High / 13 Medium / 4 Low                                        |

Both dispatches used the **spec-file pattern** (full instructions in a file under `/tmp`, dispatched
prompt kept to one sentence referencing a short absolute path). No `TLS terminated`, no timeout, no
`not found` occurred in this loop.

**Maker ≠ Checker was preserved as different agents**, not merely different instances: the research and
the review were dispatched to two different named agents, and the reviewer declared the author did not
write `07-verification.md`.

## 7. Repair round

All 22 review findings were triaged. Disposition:

| Severity | Count | Disposition                                                          |
| -------- | ----- | -------------------------------------------------------------------- |
| High     | 5     | All repaired and marked inline in the affected documents (V-01…V-05) |
| Medium   | 13    | All repaired (V-06…V-22)                                             |
| Low      | 4     | All repaired (V-23…V-26)                                             |

`07-verification.md` is preserved **unmodified** as the record of what was wrong. Corrections are
applied in `01`–`06` and marked with a `Repair note` / `Correction` / `(review finding V-nn)`
annotation at each site, so a reader can see what the original claim was and why it changed. The
research report carries a consolidated `Corrections applied after independent review` section rather
than silent edits, because it was produced by a separate unit and its provenance matters.

**Numbers that changed as a result of the review** (all in the direction of _more_ drift, not less):

| Claim                                    | Was             | Now                         |
| ---------------------------------------- | --------------- | --------------------------- |
| App code commits since 2026-09-25        | —               | 15 (unchanged)              |
| App all commits at the declared baseline | 27              | **25**                      |
| FE code commits since 2026-10-12         | 53              | **31**                      |
| Migrations since 2026-10-01              | 9               | **8**                       |
| App consumed endpoints                   | 13              | **14**                      |
| App screen LOC                           | 5,479           | **5,315**                   |
| Shared files between the two Expo apps   | ~1 (tokens)     | **29**                      |
| Near-duplicate UI components             | not reported    | **10**                      |
| Offline capability                       | implied present | **absent on both surfaces** |
| Phase 3 estimate                         | 9.5 days        | **11.5 days**               |
| Total estimate                           | ~37 days        | **~39 days**                |
