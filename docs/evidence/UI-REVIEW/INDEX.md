# UI-REVIEW evidence — LinkCard_Event_Admin_App_Expo

First-ever UI review of this app (roadmap item `H1-13`). Reviewer: DISPATCH D4, `edison-ui-ux-hostile-review`.

## Review environment

| Item        | Value                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode        | **LIVE** (real Expo web render, real element geometry)                                                                                                                                                                      |
| URL         | `http://localhost:8162`                                                                                                                                                                                                     |
| Server      | `npx expo start --web --port 8162` ; npm PID 15742, node PID 16108                                                                                                                                                          |
| Server log  | `/tmp/lc-clo-D4-server.txt`                                                                                                                                                                                                 |
| Viewport    | **390 × 844**, dpr 1, `isMobile` NOT passed                                                                                                                                                                                 |
| Driver      | minimal CDP script `/tmp/lc-clo-D4-cdp.mjs` (chrome-headless-shell, no Playwright MCP)                                                                                                                                      |
| Measurement | `/tmp/lc-clo-D4-measure.js` — `getBoundingClientRect()` + `getComputedStyle` + WCAG relative-luminance contrast with alpha compositing over the full ancestor background chain (starting from the element's own background) |
| Auth        | `localStorage["lc_event_admin_token"] = "probe-token-not-a-credential"` (a non-credential literal, not a real token)                                                                                                        |
| API         | All backend calls intercepted via CDP `Fetch` and fulfilled locally; host `staging-api.link-card.xyz`                                                                                                                       |

**Method note on touch targets.** Every size below is the element's own
`getBoundingClientRect()` box. `hitSlop` is deliberately NOT counted, because
`hitSlop` does not change the box and react-native-web does not apply it at all.
Where the source declares `hitSlop`, the companion says so, so a native reading
can be derived.

## Evidence validity — read this before citing any image

Two harness faults were found and both are disclosed rather than papered over.

1. **`62`–`66` (runs r6/r6b/r6c) are INVALID.** The driver typed into
   `input[type=search]`, but this app's input carries no `type` attribute, only
   `role="search"`, so the selector never matched and the field stayed empty.
   The submit button was therefore `disabled: true` and every "result" shot
   captured the same idle screen. The apparent value `got="NOEL"` in those logs
   is the driver's own null-sentinel, not a page value. Those images are
   **deliberately not archived**. The core check-in result states were only
   captured afterwards, by `80`–`85`.
2. **`50-registrations-empty` is INVALID.** The mock rule `urlContains:
"/registrations"` also matched the _document_ navigation to the app route
   `/EVT-1/registrations`, so the page rendered my JSON mock instead of the app.
   Confirmed by the mock-hit path `/EVT-1/registrations`. Not archived.

The registrations screen and the scan-camera path were therefore **not**
reviewed. See `§4` of the report.

## Shot inventory

| Shot                             | State                              | URL               | Mock                  | Valid                     |
| -------------------------------- | ---------------------------------- | ----------------- | --------------------- | ------------------------- |
| `10-login-390x844`               | login default                      | `/`               | —                     | yes                       |
| `11-login-focus-tab`             | login, keyboard focus              | `/`               | —                     | yes                       |
| `12-login-empty-submit`          | both fields empty                  | `/`               | —                     | yes                       |
| `13-login-invalid-email`         | invalid email, password also empty | `/`               | —                     | yes (superseded by 15)    |
| `14-login-focus-login-btn`       | focus on 登入 CTA                  | `/`               | —                     | yes                       |
| `15-login-invalid-email-with-pw` | invalid email, password present    | `/`               | —                     | yes                       |
| `20-login-401-invalid-password`  | 401                                | `/`               | `401`                 | yes                       |
| `21-login-403-suspended`         | 403                                | `/`               | `403`                 | yes                       |
| `22-login-503-gateway`           | 503                                | `/`               | `503`                 | yes                       |
| `23-login-offline`               | transport failure                  | `/`               | `fail`                | yes                       |
| `24-login-loading`               | in-flight                          | `/`               | delayed               | yes                       |
| `25-login-reveal-focus`          | focus on 顯示密碼                  | `/`               | —                     | yes                       |
| `30-home-390x844`                | home loaded                        | `/home`           | 2 events              | yes                       |
| `31-home-empty`                  | home empty                         | `/home`           | 0 events              | yes                       |
| `32-home-error`                  | home **load failure**              | `/home`           | `fail`                | yes — **identical to 31** |
| `40-overview-loading`            | overview loading                   | `/EVT-1/overview` | delayed               | yes                       |
| `41-overview-390x844`            | overview loaded                    | `/EVT-1/overview` | counts                | yes                       |
| `60-checkin-scan-mode`           | check-in default tab               | `/EVT-1/check-in` | —                     | yes                       |
| `61-checkin-manual-mode`         | manual tab, empty                  | `/EVT-1/check-in` | —                     | yes                       |
| `67-checkin-counter-error`       | counter endpoint fails             | `/EVT-1/check-in` | `fail`                | yes                       |
| `70-diagnostic-manual`           | element inventory                  | `/EVT-1/check-in` | —                     | yes                       |
| `80-checkin-filled-manual`       | code typed, CTA enabled            | `/EVT-1/check-in` | —                     | yes                       |
| `81-checkin-404`                 | lookup 404                         | `/EVT-1/check-in` | `404`                 | yes                       |
| `82-checkin-502`                 | lookup 502                         | `/EVT-1/check-in` | `502`                 | yes — **identical to 81** |
| `83-checkin-duplicate`           | already checked in                 | `/EVT-1/check-in` | `CHECKED_IN`          | yes                       |
| `84-checkin-valid-prefetch`      | success, just after write          | `/EVT-1/check-in` | `CONFIRMED`+`checkin` | yes                       |
| `85-checkin-success`             | success, settled                   | `/EVT-1/check-in` | idem                  | yes                       |

Raw driver output and per-step measurements: `/tmp/lc-clo-D4-r9/_results.json`
(and `-r2`, `-r4`, `-r5`, `-r6b`, `-r8` for the earlier runs).

## Convention note

This folder follows the V3 convention of `LinkCard_Promoter_App_Expo/docs/evidence/V3/`
(one `.txt` companion per shot). Per-shot companions are written for the
**check-in flow and the home load-failure state** — the core of this review. For
the login and overview shots the description, navigation and mock live in the
inventory table above; there is no separate companion file, and that is stated
here so a reader does not mistake the absence for a missing record.
