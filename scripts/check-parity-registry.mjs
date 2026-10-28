#!/usr/bin/env node
/**
 * 能力對等登記表的閘門（parity registry guard）。
 *
 * 為什麼需要它
 * ------------
 * 2026-10-22 有一份 4,300 行的對等審計，結論正確，六天後就有兩條判定過期：
 * Web 在報到桌補上了寫卡能力，但那份表仍然寫著「App 是超集」。
 *
 * 表格不會自己過期，是**世界變了而沒有人回頭改表**。所以這支腳本不檢查程式碼，
 * 它檢查「表格與世界是否還對得上」：
 *
 *   1. 登記表裡引用的每一個檔案都還存在（畫面被搬走、改名會被抓到）
 *   2. 每一個 BY_DESIGN 都有理由，每一個 APP_GAP 都有 gapId 與嚴重度
 *   3. Web 端出現一個沒有登記的頁面 ⇒ 失敗
 *      （這一條是核心：新增能力會強迫做出判定，而不是默默漂移）
 *   4. P0/P1 的缺口都必須在 04-gap-register.md 有對應章節
 *
 * 用法
 * ----
 *   node scripts/check-parity-registry.mjs
 *       檢查登記表自身的一致性與 App 側檔案；Web repo 不在旁邊時明確跳過。
 *
 *   node scripts/check-parity-registry.mjs --web ../LinkCard_Frontend --require-web
 *       CI（兩個 repo 都 checkout）用這個。Web repo 找不到時失敗而不是跳過。
 *
 *   node scripts/check-parity-registry.mjs --registry <path> --web <path>
 *       測試用：指定替代的登記表與 Web 根目錄。
 *
 * 誠實邊界
 * --------
 * 閘門證明的是「登記表與檔案系統一致」，不是「判定正確」。判定正確與否要靠
 * `docs/analysis/adminapp-parity-20261028/` 的證據與人的複核。一個會說謊的閘門
 * 比沒有閘門更糟，所以這裡只做機械可驗的事，並且在跳過時大聲說出來。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");

const VERDICTS = new Set([
  "ALIGNED",
  "ALIGNED_DEFECT",
  "APP_GAP",
  "BY_DESIGN",
  "APP_ONLY",
  "WEB_ONLY_INTERNAL",
]);

const SEVERITIES = new Set(["P0", "P1", "P2"]);

function parseArgs(argv) {
  const opts = {
    web: null,
    registry: join(APP_ROOT, "parity", "parity-registry.json"),
    requireWeb: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--web") opts.web = resolve(argv[(i += 1)]);
    else if (arg === "--registry") opts.registry = resolve(argv[(i += 1)]);
    else if (arg === "--require-web") opts.requireWeb = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 遞迴列出 dir 底下的檔案，回傳相對於 base 的 posix 路徑。 */
function walk(dir, base) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git")
      continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

function checkRegistry(registry, errors) {
  const capabilities = registry.capabilities ?? [];
  const appOnly = registry.appOnly ?? [];
  const gaps = registry.gaps ?? [];

  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    errors.push("registry.capabilities 不得為空");
  }

  const ids = new Set();
  for (const cap of capabilities) {
    if (!cap.id) errors.push("capability 缺少 id");
    else if (ids.has(cap.id)) errors.push(`capability id 重複：${cap.id}`);
    else ids.add(cap.id);

    if (!VERDICTS.has(cap.verdict)) {
      errors.push(`${cap.id}: verdict 不合法（${cap.verdict}）`);
    }
    if (!Array.isArray(cap.evidence) || cap.evidence.length === 0) {
      errors.push(`${cap.id}: 沒有 evidence，判定不算判定`);
    }
    if (cap.verdict === "BY_DESIGN") {
      if (
        typeof cap.rationale !== "string" ||
        cap.rationale.trim().length < 20
      ) {
        errors.push(`${cap.id}: BY_DESIGN 必須有可反駁的 rationale（≥20 字）`);
      }
    }
    if (cap.verdict === "APP_GAP") {
      if (!cap.gapId) errors.push(`${cap.id}: APP_GAP 必須有 gapId`);
      else if (!gaps.some((gap) => gap.id === cap.gapId)) {
        errors.push(`${cap.id}: gapId ${cap.gapId} 不在 gaps 清單`);
      }
    }
  }

  const gapIds = new Set();
  for (const gap of gaps) {
    if (!gap.id) errors.push("gap 缺少 id");
    else if (gapIds.has(gap.id)) errors.push(`gap id 重複：${gap.id}`);
    else gapIds.add(gap.id);

    if (!SEVERITIES.has(gap.severity)) {
      errors.push(`${gap.id}: severity 不合法（${gap.severity}）`);
    }
    if (!gap.owner) errors.push(`${gap.id}: 缺少 owner（誰決定）`);
    if (!gap.status) errors.push(`${gap.id}: 缺少 status`);
    if (gap.status === "fixed-on-branch" && (gap.fixedOn ?? []).length === 0) {
      errors.push(`${gap.id}: 標記 fixed-on-branch 但沒有記錄 commit`);
    }
  }

  for (const item of appOnly) {
    if (!item.id) errors.push("appOnly 缺少 id");
    if (!item.webCounterpart) {
      errors.push(`${item.id}: App 獨有能力必須說明 Web 的對照現況`);
    }
  }

  return { capabilities, appOnly, gaps };
}

function checkAppFiles(capabilities, appOnly, errors) {
  const groups = [
    ...capabilities.map((cap) => [cap.id, cap.appFiles ?? []]),
    ...appOnly.map((item) => [item.id, item.appFiles ?? []]),
  ];
  for (const [id, files] of groups) {
    for (const file of files) {
      if (!existsSync(join(APP_ROOT, file))) {
        errors.push(`${id}: 登記的 App 檔案不存在 → ${file}`);
      }
    }
  }
}

function checkDocs(registry, gaps, errors) {
  const docRoot = join(APP_ROOT, registry.audit?.docPath ?? "");
  if (!existsSync(docRoot)) {
    errors.push(`審計文件目錄不存在：${registry.audit?.docPath}`);
    return;
  }
  const registerPath = join(docRoot, "04-gap-register.md");
  if (!existsSync(registerPath)) {
    errors.push("缺少 04-gap-register.md");
    return;
  }
  const text = readFileSync(registerPath, "utf8");
  for (const gap of gaps) {
    if (gap.severity === "P2") continue;
    if (!new RegExp(`^###\\s+${gap.id}\\s`, "m").test(text)) {
      errors.push(
        `${gap.id}: ${gap.severity} 缺口必須在 04-gap-register.md 有獨立章節`,
      );
    }
  }
}

function checkWeb(registry, capabilities, opts, errors, notes) {
  const webRoot =
    opts.web ??
    resolve(APP_ROOT, "..", registry.webSurfaces?.repo ?? "LinkCard_Frontend");
  if (!existsSync(webRoot)) {
    const message = `Web repo 不在旁邊，跳過頁面掃描（${webRoot}）`;
    if (opts.requireWeb)
      errors.push(`${message}；--require-web 要求它必須存在`);
    else notes.push(`SKIPPED: ${message}`);
    return;
  }

  const registered = new Set();
  for (const cap of capabilities) {
    for (const page of cap.webPages ?? []) {
      registered.add(page);
      if (!existsSync(join(webRoot, page))) {
        errors.push(`${cap.id}: 登記的 Web 頁面不存在 → ${page}`);
      }
    }
  }

  const found = new Set();
  for (const root of registry.webSurfaces?.scanRoots ?? []) {
    const dir = join(webRoot, root);
    if (!existsSync(dir)) {
      errors.push(`掃描根目錄不存在 → ${root}`);
      continue;
    }
    for (const file of walk(dir, webRoot)) {
      if (file.endsWith("/page.tsx")) found.add(file);
    }
  }

  for (const page of found) {
    if (!registered.has(page)) {
      errors.push(
        `Web 有未登記的頁面 → ${page}；請在 parity-registry.json 補上判定`,
      );
    }
  }
  for (const page of registered) {
    if (
      found.size > 0 &&
      !found.has(page) &&
      !existsSync(join(webRoot, page))
    ) {
      errors.push(`登記的頁面不存在於掃描範圍 → ${page}`);
    }
  }

  notes.push(`Web 頁面掃描：${found.size} 個頁面，${registered.size} 個已登記`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const errors = [];
  const notes = [];

  if (!existsSync(opts.registry)) {
    console.error(`✗ 找不到登記表：${opts.registry}`);
    process.exit(1);
  }

  const registry = readJson(opts.registry);
  const { capabilities, appOnly, gaps } = checkRegistry(registry, errors);
  checkAppFiles(capabilities, appOnly, errors);
  checkDocs(registry, gaps, errors);
  checkWeb(registry, capabilities, opts, errors, notes);

  for (const note of notes) console.log(note);

  if (errors.length > 0) {
    console.error(`\n✗ 對等登記表有 ${errors.length} 個問題：`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const counts = capabilities.reduce((acc, cap) => {
    acc[cap.verdict] = (acc[cap.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([verdict, count]) => `${verdict}=${count}`)
    .join(" ");
  console.log(
    `✓ 對等登記表一致：${capabilities.length} 個能力（${summary}）、${gaps.length} 個缺口`,
  );
}

main();
