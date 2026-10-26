/**
 * Handbook — build the PDFs.
 *
 * One manifest, two languages, two PDFs. The images are shared: Chinese and
 * English readers see the same annotated screenshots and differ only in the
 * words around them. Keeping a single image set also means a screenshot can
 * never be fixed in one language and forgotten in the other.
 *
 * Rendering goes through headless Chrome rather than a markdown converter,
 * because the layout needs control that a converter will not give: each journey
 * starting on a fresh page, no step split across a page break, and page numbers.
 *
 * Run: node docs/handbook/tools/build-handbook.mjs
 */
import { chromium } from "./pw.mjs";
import { runChecks, summarise } from "./checks.mjs";
import { HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(
  fs.readFileSync(path.join(HANDBOOK_ROOT, "manifest.json"), "utf8"),
);
const DIST = path.join(HANDBOOK_ROOT, "output");

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

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Manifest prose carries a little Markdown: **bold** for emphasis and `code`
 * for paths. Escape first, then promote those two markers, so nothing in the
 * text can ever reach the document as live markup.
 */
const rich = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

/** Bilingual labels, chosen once so the two documents cannot fall out of step. */
const T = {
  zh: {
    title: "LinkCard Event Admin",
    subtitle: "現場工作手冊",
    forWhom: "這本手冊給誰看",
    howCaptured: "這些畫面怎麼來的",
    howToRead: "怎麼用這本手冊",
    readTips: [
      "每一節都是一件事。跟著號碼做，做完就完成一件事。",
      "圖上的圓形數字，對應圖下方的說明表。",
      "如果畫面和你看到的不一樣，先看那一步的說明；差異通常是有原因的。",
      "看到「尚未開放」的功能，就代表人為暫時不能做，需要人工處理。",
    ],
    personas: "兩種使用者",
    contents: "目錄",
    journey: "旅程",
    steps: "步",
    who: "誰做",
    when: "什麼時候",
    want: "要達到什麼",
    before: "開始之前",
    after: "做完之後",
    youDo: "你做什麼",
    youSee: "你會看到什麼",
    callout: "圖上編號",
    what: "是什麼",
    aboutImage: "關於這張圖",
    page: "頁",
    checksHeading: "自動檢查結果",
    checksIntro:
      "下列檢查在產生這份文件時，對照 manifest、截圖與文件本身執行。列在這裡是為了讓你知道哪些事情被驗證過、哪些沒有。",
    checksPass: "項通過",
    checksFail: "項失敗",
    checksUnverified:
      "沒有涵蓋的部分：文字對真人讀起來清不清楚，以及 App 改版之後畫面是否仍然一致。App 有任何改動，請重新執行產生器。",
  },
  en: {
    title: "LinkCard Event Admin",
    subtitle: "On-site handbook",
    forWhom: "Who this handbook is for",
    howCaptured: "How these screens were captured",
    howToRead: "How to use this handbook",
    readTips: [
      "Each section is one job. Follow the numbers and you have done that job.",
      "The circled numbers on a picture match the table underneath it.",
      "If your screen looks different, read that step's note first. The difference usually has a reason.",
      "Anything marked as not yet available means a person has to handle it by hand for now.",
    ],
    personas: "The two kinds of user",
    contents: "Contents",
    journey: "Journey",
    steps: "steps",
    who: "Who",
    when: "When",
    want: "What you want",
    before: "Before you start",
    after: "When you are done",
    youDo: "What you do",
    youSee: "What you see",
    callout: "Callout",
    what: "What it points at",
    aboutImage: "About this image",
    page: "Page",
    checksHeading: "Automatic checks",
    checksIntro:
      "These ran against the manifest, the screenshots and this document as it was built. They are recorded so you can see what was verified, and what was not.",
    checksPass: "pass",
    checksFail: "fail",
    checksUnverified:
      "Not covered: whether the wording reads clearly to a person, and whether the screens still look like this after the app changes. Re-run the builder after any app change.",
  },
};

function renderStep(step, lang) {
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const t = T[lang];
  const out = [];

  out.push(`<section class="step">`);
  out.push(
    `<h3><span class="sid">${esc(step.id)}</span> ${esc(L(step.doZh, step.doEn))}</h3>`,
  );
  out.push(
    `<p class="see"><b>${t.youSee}：</b>${esc(L(step.seeZh, step.seeEn))}</p>`,
  );
  out.push(
    `<figure><img src="../assets/annotated/${esc(step.id)}.png" alt="${esc(step.id)}"></figure>`,
  );

  const notes = step.annotate ?? [];
  if (notes.length) {
    out.push(`<table class="callouts"><tbody>`);
    for (const n of notes) {
      out.push(
        `<tr><th>${esc(n.label)}</th><td>${esc(L(n.whatZh, n.whatEn))}</td></tr>`,
      );
    }
    out.push(`</tbody></table>`);
  }

  const captureNote = L(step.captureNoteZh, step.captureNoteEn);
  if (captureNote) {
    out.push(`<p class="note"><b>${t.aboutImage}：</b>${esc(captureNote)}</p>`);
  }

  out.push(`</section>`);
  return out.join("\n");
}

function renderJourney(journey, lang) {
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const t = T[lang];
  const out = [];

  out.push(`<article class="journey">`);
  out.push(
    `<h2><span class="jid">${esc(journey.id)}</span> ${esc(L(journey.titleZh, journey.titleEn))}</h2>`,
  );
  out.push(`<table class="facts"><tbody>`);
  const rows = [
    [t.who, manifest.personas[journey.persona]?.[lang] ?? journey.persona],
    [t.when, L(journey.whenZh, journey.whenEn)],
    [t.want, L(journey.goalZh, journey.goalEn)],
    [t.before, L(journey.beforeZh, journey.beforeEn)],
    [t.after, L(journey.afterZh, journey.afterEn)],
  ];
  for (const [k, v] of rows)
    out.push(`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`);
  out.push(`</tbody></table>`);

  for (const step of journey.steps) out.push(renderStep(step, lang));
  out.push(`</article>`);
  return out.join("\n");
}

function buildHtml(lang) {
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const t = T[lang];
  const body = [];

  body.push(`<section class="cover">`);
  body.push(`<div class="cover-inner">`);
  body.push(
    `<p class="kicker">${esc(L(manifest.meta.platformZh, manifest.meta.platformEn))}</p>`,
  );
  body.push(`<h1>${esc(t.title)}</h1>`);
  body.push(`<p class="sub">${esc(t.subtitle)}</p>`);
  body.push(
    `<p class="cover-meta">${esc(L(manifest.meta.audienceZh, manifest.meta.audienceEn))}</p>`,
  );
  body.push(`</div></section>`);

  body.push(`<section class="front">`);
  body.push(`<h2>${t.forWhom}</h2>`);
  body.push(`<ul>`);
  for (const persona of Object.values(manifest.personas)) {
    body.push(
      `<li><b>${esc(persona[lang])}</b>：${esc(L(persona.descZh, persona.descEn))}</li>`,
    );
  }
  body.push(`</ul>`);
  body.push(`<h2>${t.howToRead}</h2><ul>`);
  for (const tip of t.readTips) body.push(`<li>${esc(tip)}</li>`);
  body.push(`</ul>`);
  body.push(`<h2>${t.howCaptured}</h2>`);
  body.push(
    `<p class="note">${esc(L(manifest.meta.captureZh, manifest.meta.captureEn))}</p>`,
  );
  body.push(`</section>`);

  // Which route? Phone app or laptop desk. Same prose, same order and same
  // headers as render-journeys.mjs, because both documents are built from this
  // one manifest: a reader holding the PDF must not get a shorter answer than
  // a reader holding the .md. Prose only — no steps and no screenshots, since
  // both routes already document themselves (Part 5 for the phone, the separate
  // web handbook for the laptop) and a screenshot of the route you did not take
  // only adds noise.
  if (manifest.deskChoice) {
    const dc = manifest.deskChoice;
    const heads = lang === "zh" ? dc.tableHeadZh : dc.tableHeadEn;
    body.push(`<section class="deskchoice">`);
    body.push(`<h2>${esc(L(dc.headingZh, dc.headingEn))}</h2>`);
    body.push(`<p>${rich(L(dc.introZh, dc.introEn))}</p>`);
    body.push(`<p class="rule">${rich(L(dc.ruleZh, dc.ruleEn))}</p>`);
    body.push(`<table class="routetable">`);
    body.push(`<thead><tr>`);
    for (const head of heads) body.push(`<th>${esc(head)}</th>`);
    body.push(`</tr></thead><tbody>`);
    for (const row of dc.rows) {
      body.push(
        `<tr><td>${rich(L(row.haveZh, row.haveEn))}</td>` +
          `<td>${rich(L(row.routeZh, row.routeEn))}</td>` +
          `<td>${rich(L(row.whyZh, row.whyEn))}</td></tr>`,
      );
    }
    body.push(`</tbody></table>`);
    body.push(`<p class="note">${rich(L(dc.clearZh, dc.clearEn))}</p>`);
    body.push(`<p>${rich(L(dc.pointerZh, dc.pointerEn))}</p>`);
    body.push(`</section>`);
  }

  body.push(`<section class="toc">`);
  body.push(`<h2>${t.contents}</h2>`);
  body.push(`<table class="toc-table"><tbody>`);
  let lastPart = null;
  for (const j of manifest.journeys) {
    const part = j.id[0];
    if (part !== lastPart) {
      body.push(
        `<tr class="part"><td colspan="3">${esc(L(PARTS[part]?.zh, PARTS[part]?.en))}</td></tr>`,
      );
      lastPart = part;
    }
    body.push(
      `<tr><td class="tid">${esc(j.id)}</td><td>${esc(L(j.titleZh, j.titleEn))}</td><td class="tsteps">${j.steps.length} ${t.steps}</td></tr>`,
    );
  }
  body.push(`</tbody></table></section>`);

  lastPart = null;
  for (const j of manifest.journeys) {
    const part = j.id[0];
    if (part !== lastPart) {
      body.push(
        `<h2 class="part-heading">${esc(L(PARTS[part]?.zh, PARTS[part]?.en))}</h2>`,
      );
      lastPart = part;
    }
    body.push(renderJourney(j, lang));
  }

  // The check results belong in the document, not only in a terminal. A reader
  // should be able to tell which claims about this handbook were actually
  // tested, and which are just prose.
  const checks = runChecks();
  const checkSummary = summarise(checks);
  body.push(`<section class="checkpage">`);
  body.push(`<h2>${esc(t.checksHeading)}</h2>`);
  body.push(`<p class="note">${esc(t.checksIntro)}</p>`);
  body.push(
    `<p class="checknum">${checkSummary.passed} / ${checkSummary.total} ${esc(t.checksPass)}` +
      ` · ${checks.journeys} ${esc(t.journey)} · ${checks.steps} ${esc(t.steps)}</p>`,
  );
  body.push(`<table class="checktable"><tbody>`);
  for (const r of checks.results) {
    body.push(
      `<tr><td class="cid">${esc(r.id)}</td><td>${esc(L(r.titleZh, r.titleEn))}</td>` +
        `<td class="cpass ${r.pass ? "ok" : "bad"}">${r.pass ? "PASS" : "FAIL"}</td></tr>`,
    );
    for (const f of r.failures) {
      body.push(
        `<tr class="cfail"><td></td><td colspan="2">${esc(f)}</td></tr>`,
      );
    }
  }
  body.push(`</tbody></table>`);
  body.push(`<p class="note">${esc(t.checksUnverified)}</p>`);
  body.push(`</section>`);

  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-Hant" : "en"}"><head><meta charset="utf-8">
<title>${esc(t.title)} — ${esc(t.subtitle)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "PingFang TC", "PingFang HK", "Noto Sans CJK TC",
                 "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.62; color: #1c1c1e;
  }
  h1, h2, h3 { line-height: 1.3; }
  .cover { height: 250mm; display: flex; align-items: center; page-break-after: always; }
  .cover-inner { width: 100%; border-left: 6px solid #6d28d9; padding-left: 12mm; }
  .kicker { color: #6b7280; font-size: 10pt; margin: 0 0 4mm; }
  .cover h1 { font-size: 30pt; margin: 0 0 3mm; }
  .cover .sub { font-size: 15pt; color: #6d28d9; margin: 0 0 8mm; }
  .cover-meta { color: #4b5563; font-size: 10.5pt; }

  .front, .toc { page-break-after: always; }
  .front h2, .toc h2 { font-size: 14pt; margin: 8mm 0 3mm; border-bottom: 1px solid #e5e7eb; padding-bottom: 2mm; }
  .front h2:first-child { margin-top: 0; }
  .front ul { margin: 0 0 2mm; padding-left: 5mm; }
  .front li { margin-bottom: 1.5mm; }

  .deskchoice { page-break-after: always; }
  .deskchoice h2 {
    font-size: 15pt; color: #6d28d9; margin: 0 0 4mm;
    border-bottom: 1px solid #e5e7eb; padding-bottom: 2mm;
  }
  .deskchoice .rule { font-size: 11.5pt; font-weight: 600; margin: 4mm 0; }
  .deskchoice .routetable { width: 100%; border-collapse: collapse; margin: 0 0 4mm; }
  .deskchoice .routetable th {
    text-align: left; font-weight: 700; color: #4b5563;
    padding: 1.8mm 2mm; border-bottom: 1.5px solid #d1d5db;
  }
  .deskchoice .routetable td {
    padding: 1.8mm 2mm; border-bottom: 1px solid #f0f0f2; vertical-align: top;
  }
  .deskchoice .routetable td:first-child { width: 44mm; }
  /* The only code spans here are repository paths. Breaking one mid-token
     across three lines makes it unreadable and un-copyable, so keep it whole
     and let it wrap as a single unit. */
  .deskchoice code { white-space: nowrap; }

  .toc-table { width: 100%; border-collapse: collapse; }
  .toc-table td { padding: 1.6mm 2mm; border-bottom: 1px solid #f0f0f2; vertical-align: top; }
  .toc-table .part td { border: 0; padding-top: 5mm; font-weight: 700; color: #6d28d9; }
  .toc-table .tid { width: 14mm; font-weight: 700; }
  .toc-table .tsteps { width: 22mm; text-align: right; color: #6b7280; }

  .part-heading {
    font-size: 15pt; color: #6d28d9; margin: 0 0 6mm;
    border-bottom: 2px solid #ede9fe; padding-bottom: 3mm;
  }
  .journey { page-break-before: always; }
  .journey h2 { font-size: 16pt; margin: 0 0 4mm; }
  .journey .jid { color: #6d28d9; }
  .facts { width: 100%; border-collapse: collapse; margin-bottom: 7mm; }
  .facts th {
    text-align: left; width: 30mm; font-weight: 600; color: #4b5563;
    vertical-align: top; padding: 1.4mm 3mm 1.4mm 0;
  }
  .facts td { padding: 1.4mm 0; vertical-align: top; }
  .facts tr { border-bottom: 1px solid #f0f0f2; }

  .step { page-break-inside: avoid; margin-bottom: 9mm; }
  .step:last-child { margin-bottom: 0; }
  .step h3 { font-size: 11.5pt; margin: 0 0 2mm; }
  .step .sid {
    display: inline-block; min-width: 13mm; color: #6d28d9; font-weight: 700;
  }
  .step .see { margin: 0 0 3mm; color: #374151; }
  .step figure { margin: 0 0 3mm; text-align: center; }
  .step img {
    width: 62mm; border: 1px solid #d1d5db; border-radius: 3mm; display: inline-block;
  }
  /* Match the callout legend to the picture width so the numbers sit beside the
     image they refer to, instead of stranded at the page margin. */
  .callouts { width: 62mm; margin: 0 auto; border-collapse: collapse; }
  .callouts th {
    width: 9mm; text-align: left; color: #d81b60; font-weight: 700;
    padding: 1mm 2mm 1mm 0; vertical-align: top;
  }
  .callouts td { padding: 1mm 0; vertical-align: top; }
  .note {
    background: #faf5ff; border-left: 3px solid #6d28d9;
    padding: 2.5mm 3mm; margin: 3mm 0 0; font-size: 9.5pt; color: #4b5563;
  }

  .checkpage { page-break-before: always; }
  .checkpage h2 { font-size: 15pt; color: #6d28d9; margin: 0 0 4mm; }
  .checknum { font-weight: 700; margin: 4mm 0; }
  .checktable { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  .checktable td { padding: 1.8mm 2mm; border-bottom: 1px solid #f0f0f2; vertical-align: top; }
  .checktable .cid { width: 12mm; font-weight: 700; color: #6d28d9; }
  .checktable .cpass { width: 16mm; text-align: right; font-weight: 700; }
  .checktable .cpass.ok { color: #047857; }
  .checktable .cpass.bad { color: #b91c1c; }
  .checktable .cfail td { color: #b91c1c; font-size: 9.5pt; border-bottom: 0; padding-top: 0; }
</style></head>
<body>
${body.join("\n")}
</body></html>`;
}

async function main() {
  fs.mkdirSync(DIST, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  const results = [];

  for (const lang of ["zh", "en"]) {
    const htmlPath = path.join(DIST, `handbook-${lang}.html`);
    fs.writeFileSync(htmlPath, buildHtml(lang));

    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    // Every screenshot must be decoded before printing, or pages come out blank.
    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.getAttribute("src")),
    );
    if (broken.length)
      throw new Error(
        `${lang}: ${broken.length} image(s) failed to load, e.g. ${broken[0]}`,
      );

    const pdfPath = path.join(DIST, `handbook-${lang}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="width:100%;font-size:8pt;color:#9ca3af;
          padding:0 15mm;font-family:-apple-system,'PingFang TC',Arial,sans-serif;
          display:flex;justify-content:space-between;">
          <span>${T[lang].title} — ${T[lang].subtitle}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
    });

    const bytes = fs.statSync(pdfPath).size;
    results.push({ lang, html: htmlPath, pdf: pdfPath, bytes });
    console.log(
      `${lang}: ${(bytes / 1024 / 1024).toFixed(2)} MB -> ${path.basename(pdfPath)}`,
    );
  }

  await browser.close();
  fs.writeFileSync(
    path.join(DIST, "build-report.json"),
    `${JSON.stringify({ builtAt: new Date().toISOString(), results }, null, 2)}\n`,
  );
  console.log(`\nwrote ${results.length} PDFs to docs/handbook/output/`);
}

main().catch((error) => {
  console.error("build-handbook failed:", error.message);
  process.exit(1);
});
