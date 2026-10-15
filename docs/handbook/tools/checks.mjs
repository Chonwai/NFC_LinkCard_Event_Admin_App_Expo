/**
 * Handbook — automated checks.
 *
 * A handbook is a pile of claims: that every step was photographed, that the
 * callouts point inside the frame, that both languages describe the same steps.
 * These checks make those claims falsifiable, and the results are printed into
 * each PDF so a reader can see what was and was not verified.
 *
 * Imported by both verify.mjs (to report) and build-handbook.mjs (to embed), so
 * the PDF can never carry a report produced by different logic.
 */
import { HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

const VIEWPORT = { width: 390, height: 844, scale: 2 };

function pngSize(file) {
  // Width/height live in the IHDR chunk, bytes 16..24 of a PNG.
  const buf = fs.readFileSync(file);
  if (buf.length < 24) return { width: 0, height: 0 };
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

export function runChecks() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(HANDBOOK_ROOT, "manifest.json"), "utf8"),
  );
  const steps = manifest.journeys.flatMap((j) => j.steps);
  const rawDir = path.join(HANDBOOK_ROOT, "assets", "raw");
  const annDir = path.join(HANDBOOK_ROOT, "assets", "annotated");
  const docs = {
    zh: path.join(HANDBOOK_ROOT, "journeys-zh.md"),
    en: path.join(HANDBOOK_ROOT, "journeys-en.md"),
  };
  const docText = Object.fromEntries(
    Object.entries(docs).map(([lang, file]) => [
      lang,
      fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "",
    ]),
  );

  const results = [];
  const add = (id, titleZh, titleEn, failures, detail) =>
    results.push({
      id,
      titleZh,
      titleEn,
      pass: failures.length === 0,
      failures: failures.slice(0, 8),
      detail,
    });

  // 1. Every step has both a raw and an annotated screenshot.
  {
    const missing = [];
    for (const s of steps) {
      for (const [kind, dir] of [
        ["raw", rawDir],
        ["annotated", annDir],
      ]) {
        if (!fs.existsSync(path.join(dir, `${s.id}.png`)))
          missing.push(`${s.id} (${kind})`);
      }
    }
    add(
      "C1",
      "每一步都有截圖（原圖與標註圖）",
      "Every step has a screenshot, raw and annotated",
      missing,
      `${steps.length} steps`,
    );
  }

  // 2 & 3. Annotated images are the expected size and genuinely contain a picture.
  {
    const wrongSize = [];
    const suspicious = [];
    for (const s of steps) {
      const file = path.join(annDir, `${s.id}.png`);
      if (!fs.existsSync(file)) continue;
      const { width, height, bytes } = pngSize(file);
      if (
        width !== VIEWPORT.width * VIEWPORT.scale ||
        height !== VIEWPORT.height * VIEWPORT.scale
      ) {
        wrongSize.push(`${s.id} is ${width}x${height}`);
      }
      // A phone screenshot at 2x with UI on it is comfortably larger than this;
      // a blank one is not. Cheap way to catch an image that failed to decode.
      if (bytes < 20_000) suspicious.push(`${s.id} only ${bytes} bytes`);
    }
    add(
      "C2",
      "標註圖尺寸正確（780 × 1688）",
      "Annotated images are 780 x 1688",
      wrongSize,
      `${steps.length} images`,
    );
    add(
      "C3",
      "標註圖不是空白",
      "Annotated images are not blank",
      suspicious,
      "size floor 20 KB",
    );
  }

  // 4, 5, 6. Callouts exist, are uniquely numbered, and sit inside the frame.
  {
    const noCallouts = [];
    const dupLabels = [];
    const outOfFrame = [];
    let totalCallouts = 0;
    for (const s of steps) {
      const notes = s.annotate ?? [];
      if (notes.length === 0) noCallouts.push(s.id);
      totalCallouts += notes.length;
      const labels = notes.map((n) => String(n.label));
      if (new Set(labels).size !== labels.length) dupLabels.push(s.id);

      const boxFile = path.join(
        HANDBOOK_ROOT,
        "assets",
        "boxes",
        `${s.id}.json`,
      );
      if (!fs.existsSync(boxFile)) continue;
      for (const box of JSON.parse(fs.readFileSync(boxFile, "utf8")).boxes) {
        const inside =
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= VIEWPORT.width + 1 &&
          box.y + box.height <= VIEWPORT.height + 1;
        if (!inside)
          outOfFrame.push(
            `${s.id} #${box.label} [${box.x},${box.y},${box.width},${box.height}]`,
          );
      }
    }
    add(
      "C4",
      "每一步至少有一個標註",
      "Every step has at least one callout",
      noCallouts,
      `${totalCallouts} callouts total`,
    );
    add(
      "C5",
      "同一步的標註編號不重複",
      "Callout numbers are unique within a step",
      dupLabels,
      "",
    );
    add(
      "C6",
      "標註框都落在畫面內",
      "Every callout box sits inside the phone frame",
      outOfFrame,
      "measured from the live DOM",
    );
  }

  // 7 & 8. Both languages cover the same steps.
  {
    const missingZh = steps
      .filter((s) => !docText.zh.includes(s.id))
      .map((s) => s.id);
    const missingEn = steps
      .filter((s) => !docText.en.includes(s.id))
      .map((s) => s.id);
    add(
      "C7",
      "每一步都出現在中文文件",
      "Every step appears in the Chinese document",
      missingZh,
      `${steps.length} steps`,
    );
    add(
      "C8",
      "每一步都出現在英文文件",
      "Every step appears in the English document",
      missingEn,
      `${steps.length} steps`,
    );
  }

  // 9. Both languages are complete, not just structurally present.
  {
    const gaps = [];
    for (const s of steps) {
      for (const key of ["doZh", "doEn", "seeZh", "seeEn"]) {
        if (!s[key] || !String(s[key]).trim()) gaps.push(`${s.id}.${key}`);
      }
      const hasZh = Boolean(s.captureNoteZh);
      const hasEn = Boolean(s.captureNoteEn);
      if (hasZh !== hasEn)
        gaps.push(`${s.id} capture note missing in one language`);
    }
    add(
      "C9",
      "每一步中英文說明都完整",
      "Every step has both languages",
      gaps,
      "",
    );
  }

  // 10. Nothing left unresolved, and every referenced image exists.
  {
    const leftovers = [];
    for (const [lang, text] of Object.entries(docText)) {
      const unresolved = text.match(/\{(eventId|registrationId)\}/g) ?? [];
      if (unresolved.length)
        leftovers.push(
          `${lang}: ${unresolved.length} unresolved placeholder(s)`,
        );
    }
    const brokenRefs = [];
    for (const [lang, text] of Object.entries(docText)) {
      for (const match of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        const ref = match[1];
        if (!fs.existsSync(path.join(HANDBOOK_ROOT, ref)))
          brokenRefs.push(`${lang}: ${ref}`);
      }
    }
    add(
      "C10",
      "文件沒有未解析的佔位符",
      "Documents contain no unresolved placeholders",
      leftovers,
      "",
    );
    add(
      "C11",
      "文件引用的圖片都存在",
      "Every image referenced by the documents exists",
      brokenRefs,
      "",
    );
  }

  return { manifest, steps, results };
}

export function summarise(checks) {
  const passed = checks.results.filter((r) => r.pass).length;
  return {
    passed,
    total: checks.results.length,
    allPass: passed === checks.results.length,
  };
}
