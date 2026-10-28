/**
 * 引用座標的防腐測試。
 *
 * 為什麼需要它：2026-10-22 那一輪的獨立驗證，在 6 個抽驗點裡抓到 5 個對不上——
 * 因為同一天內既描述了問題、又修掉了問題，沒有標示哪個是修復前的快照。
 * 那份報告因此無法被任何人複驗。
 *
 * 這支測試只看兩件事，刻意不猜語意：
 *   1. 被引用的檔案存在
 *   2. 被引用的行號不超過該檔案的總行數
 *
 * 它證明不了「那一行在講這件事」，但能擋住最常見的腐爛：檔案被搬走、改名、
 * 或大幅縮短之後，引用還留著。
 *
 * 解析規則（無法確定時跳過，不假裝確定）：
 *   - `Repo@path` 絕對解析（App／Web／Backend 三個 repo 都支援）
 *   - 檔案頂端可宣告 `<!-- citations: Repo -->`，短路徑繼承它
 *   - 只有檔名 → 在兩個 repo 內建索引，唯一命中才算數
 *
 * 為什麼要有「檔案層級的預設 repo」：01 那一節整張表都是 Web 的檔案，
 * 每列都寫 `LinkCard_Frontend@…` 只會讓表格讀不下去。預設值要寫在檔案裡，
 * 不能靠讀者的記憶。
 *
 * 為什麼下限分兩種環境：可驗證的引用數量取決於「旁邊有幾個 repo」，不是取決於
 * 文件品質。本機三個 repo 並排時絕大多數引用都解析得到；CI 只 checkout 本 repo，
 * Web 與 Backend 的引用全部無從解析，只剩同 repo 那一批。同一條本機下限搬到 CI
 * 只是剛好擦過，文件任何微調都會讓它變成必紅。所以下限跟著環境走——兩個 sibling
 * 都在 → 25，不在 → 15（值寫在 `floor` 那一行）。缺哪一個都會印 `SKIPPED:`，
 * 不會靜靜地少驗。下限再低也不設成 0：同 repo 的引用在任何環境都必須驗得到。
 *
 * 量到的實際值不要寫進這個檔案：那是當天文件的快照，文件一改一加就不成立，
 * 而「把數字寫對」從來不是防線。要量就跑 `node --test tests/parity-citations.test.mjs`
 * 看輸出。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DOC_DIR = path.join(
  REPO_ROOT,
  "docs",
  "analysis",
  "adminapp-parity-20261028",
);
const WEB_REPO = "LinkCard_Frontend";
const BACKEND_REPO = "LinkCard_ExpressJS_Backend";
const APP_REPO = "LinkCard_Event_Admin_App_Expo";
const KNOWN_REPOS = [APP_REPO, WEB_REPO, BACKEND_REPO];

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".expo", "ios"]);

function listFiles(root, base = root, out = []) {
  for (const entry of readdirSync(root)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(root, entry);
    if (statSync(full).isDirectory()) listFiles(full, base, out);
    else out.push(full);
  }
  return out;
}

function findSiblingRepo(repo) {
  const candidates = [
    process.env.PARITY_WEB_ROOT,
    path.resolve(REPO_ROOT, "..", repo),
  ].filter(Boolean);

  const common = spawnSync(
    "git",
    [
      "-C",
      REPO_ROOT,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ],
    { encoding: "utf8" },
  );
  if (common.status === 0) {
    const mainRepo = path.dirname(common.stdout.trim());
    candidates.push(path.resolve(mainRepo, "..", repo));
  }
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
function lineCount(file) {
  const text = readFileSync(file, "utf8");
  return text.split("\n").length;
}

function buildBasenameIndex(root) {
  const index = new Map();
  for (const file of listFiles(root)) {
    const name = path.basename(file);
    const list = index.get(name) ?? [];
    list.push(file);
    index.set(name, list);
  }
  return index;
}

function resolve(target, { appRoot, roots, indexes, defaultRepo }) {
  const prefix = KNOWN_REPOS.find((repo) => target.startsWith(`${repo}@`));
  const repo = prefix ?? defaultRepo;

  if (prefix !== undefined) {
    const rel = target.slice(prefix.length + 1);
    const root = roots[repo];
    if (root === null) return { status: "skipped" };
    const full = path.join(root, rel);
    return existsSync(full)
      ? { status: "ok", full }
      : { status: "missing", rel };
  }

  if (target.includes("/")) {
    if (repo === null) return { status: "ambiguous", count: 0 };
    const root = roots[repo];
    if (root === null) return { status: "skipped" };
    const full = path.join(root, target);
    return existsSync(full)
      ? { status: "ok", full }
      : { status: "missing", rel: target };
  }

  const hits = indexes.flatMap((index) => index.get(target) ?? []);
  if (hits.length !== 1) return { status: "ambiguous", count: hits.length };
  return { status: "ok", full: hits[0] };
}

test("審計文件裡的每一個引用都能解析", () => {
  const appRoot = REPO_ROOT;
  const webRoot = findSiblingRepo(WEB_REPO);
  const backendRoot = findSiblingRepo(BACKEND_REPO);

  // 缺哪個 sibling 就講出來，不靜靜地少驗（與 check-parity-registry.mjs 同一種說法）。
  const missing = [
    [WEB_REPO, webRoot],
    [BACKEND_REPO, backendRoot],
  ]
    .filter(([, root]) => root === null)
    .map(([repo]) => repo);
  const siblingsPresent = missing.length === 0;
  for (const repo of missing) {
    console.log(
      `SKIPPED: 缺少 ${repo}，它的引用本次不驗（本 repo 的引用照驗）`,
    );
  }
  const floor = siblingsPresent ? 25 : 15;

  const roots = {
    [APP_REPO]: appRoot,
    [WEB_REPO]: webRoot,
    [BACKEND_REPO]: backendRoot,
  };
  const indexes = [appRoot, webRoot, backendRoot]
    .filter((root) => root !== null)
    .map((root) => buildBasenameIndex(root));

  const pattern =
    /([A-Za-z0-9_@()[\]{}\-./]+\.(?:tsx?|mjs|cjs|json)):(\d+)(?:-(\d+))?/g;
  const marker = /<!--\s*citations:\s*([A-Za-z0-9_]+)\s*-->/;

  const problems = [];
  let checked = 0;
  let skipped = 0;
  let ambiguous = 0;

  const docs = readdirSync(DOC_DIR).filter((name) => name.endsWith(".md"));
  assert.ok(docs.length > 0, "找不到審計文件");

  for (const name of docs) {
    const text = readFileSync(path.join(DOC_DIR, name), "utf8");
    const declared = text.match(marker)?.[1] ?? null;
    if (declared !== null && !KNOWN_REPOS.includes(declared)) {
      problems.push(`${name}: citations 標記指向未知的 repo → ${declared}`);
    }

    for (const match of text.matchAll(pattern)) {
      const [, target, fromRaw, toRaw] = match;
      if (target.startsWith("http") || target.startsWith("//")) continue;

      const resolved = resolve(target, {
        appRoot,
        roots,
        indexes,
        defaultRepo: KNOWN_REPOS.includes(declared) ? declared : null,
      });
      if (resolved.status === "skipped") {
        skipped += 1;
        continue;
      }
      if (resolved.status === "ambiguous") {
        ambiguous += 1;
        continue;
      }
      if (resolved.status === "missing") {
        problems.push(`${name}: 引用不存在的檔案 → ${target}`);
        continue;
      }

      const total = lineCount(resolved.full);
      const from = Number(fromRaw);
      const to = toRaw === undefined ? from : Number(toRaw);
      if (from > total || to > total) {
        problems.push(
          `${name}: ${target} 的行號 ${from}-${to} 超出檔案長度 ${total} 行`,
        );
        continue;
      }
      checked += 1;
    }
  }

  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
  // 這個下限不是品質指標，是「比對器還在動」的偵測器。
  // 下限隨環境走（25／15，見上方常數）；實際 checked／skipped／ambiguous 跑
  // `node --test tests/parity-citations.test.mjs` 看輸出，不寫死在這裡。
  // 若哪天量到的數字掉到個位數，表示正則或解析規則壞了，而不是文件變乾淨了。
  assert.ok(
    checked >= floor,
    siblingsPresent
      ? `兩個 sibling repo 都在的環境，只用 ${checked} 個引用做驗證，低於下限 ${floor}（解析成功 ${checked}、跳過 ${skipped}、無法唯一解析 ${ambiguous}）`
      : `只有本 repo 的環境（缺 ${missing.join("、")}），只用 ${checked} 個引用做驗證，低於單 repo 下限 ${floor}（解析成功 ${checked}、跳過 ${skipped}、無法唯一解析 ${ambiguous}）。本機應在 ${WEB_REPO} 與 ${BACKEND_REPO} 都放在旁邊時跑 npm test，才能驗到完整的引用集。`,
  );
  assert.ok(
    ambiguous <= 3,
    `${ambiguous} 個引用無法唯一解析，請在文件內補上目錄前綴`,
  );
  // 兩個 sibling 都在時，一個引用都不該被跳過；不在時 skipped 由上面的 SKIPPED 交代。
  if (siblingsPresent) {
    assert.equal(
      skipped,
      0,
      `兩個 sibling repo 都在，卻有 ${skipped} 個引用被跳過`,
    );
  }
});
