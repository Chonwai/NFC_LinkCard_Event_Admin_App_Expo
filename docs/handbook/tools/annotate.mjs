/**
 * Handbook — annotate the screenshots.
 *
 * Draws a numbered box around each callout, using the coordinates measured from
 * the live DOM during capture. Numbers land in a badge on the box corner so the
 * text beneath the picture can explain what each one points at.
 *
 * The drawing is done in the browser rather than with an image library: the raw
 * PNG is placed on a page at its exact CSS size, translucent overlays are
 * positioned at the measured coordinates, and the whole thing is screenshotted.
 * That keeps the pipeline dependency-free and means the boxes are drawn in the
 * same coordinate space they were measured in, so there is no scaling step to
 * get wrong.
 *
 * Chinese and English share this one set of images; only the caption text in the
 * documents differs.
 *
 * Run: node docs/handbook/tools/annotate.mjs
 */
import { chromium } from "./pw.mjs";
import { HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(
  fs.readFileSync(path.join(HANDBOOK_ROOT, "manifest.json"), "utf8"),
);
const RAW_DIR = path.join(HANDBOOK_ROOT, "assets", "raw");
const BOX_DIR = path.join(HANDBOOK_ROOT, "assets", "boxes");
const OUT_DIR = path.join(HANDBOOK_ROOT, "assets", "annotated");

const VIEWPORT = manifest.meta.viewport ?? {
  width: 390,
  height: 844,
  scale: 2,
};

/** Ring and badge colours: high contrast against a light app UI. */
const ACCENT = "#d81b60";
const BADGE_TEXT = "#ffffff";

/**
 * The screenshot is inlined as a data URI rather than referenced as file://,
 * because a page created with setContent() has an opaque origin and Chrome
 * refuses to load file:// subresources into it — the image silently comes out
 * broken and you only notice by looking at the result.
 */
function pageHtml(imageHref, boxes) {
  const overlays = boxes
    .map((box) => {
      const label = String(box.label);
      // Put the badge above-left of the box when there is room, otherwise
      // tuck it just inside the top-left corner so it never leaves the frame.
      const above = box.y >= 22;
      const badgeTop = above ? box.y - 20 : box.y + 2;
      const badgeLeft = box.x >= 20 ? box.x - 4 : box.x + 2;
      return `
        <div class="ring" style="
            left:${box.x}px; top:${box.y}px;
            width:${box.width}px; height:${box.height}px;"></div>
        <div class="badge" style="left:${badgeLeft}px; top:${badgeTop}px;">${label}</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${VIEWPORT.width}px; height:${VIEWPORT.height}px; overflow:hidden; background:#fff; }
  .shot { position:absolute; inset:0; width:${VIEWPORT.width}px; height:${VIEWPORT.height}px; display:block; }
  .ring {
    position:absolute;
    border:2.5px solid ${ACCENT};
    border-radius:8px;
    box-shadow:0 0 0 1.5px rgba(255,255,255,.9), 0 0 0 4px rgba(216,27,96,.18);
  }
  .badge {
    position:absolute;
    min-width:20px; height:20px; padding:0 5px;
    border-radius:10px;
    background:${ACCENT};
    color:${BADGE_TEXT};
    font:700 13px/20px -apple-system, "Helvetica Neue", Arial, sans-serif;
    text-align:center;
    box-shadow:0 0 0 2px #fff;
    z-index:2;
  }
</style></head>
<body>
  <img class="shot" src="${imageHref}">
  ${overlays}
</body></html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.scale ?? 2,
  });
  const page = await context.newPage();

  const results = [];
  for (const journey of manifest.journeys) {
    for (const step of journey.steps) {
      const raw = path.join(RAW_DIR, `${step.id}.png`);
      const boxFile = path.join(BOX_DIR, `${step.id}.json`);
      if (!fs.existsSync(raw) || !fs.existsSync(boxFile)) {
        results.push({
          id: step.id,
          ok: false,
          error: "missing raw image or boxes",
        });
        continue;
      }

      const { boxes } = JSON.parse(fs.readFileSync(boxFile, "utf8"));
      const dataUri = `data:image/png;base64,${fs.readFileSync(raw).toString("base64")}`;
      await page.setContent(pageHtml(dataUri, boxes), { waitUntil: "load" });

      // Wait for the screenshot to decode, then confirm it actually decoded.
      // A blank or broken image would otherwise sail through unnoticed and only
      // show up as a mysterious white page in the finished PDF.
      const naturalWidth = await page.evaluate(async () => {
        const img = document.querySelector("img");
        if (img && !img.complete) {
          await new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          });
        }
        return img?.naturalWidth ?? 0;
      });
      if (naturalWidth === 0) {
        results.push({
          id: step.id,
          ok: false,
          error: "screenshot did not decode",
        });
        continue;
      }

      const out = path.join(OUT_DIR, `${step.id}.png`);
      await page.screenshot({ path: out });
      results.push({ id: step.id, ok: true, callouts: boxes.length, out });
    }
  }

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  fs.writeFileSync(
    path.join(HANDBOOK_ROOT, "assets", "annotate-report.json"),
    `${JSON.stringify({ results }, null, 2)}\n`,
  );
  console.log(
    `annotated ${ok}/${results.length} screenshots -> assets/annotated/`,
  );
  for (const bad of results.filter((r) => !r.ok))
    console.log(`  FAIL ${bad.id}: ${bad.error}`);
  if (ok !== results.length) process.exit(1);
}

main().catch((error) => {
  console.error("annotate failed:", error.message);
  process.exit(1);
});
