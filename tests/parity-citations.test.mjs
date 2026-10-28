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
 * 為什麼下限是一個固定值（原本是「兩個 sibling 都在 → 25，不在 → 15」）：
 * 環境感知的下限只是把「靠環境決定會不會紅」換成「靠運氣決定」——兩個分支各自
 * 貼著一個人工挑的數字，任一邊多寫一個引用、或少解析一個，就翻紅，而紅的訊息會
 * 指向引用，不會指向「門檻是人工挑的」。修好 repo 前綴之後，兩個環境的量測值都
 * 遠高於固定下限，所以不需要兩個分支。**實際值看下面 MEASURED 那行，不寫在這裡**
 * ——這裡寫的任何數字都是某一天的快照。
 *
 * 這個下限不是品質指標，是「比對器還活著」的偵測器（見檔尾的說明）。
 *
 * 量到的實際值不要寫進這個檔案：那是當天文件的快照，文件一改一加就不成立，
 * 而「把數字寫對」從來不是防線。要量就跑
 *   node --test tests/parity-citations.test.mjs
 * 看它**不論通過或失敗都印**的那一行：
 *   MEASURED checked=<n> skipped=<n> ambiguous=<n> floor=<n> problems=<n>
 * 「今天的值是多少」因此永遠有答案，不必去改門檻才問得出來。
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
  // 單一下限：不隨環境改變（理由見檔頭）。兩個環境的量測值都遠高於它，所以不必
  // 再分兩個分支。實際值看上面印出的 MEASURED 那行，不寫死在這裡。
  const floor = 20;

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

  // 不論通過或失敗都印一行。這是本檔唯一的「輸出介面」：文件不寫死數字，改成叫
  // 讀者來看這一行，所以它必須在最前面的 assert 之前印出來——assert 一拋，後面
  // 的程式碼就不會執行了。
  console.log(
    `MEASURED checked=${checked} skipped=${skipped} ambiguous=${ambiguous} floor=${floor} problems=${problems.length}`,
  );

  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
  // 這個下限不是品質指標，是「比對器還在動」的偵測器。
  // 實際 checked／skipped／ambiguous 一律看上面那行 MEASURED，不寫死在這裡。
  // 若哪天量到的數字掉到個位數，表示正則或解析規則壞了，而不是文件變乾淨了。
  assert.ok(
    checked >= floor,
    `只用 ${checked} 個引用做驗證，低於下限 ${floor}（解析成功 ${checked}、跳過 ${skipped}、無法唯一解析 ${ambiguous}）。這個下限不隨環境改變，也不是品質指標；掉到它以下表示解析規則壞了，不是文件變乾淨。兩個環境平常量到多少，看 MEASURED 那行，不寫死在這裡。本機在 ${WEB_REPO} 與 ${BACKEND_REPO} 都放在旁邊時跑 npm test，驗到的引用集最完整。`,
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
