/**
 * Generate the journey documents from the manifest.
 *
 * The manifest is the single source of truth for journeys and steps. Writing the
 * Chinese and English documents by hand would let them drift from the screenshot
 * manifest, and a handbook whose pictures disagree with its words is worse than
 * no handbook. So both documents are generated, and a verification step later
 * checks that every captured step appears in both.
 *
 * Run: node docs/handbook/tools/render-journeys.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { HANDBOOK_ROOT } from "./env.mjs";

const manifest = JSON.parse(
  fs.readFileSync(path.join(HANDBOOK_ROOT, "manifest.json"), "utf8"),
);

/** Journey ids are grouped by prefix; the prefix letter is the handbook part. */
const PARTS = {
  A: { zh: "第一部分：開始使用", en: "Part 1: Getting started" },
  B: { zh: "第二部分：開場之前", en: "Part 2: Before the doors open" },
  C: { zh: "第三部分：現場報到", en: "Part 3: Checking people in" },
  D: {
    zh: "第四部分：查名單與找人",
    en: "Part 4: The roster and looking people up",
  },
  E: { zh: "第五部分：NFC 手環", en: "Part 5: NFC wristbands" },
  F: { zh: "第六部分：特殊情況", en: "Part 6: When things are not normal" },
};

function personaLabel(key, lang) {
  return manifest.personas[key]?.[lang] ?? key;
}

function renderJourney(journey, lang) {
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const lines = [];

  lines.push(`### ${journey.id}．${L(journey.titleZh, journey.titleEn)}`, "");
  lines.push(`| | |`);
  lines.push(`| --- | --- |`);
  lines.push(
    `| ${L("誰做", "Who")} | ${personaLabel(journey.persona, lang)} |`,
  );
  lines.push(
    `| ${L("什麼時候", "When")} | ${L(journey.whenZh, journey.whenEn)} |`,
  );
  lines.push(
    `| ${L("要達到什麼", "What you want")} | ${L(journey.goalZh, journey.goalEn)} |`,
  );
  lines.push(
    `| ${L("開始之前", "Before you start")} | ${L(journey.beforeZh, journey.beforeEn)} |`,
  );
  lines.push(
    `| ${L("做完之後", "When you are done")} | ${L(journey.afterZh, journey.afterEn)} |`,
  );
  lines.push("");

  for (const step of journey.steps) {
    lines.push(`**${step.id}　${L("你做什麼", "What you do")}**`, "");
    lines.push(L(step.doZh, step.doEn), "");
    lines.push(`**${L("你會看到什麼", "What you see")}**`, "");
    lines.push(L(step.seeZh, step.seeEn), "");

    const shot = `assets/annotated/${step.id}.png`;
    lines.push(`![${step.id}](${shot})`, "");

    const notes = step.annotate ?? [];
    if (notes.length > 0) {
      lines.push(
        `| ${L("圖上編號", "Callout")} | ${L("是什麼", "What it points at")} |`,
      );
      lines.push(`| --- | --- |`);
      for (const note of notes) {
        lines.push(`| ${note.label} | ${L(note.whatZh, note.whatEn)} |`);
      }
      lines.push("");
    }

    const captureNote = L(step.captureNoteZh, step.captureNoteEn);
    if (captureNote) {
      lines.push(
        `> **${L("關於這張圖", "About this image")}**：${captureNote}`,
        "",
      );
    }
  }

  return lines.join("\n");
}

function renderDocument(lang) {
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const out = [];

  out.push(
    lang === "zh"
      ? "# LinkCard Event Admin — 使用手冊（旅程設計）"
      : "# LinkCard Event Admin — Handbook (journey design)",
    "",
  );
  out.push(
    L(`\`${manifest.meta.platformZh}\``, `\`${manifest.meta.platformEn}\``),
    "",
  );
  out.push(
    `**${L("給誰看", "Audience")}**：${L(manifest.meta.audienceZh, manifest.meta.audienceEn)}`,
    "",
  );
  out.push(
    `**${L("畫面怎麼來的", "How the screens were captured")}**：${L(manifest.meta.captureZh, manifest.meta.captureEn)}`,
    "",
  );

  out.push(lang === "zh" ? "## 兩種使用者" : "## The two kinds of user", "");
  for (const persona of Object.values(manifest.personas)) {
    out.push(
      `- **${persona[lang]}**：${lang === "zh" ? persona.descZh : persona.descEn}`,
    );
  }
  out.push("");

  // Which route? Phone app or laptop desk. Prose only: it deliberately has no
  // steps and no screenshots, because both routes already document themselves
  // (Part 5 for the phone, the separate web handbook for the laptop) and a
  // screenshot of a route you are not taking only adds noise.
  if (manifest.deskChoice) {
    const dc = manifest.deskChoice;
    out.push(`## ${L(dc.headingZh, dc.headingEn)}`, "");
    out.push(L(dc.introZh, dc.introEn), "");
    out.push(L(dc.ruleZh, dc.ruleEn), "");
    out.push(
      `| ${(lang === "zh" ? dc.tableHeadZh : dc.tableHeadEn).join(" | ")} |`,
    );
    out.push(`| --- | --- | --- |`);
    for (const row of dc.rows) {
      out.push(
        `| ${L(row.haveZh, row.haveEn)} | ${L(row.routeZh, row.routeEn)} | ${L(row.whyZh, row.whyEn)} |`,
      );
    }
    out.push("");
    out.push(L(dc.clearZh, dc.clearEn), "");
    out.push(L(dc.pointerZh, dc.pointerEn), "");
  }

  out.push(lang === "zh" ? "## 旅程一覽" : "## Journey index", "");
  out.push(
    `| ${L("編號", "ID")} | ${L("旅程", "Journey")} | ${L("誰做", "Who")} | ${L("步驟", "Steps")} |`,
  );
  out.push(`| --- | --- | --- | --- |`);
  let lastPart = null;
  for (const journey of manifest.journeys) {
    const part = journey.id[0];
    if (part !== lastPart) {
      out.push(`| | **${L(PARTS[part]?.zh, PARTS[part]?.en) ?? part}** | | |`);
      lastPart = part;
    }
    out.push(
      `| ${journey.id} | ${L(journey.titleZh, journey.titleEn)} | ${personaLabel(journey.persona, lang)} | ${journey.steps.length} |`,
    );
  }
  out.push("");

  lastPart = null;
  for (const journey of manifest.journeys) {
    const part = journey.id[0];
    if (part !== lastPart) {
      out.push(`## ${L(PARTS[part]?.zh, PARTS[part]?.en) ?? part}`, "");
      lastPart = part;
    }
    out.push(renderJourney(journey, lang), "");
  }

  return `${out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

for (const lang of ["zh", "en"]) {
  const file = path.join(HANDBOOK_ROOT, `journeys-${lang}.md`);
  fs.writeFileSync(file, renderDocument(lang));
  const journeys = manifest.journeys.length;
  const steps = manifest.journeys.reduce((n, j) => n + j.steps.length, 0);
  console.log(
    `wrote ${path.relative(HANDBOOK_ROOT, file)} — ${journeys} journeys, ${steps} steps`,
  );
}
