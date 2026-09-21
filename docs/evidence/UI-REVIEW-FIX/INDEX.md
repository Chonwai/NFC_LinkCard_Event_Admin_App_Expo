# UI-REVIEW-FIX evidence — LinkCard_Event_Admin_App_Expo

Rendered evidence for the four findings fixed in EXECUTE R2 (F-01 Critical, F-02 / F-03 / F-04
High), plus the four commits that fixed them.

This folder exists because the previous repair round verified `resolveCheckInErrorMessage` at
unit level, all green, and the screen still rendered a gateway 502 exactly like a genuine 404.
The lesson recorded here: a unit test of a function the render never consumed proves nothing.

## Method

| Item       | Value                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode       | **LIVE** (real Expo web render, real element geometry, real `innerText`)                                                                                             |
| URL        | `http://localhost:8162`                                                                                                                                              |
| Server     | `npx expo start --web --port 8162` (attempt 1 succeeded; log `/tmp/lc-exd-server.txt`)                                                                               |
| Viewport   | **390 × 844**, dpr 1, `isMobile` NOT passed                                                                                                                          |
| Driver     | minimal CDP script (chrome-headless-shell), same harness family as `docs/evidence/UI-REVIEW/`                                                                        |
| Auth       | `localStorage["lc_event_admin_token"] = "probe-token-not-a-credential"` (a non-credential literal)                                                                   |
| API        | every backend call intercepted via CDP `Fetch` and fulfilled locally; mocks matched by URL substring, so no host name appears here                                   |
| Assertions | a node script reads the driver's `_results.json` and the rendered `innerText` and exits non-zero when a check fails — **no verdict below is eyeballed off a bitmap** |

## Two runs, one plan

`before` and `after` are the **same** plan (same mocks, same navigation, same probes) run against
two trees: `after` = HEAD, `before` = the four fixed files reverted to `2c0c258` in the working
tree (no history was rewritten; the tree was restored and verified by md5 afterwards).

Per shot there is a `.txt` companion with the byte-exact `innerText`, the mocks that fired, and —
for the focus shots — the `getComputedStyle` measurement. `_verdict.txt` in each folder is the
assertion log, including the lines that would have failed.

## Verdicts

The assertion set is written so that each check _expects the opposite_ in the two phases; a
`before` run therefore cannot pass by accident, and an `after` run cannot pass while the defect is
still there.

| Check                   | before (2c0c258)                                                                        | after (HEAD)                                                         |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| F-01 502 vs 404         | **innerText 逐字相同**                                                                  | 兩者不同；502 有伺服器文案，404 有找不到報名                         |
| F-02 load failure       | 失敗畫面 = `沒有管理中的活動`，`loadFailed` 不在畫面上，與空清單 **innerText 逐字相同** | `載入活動失敗，請稍後再試` + `重新載入`，不再與空清單相同            |
| F-02 genuinely empty    | 空狀態（正確）                                                                          | 空狀態（未變）                                                       |
| F-03 counter dash       | 只有 `（累計，非今日）`，破折號沒有原因                                                 | `（讀取失敗，請重新整理）` + `—`                                     |
| F-04 focused CTA        | 內描邊 `2px rgb(124,58,237)` 對自身填色 `rgb(124,58,237)` = **1:1**（等於沒有指示）     | 外框 `2px rgb(124,58,237)` 對外側白底 = **5.70:1**，內描邊降為 `0px` |
| F-04 control (顯示密碼) | 外框 `1px rgb(0,95,204)` = 5.98:1                                                       | 5.98:1（未變）                                                       |

`before` run: 9/9 checks satisfied, exit 1 from the assertion script is expected in this phase
because the phase-aware predicates invert. `after` run (F-01/F-02/F-03): 7/7 of its checks pass;
the F-04 checks are covered by the login-only run archived as `after/01-*`, `after/02-*` and
`after/F-04_run.txt`.

## What each finding rests on

| Finding           | Unit test (node --test)                | Rendered assertion                                                                                                                          | Archived shot                                         |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| F-01 502 ≠ 404    | `tests/check-in-display.test.mjs` (12) | `innerText(502) !== innerText(404)`, 502 carries the server copy, 404 the not-found copy                                                    | `05-checkin-404`, `06-checkin-502`                    |
| F-02 load failure | `tests/event-list-phase.test.mjs` (9)  | failure shows `copy.home.loadFailed` + retry and no `沒有管理中的活動`; the error-free empty list still shows it; the two innerTexts differ | `03-home-load-failed`, `04-home-empty`                |
| F-03 counter dash | `tests/check-in-display.test.mjs`      | the counter hint reads `讀取失敗，請重新整理` while the value stays `—`                                                                     | `07-checkin-counter-failed`                           |
| F-04 focus ring   | `tests/button-focus-ring.test.mjs` (7) | focused CTA ring contrast vs its surroundings, measured with `getComputedStyle`                                                             | `01-login-focus-cta`, `02-login-focus-reveal-control` |

## Validity notes — read before citing

1. **The scan (camera) path is NOT covered.** The barcode path needs a camera; on web the app
   renders `無法取得相機權限`. Both paths go through the same `doLookupThenCheckIn` catch, but
   that is reasoning, not a measurement, and the camera path was not driven.
2. **F-04's probe cost the most and the failure is worth recording.** The login screen is only
   reachable without a token, and the Chrome profile used by the driver persists between runs — so
   after the first run had set `lc_event_admin_token`, every later run navigated `/` straight to
   `/home` and the probe reported "no focused element". That looked like a broken probe and was in
   fact a broken harness. The fix is one step (`localStorage.clear()` before the reload) and it is
   in the archived plan. The failed attempts are kept in the run logs rather than deleted.
3. **The counter value's own styling was deliberately not changed.** The dash keeps `type.h3` and
   `text.primary`; only the explanatory hint changes. That is a decision, not an omission — see the
   F-03 commit body.
4. **`before` shots for F-04 come from this round's baseline run**, where the focused CTA measured
   a 1:1 border, and they agree with the original review's own independent measurement in
   `docs/evidence/UI-REVIEW/`. Two separate harnesses, same conclusion.
