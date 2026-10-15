# Event Admin App — handbook

The operating handbook for **LinkCard Event Admin** (the Expo app that runs on
iOS and Android), in Chinese and English.

This is not the website handbook. That one lives in the backend repo under
`docs/handbooks/journey-handbook/` and documents the Next.js console. The two
apps have different screens, different jobs and different audiences.

## What is here

| Path                | What it is                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `manifest.json`     | **The single source of truth.** Every journey, step, screenshot action and callout, in both languages. |
| `journeys-zh.md`    | Generated from the manifest. Do not edit.                                                              |
| `journeys-en.md`    | Generated from the manifest. Do not edit.                                                              |
| `assets/raw/`       | Screenshots exactly as captured.                                                                       |
| `assets/boxes/`     | Where each callout was measured to be, in CSS pixels.                                                  |
| `assets/annotated/` | Screenshots with numbered boxes drawn on them. Shared by both languages.                               |
| `output/`           | The finished PDFs, plus the machine-readable check report.                                             |
| `tools/`            | The pipeline.                                                                                          |

The Chinese and English documents share one set of annotated images. Keeping a
single image set means a screenshot cannot be corrected in one language and
forgotten in the other.

## Rebuilding

Needs a local backend on `:3020`, the app served on `:8090`, and a seeded demo
dataset. Playwright is borrowed from the workspace's shared install.

```bash
# 1. demo data (in the backend repo). Rebuilds its own event every run.
cd ../LinkCard_ExpressJS_Backend
npx dotenv -e .env.local -- npx ts-node --files scripts/handbook-app/seed.ts

# 2. the app, against the local backend
cd ../LinkCard_Event_Admin_App_Expo
npx expo start --web --port 8090

# 3. the pipeline
node docs/handbook/tools/render-journeys.mjs   # manifest -> both documents
node docs/handbook/tools/capture.mjs           # walk every step, take pictures
node docs/handbook/tools/annotate.mjs          # draw the numbered boxes
node docs/handbook/tools/verify.mjs            # the checks; exits non-zero on failure
node docs/handbook/tools/build-handbook.mjs    # both PDFs, with the checks inside
```

**Re-seed before capturing.** Several steps check real people in, so a second
run against an unseeded database will photograph different results.

`node docs/handbook/tools/check-screens.mjs` answers "is the app still
capturable?" when a rebuild fails. Run it to tell "the app changed" apart from
"the pipeline broke".

`node docs/handbook/tools/inspect-screen.mjs [route]` prints what is actually on
a screen — every visible string, every button's accessible name and test id.
Use it to write a selector from reality instead of guessing.

## Rules the pipeline depends on

These were each learned by getting them wrong.

1. **Callouts are measured after the step's action runs.** Annotating the
   control you just clicked always fails, because clicking it is what removed
   it. Point at what the action produced.
2. **`text="X"` is an exact match, `text=X` is a substring match.** Chinese
   phrases are usually part of a longer string, so they need the unquoted form.
   A section heading that could collide needs the quoted form.
3. **Quote attribute values**: `[data-testid="x"]`, never `[data-testid=x]`.
   The unquoted form resolved inconsistently, which is worse than never matching
   — a flaky annotation looks like a working one until it isn't.
4. **The seeder owns the ids.** It rebuilds its event on every run, so
   `env.mjs` reads the event id and registration codes from
   `.capture/seed.json` _before_ `.capture.env`. A stale id does not error; every
   event screen simply reports that it could not load, which reads like a data
   problem rather than a wiring one.
5. **Never pipe a command you depend on through `head`.** It closes the pipe,
   SIGPIPEs the command, and kills it before it writes its output file.
6. **`testID` becomes `data-testid`** on web, but only for elements that have
   one. The bottom tab bar is plain `div`s with no role: navigate by route and
   annotate the label rather than synthesising a click.

## Capture environment and what it cannot show

Screens are captured by running the app on **Expo web** and driving it with
headless Chrome at a phone-sized viewport (390 x 844 at 2x). Coordinates come
from the live DOM, so the boxes are measured rather than eyeballed.

A browser is not a phone, and the handbook says so where it matters:

- **NFC** — the app detects a browser and shows "use a real Android device".
  Steps that need a physical tap carry a note in both languages.
- **Camera** — a browser has no camera, so the check-in screen shows its
  permission notice. The manual-entry fallback it offers is captured in full,
  and that is the path the handbook documents.
- **The token desk** is intentionally a doorway to the web console, not a
  feature. The handbook says so rather than hiding it.

## The checks

`verify.mjs` runs eleven checks over the manifest, the screenshots and the
generated documents, and the results are printed into both PDFs so a reader can
see what was verified. It exits non-zero on failure and is safe to run in CI.

The checks were mutation-tested: deleting an annotated image fails C1 and C11,
and moving a callout outside the frame fails C6. A check that cannot go red is
not a check.
