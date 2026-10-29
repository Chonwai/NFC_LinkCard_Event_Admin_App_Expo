/**
 * 對等登記表閘門的行為鎖定。
 *
 * 為什麼要測一支「檢查文件的腳本」：一個永遠會過的檢查比沒有檢查更糟。
 * 2026-10-22 的獨立驗證就抓到過這種事——路由快照漏收 8 條巢狀路由，
 * 於是閘門會在未來對合法呼叫發出假陽性警告，然後被所有人忽略。
 *
 * 所以這裡除了正向（真實登記表要過），主要測**負向**：
 * 缺少理由、gapId 指到不存在的缺口、Web 出現未登記頁面、引用不存在的檔案、
 * P0 缺口沒有對應章節——每一種都必須讓腳本失敗。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SCRIPT = path.join(REPO_ROOT, "scripts", "check-parity-registry.mjs");
const REAL_REGISTRY = path.join(REPO_ROOT, "parity", "parity-registry.json");

const DOC_DIR = "docs/analysis/fixture-audit";

function baseRegistry(overrides = {}) {
  return {
    schemaVersion: 1,
    audit: { id: "fixture", docPath: DOC_DIR },
    webSurfaces: { repo: "web", scanRoots: ["app/(event)/manage"] },
    capabilities: [
      {
        id: "registrations",
        title: "名單",
        webPages: ["app/(event)/manage/[eventId]/registrations/page.tsx"],
        appFiles: ["src/app/(auth)/[eventId]/registrations.tsx"],
        verdict: "APP_GAP",
        gapId: "G-1",
        evidence: ["fixture evidence"],
      },
    ],
    appOnly: [],
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P1",
        owner: "product",
        size: "S",
        status: "open",
        fixedOn: [],
      },
    ],
    ...overrides,
  };
}

/**
 * 建一個最小的假 repo：腳本、登記表、文件、App 檔案、Web 頁面。
 * 腳本會以自己的位置推算 repo 根目錄，所以必須複製到 fixture 內。
 */
function makeFixture({ registry = baseRegistry(), webPages = [] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "parity-fixture-"));
  const webRoot = mkdtempSync(path.join(tmpdir(), "parity-web-"));

  mkdirSync(path.join(root, "scripts"), { recursive: true });
  copyFileSync(SCRIPT, path.join(root, "scripts", "check-parity-registry.mjs"));

  mkdirSync(path.join(root, "parity"), { recursive: true });
  writeFileSync(
    path.join(root, "parity", "parity-registry.json"),
    JSON.stringify(registry, null, 2),
  );

  mkdirSync(path.join(root, DOC_DIR), { recursive: true });
  writeFileSync(
    path.join(root, DOC_DIR, "04-gap-register.md"),
    "### G-1 缺口一\n\n說明。\n",
  );

  const appFile = path.join(root, "src/app/(auth)/[eventId]/registrations.tsx");
  mkdirSync(path.dirname(appFile), { recursive: true });
  writeFileSync(appFile, "export default function Screen() {}\n");

  for (const page of [
    "app/(event)/manage/[eventId]/registrations/page.tsx",
    ...webPages,
  ]) {
    const full = path.join(webRoot, page);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, "export default function Page() {}\n");
  }

  return { root, webRoot };
}

function run(root, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "check-parity-registry.mjs"), ...args],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * 找同層的 Web repo。
 *
 * 不能只寫 `resolve(REPO_ROOT, '..', repo)`：本 repo 常常在 worktree 裡作業
 * （`/tmp/…`），那時上層不是 LinkCard/。改用 git 的 common dir 反推真正的
 * 主 repo 位置，再取它的同層目錄。
 */
function findWebRoot(repo) {
  const candidates = [];
  if (process.env.PARITY_WEB_ROOT) candidates.push(process.env.PARITY_WEB_ROOT);
  candidates.push(path.resolve(REPO_ROOT, "..", repo));

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

test("fixture 的正向情況會通過", () => {
  const { root, webRoot } = makeFixture();
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /對等登記表一致/);
});

test("Web 不在旁邊時跳過而不是失敗，但 --require-web 會失敗", () => {
  const { root } = makeFixture();
  const skipped = run(root, ["--web", path.join(root, "no-such-dir")]);
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /SKIPPED/);

  const required = run(root, [
    "--web",
    path.join(root, "no-such-dir"),
    "--require-web",
  ]);
  assert.equal(required.status, 1);
  assert.match(required.stderr, /--require-web/);
});

test("BY_DESIGN 沒有理由時失敗", () => {
  const registry = baseRegistry({
    capabilities: [
      {
        id: "profile",
        title: "活動資料",
        webPages: ["app/(event)/manage/[eventId]/registrations/page.tsx"],
        appFiles: [],
        verdict: "BY_DESIGN",
        rationale: "太短",
        evidence: ["x"],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BY_DESIGN 必須有可反駁的 rationale/);
});

test("APP_GAP 指向不存在的缺口時失敗", () => {
  const registry = baseRegistry({
    capabilities: [
      {
        ...baseRegistry().capabilities[0],
        gapId: "G-999",
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /G-999 不在 gaps 清單/);
});

test("Web 出現未登記的頁面時失敗", () => {
  const { root, webRoot } = makeFixture({
    webPages: ["app/(event)/manage/[eventId]/polls/page.tsx"],
  });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /未登記的頁面/);
  assert.match(result.stderr, /polls\/page\.tsx/);
});

test("登記的 App 檔案不存在時失敗", () => {
  const registry = baseRegistry({
    capabilities: [
      {
        ...baseRegistry().capabilities[0],
        appFiles: ["src/app/(auth)/[eventId]/does-not-exist.tsx"],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /App 檔案不存在/);
});

test("P0 缺口沒有對應章節時失敗", () => {
  const registry = baseRegistry({
    capabilities: [],
    gaps: [
      {
        id: "G-7",
        title: "未寫進文件的缺口",
        severity: "P0",
        owner: "product",
        size: "S",
        status: "open",
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /G-7/);
});

/**
 * `ready-to-implement` 是第二個「已處置」的 status，所以它也必須有證據欄位。
 * 沒有這條檢查時，任何人一行編輯就能讓一個缺口從 §5.6 的判準清單上消失：
 * 無 commit、無決議、無任何可回溯的位置。
 */
test("ready-to-implement 沒有 decidedIn 時失敗", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P1",
        owner: "none-needed",
        size: "S",
        status: "ready-to-implement",
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ready-to-implement 但沒有記錄判定依據/);
});

/**
 * `fixed` 是「已修，且 commit 已在主線上」的正式值，它與 `fixed-on-branch`
 * 共用同一條證據要求：沒有 `fixedOn` 的「已修」無法回溯到底是哪一次提交修掉的。
 */
test("fixed 沒有 fixedOn 時失敗", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P1",
        owner: "none-needed",
        size: "S",
        status: "fixed",
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixed 但沒有記錄 commit/);
});

test("ready-to-implement 有 decidedIn 時通過", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P1",
        owner: "none-needed",
        size: "S",
        status: "ready-to-implement",
        decidedIn: `${DOC_DIR}/04-gap-register.md#G-1`,
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /對等登記表一致/);
});

/**
 * `by-design` 是「已決定永遠不做」。它是所有 status 裡最不可逆的一個：一旦用它
 * 結案，下一輪審計就不會再問同一個問題。所以它必須帶一個能回頭查的位置，
 * 否則一個缺口只會被安靜地從清單上刪掉，連「為什麼放棄」都不留。
 */
test("by-design 沒有 decidedIn 時失敗", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P2",
        owner: "product",
        size: "S",
        status: "by-design",
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /by-design 但沒有記錄判定依據/);
});

test("by-design 有 decidedIn 時通過", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P2",
        owner: "product",
        size: "S",
        status: "by-design",
        decidedIn: `${DOC_DIR}/04-gap-register.md#G-1`,
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /對等登記表一致/);
});

/**
 * `deferred` 是「這一階段不理會、日後可重評」——`by-design`（永遠不做）與
 * `ready-to-implement`（已排、待實作）之間那個空著的格子。
 *
 * 它比 `by-design` 更需要被鎖住：`by-design` 一旦誤用會讓缺口永久消失（至少有人
 * 會覺得怪），而 `deferred` 誤用只會讓缺口**合理地**從 §5.7 的判準清單上滑走——
 * 「先不做」聽起來永遠無害，於是沒有人會回頭看。所以這裡測的是同一條證據要求：
 * 沒有 `decidedIn` 的延後，與忘記沒有分別。
 */
test("deferred 沒有 decidedIn 時失敗", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P2",
        owner: "product",
        size: "S",
        status: "deferred",
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /deferred 但沒有記錄判定依據/);
});

test("deferred 有 decidedIn 時通過", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P2",
        owner: "product",
        size: "S",
        status: "deferred",
        decidedIn: `${DOC_DIR}/04-gap-register.md#G-1`,
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /對等登記表一致/);
});

/**
 * `decidedIn` 驗的是「指到的那個檔案還在不在」。
 *
 * 為什麼要單獨鎖這一條：`decidedIn` 是整個登記冊裡唯一證明「有人做過判定」的
 * 欄位，也正因為如此，它可以被寫成一句誰都反駁不了的空話。指到一個不存在的
 * 檔案時，判定看起來有依據，而那個依據打不開——這比留空更糟，因為留空至少
 * 會讓下一個人去問。
 */
test("decidedIn 指向不存在的檔案時失敗（gap）", () => {
  const registry = baseRegistry({
    gaps: [
      {
        id: "G-1",
        title: "缺口一",
        severity: "P2",
        owner: "product",
        size: "S",
        status: "deferred",
        decidedIn: `${DOC_DIR}/no-such-doc.md#G-1`,
        fixedOn: [],
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /decidedIn 指向不存在的檔案/);
});

test("decidedIn 指向不存在的檔案時失敗（capability）", () => {
  const registry = baseRegistry({
    capabilities: [
      {
        ...baseRegistry().capabilities[0],
        status: "ready-to-implement",
        decidedIn: `${DOC_DIR}/no-such-doc.md#11.3`,
      },
    ],
  });
  const { root, webRoot } = makeFixture({ registry });
  const result = run(root, ["--web", webRoot, "--require-web"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /registrations: decidedIn 指向不存在的檔案/);
});

test("真實登記表在當前 repo 上是一致的", (t) => {
  const registry = JSON.parse(readFileSync(REAL_REGISTRY, "utf8"));
  const webRoot = findWebRoot(registry.webSurfaces.repo);
  if (webRoot === null) {
    t.skip(`找不到 ${registry.webSurfaces.repo}（可用 PARITY_WEB_ROOT 指定）`);
    return;
  }
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--web", webRoot, "--require-web"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
