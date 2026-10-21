#!/usr/bin/env node
/**
 * Backend↔App 契約閘門（parity guard）。
 *
 * 為什麼需要它
 * ------------
 * 2026-10-22 的對等審計發現 App 一直在呼叫
 * `POST /registrations/checkin/override`——一條後端**從來沒有**的路由。
 * TypeScript 抓不到：`apiClient.post()` 的網址是字串，型別系統無從得知它是否存在。
 * 這種漂移只有在活動當天才會被發現，而且會被誤判成「後端壞了」。
 *
 * 這支腳本把「App 呼叫的每一條路徑」對照一份**已提交的後端路由快照**，
 * 任何不存在的方法／路徑組合都會讓 CI 失敗。
 *
 * 用法
 * ----
 *   node scripts/check-backend-contract.mjs
 *       驗證 src/services 的呼叫都在快照內。有違規 ⇒ exit 1。
 *
 *   node scripts/check-backend-contract.mjs --refresh --backend ../LinkCard_ExpressJS_Backend
 *       重新產生 scripts/backend-routes.snapshot.json（需要後端 repo 在旁邊）。
 *
 * 快照的誠實邊界（重要）
 * ----------------------
 * 快照是**某個 commit 的複本**，不會自動更新。它保證的是「App 的呼叫在
 * 宣稱的後端版本上存在」，不是「現在 production 存在」。
 * 因此：
 *   - 快照記錄 `commit` 與 `generatedAt`；
 *   - 後端改路徑時，重跑 `--refresh` 會讓 diff 出現在 code review 裡；
 *   - 這比「靠人記得」強，但**不能取代**真正的 OpenAPI 契約測試（見
 *     docs/analysis/adminapp-parity-20261022/05-industry-research.md）。
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..");
const SNAPSHOT_PATH = join(HERE, "backend-routes.snapshot.json");

/**
 * 後端 events 路由檔 → 它被掛載的前綴。
 *
 * 來源：`src/events/routes/index.ts`
 *   router.use('/:eventId/exhibitors', exhibitorRoutes)  …
 *   router.use('/', eventsRoutes)                        ← 掛在最後，前綴為空
 * 再由 `src/app.ts:218` 統一掛到 `/api/v1/events`。
 *
 * ⚠️ 若後端新增一個 router.use(...)，這裡必須同步加一行，否則新路由不會進快照。
 * 這個限制是刻意的：寧可少收，也不要猜錯前綴而產生假陽性。
 */
const EVENT_ROUTE_MOUNTS = {
  "exhibitors.routes.ts": "/:eventId/exhibitors",
  "connection-requests.routes.ts": "/:eventId/connection-requests",
  "registrations.routes.ts": "/:eventId/registrations",
  "event-ops.routes.ts": "/:eventId",
  "sessions-polls.routes.ts": "/:eventId",
  "engagement.routes.ts": "/:eventId",
  "premium.routes.ts": "/:eventId",
  "events.routes.ts": "",
};

/** `index.ts` 直接掛在 `/api/v1/events` 下的兩條（webhook / activation）。 */
const INDEX_ROUTE_FILE = "index.ts";

const ROUTE_CALL = /router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/g;

/**
 * App 用到、但不在 `/api/v1/events` 之下的端點。
 *
 * 這些不能靠 events 路由表驗證，所以逐條記錄「證據位置」，
 * `--refresh` 會實際去讀那些檔案確認還存在。找不到就讓 refresh 失敗——
 * 不允許快照裡躺著一條沒人驗證過的端點。
 */
const NON_EVENT_ROUTES = [
  {
    method: "POST",
    path: "/api/auth/login",
    evidence: { file: "src/routes/auth.ts", needle: "router.post('/login'" },
  },
  {
    method: "GET",
    path: "/api/users/me",
    evidence: { file: "src/routes/users.ts", needle: "router.get('/me'" },
  },
];

// ---------------------------------------------------------------------------
// 共用：路徑正規化與比對
// ---------------------------------------------------------------------------

/**
 * 把一個實際的（或模板字串的）路徑收斂成「形狀」。
 *
 * `/api/v1/events/${id}/nfc/lookup?uid=x` → ['*','nfc','lookup']
 * `/:eventId/nfc/lookup`                  → ['*','nfc','lookup']
 *
 * 參數一律視為 `*`，因為參數名稱在兩邊本來就可以不同
 * （App 叫 eventId，後端叫 :eventId，某些地方叫 :id）。
 */
export function pathShape(path) {
  const withoutQuery = String(path).split("?")[0].split("#")[0];
  const normalised = withoutQuery
    .replace(/\$\{[^}]*\}/g, ":param")
    .replace(/\/+/g, "/");
  return normalised
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => (segment.startsWith(":") ? "*" : segment));
}

function shapeKey(method, path) {
  return `${String(method).toUpperCase()} ${pathShape(path).join("/")}`;
}

// ---------------------------------------------------------------------------
// 後端：抽路由
// ---------------------------------------------------------------------------

/** 從 `src/events/routes/*.ts` 抽出所有 (method, 完整路徑)。 */
export function extractBackendEventRoutes(backendRoot) {
  const routesDir = join(backendRoot, "src", "events", "routes");
  const routes = [];

  for (const [file, mount] of Object.entries(EVENT_ROUTE_MOUNTS)) {
    const full = join(routesDir, file);
    if (!existsSync(full)) continue;
    const source = readFileSync(full, "utf8");
    for (const match of source.matchAll(ROUTE_CALL)) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const joined = `${mount}${routePath === "/" ? "/" : routePath}`;
      routes.push({
        method,
        path: normaliseRoutePath(joined),
        file,
      });
    }
  }

  const indexFile = join(routesDir, INDEX_ROUTE_FILE);
  if (existsSync(indexFile)) {
    const source = readFileSync(indexFile, "utf8");
    for (const match of source.matchAll(ROUTE_CALL)) {
      routes.push({
        method: match[1].toUpperCase(),
        path: normaliseRoutePath(match[2]),
        file: INDEX_ROUTE_FILE,
      });
    }
  }

  // 同一 (method, path) 可能因為不同 middleware 鏈而註冊多次；存在性只需一筆。
  const seen = new Set();
  return routes
    .filter((route) => {
      const key = `${route.method} ${route.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
    );
}

function normaliseRoutePath(path) {
  const collapsed = String(path).replace(/\/+/g, "/");
  const trimmed =
    collapsed.length > 1 ? collapsed.replace(/\/$/, "") : collapsed;
  return trimmed.length === 0 ? "/" : trimmed;
}

/** 逐條確認 NON_EVENT_ROUTES 的證據還在。回傳缺少的項目。 */
export function verifyNonEventRoutes(backendRoot) {
  const missing = [];
  for (const route of NON_EVENT_ROUTES) {
    const full = join(backendRoot, route.evidence.file);
    if (!existsSync(full)) {
      missing.push({ ...route, reason: `missing file ${route.evidence.file}` });
      continue;
    }
    const source = readFileSync(full, "utf8");
    if (!source.includes(route.evidence.needle)) {
      missing.push({ ...route, reason: `missing "${route.evidence.needle}"` });
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// App：抽呼叫
// ---------------------------------------------------------------------------

const CLIENT_CALL = /apiClient\.(get|post|patch|put|delete)\b/g;
const FIRST_LITERAL = /`([^`]+)`|"([^"]+)"|'([^']+)'/;

/**
 * 從 `src/services/*.ts` 抽出所有 `apiClient.<verb>( ... )` 的第一個字串參數。
 *
 * 不用單一 regex 的原因：泛型會跨行且含 `{}`／`<>`，
 *   apiClient.get<
 *     ApiResponse<{ registration: Registration }>
 *   >(`/api/...`)
 * 一個 regex 很難在不誤吞的情況下吃到那個反引號。改成兩步：
 * 先定位動詞，再往後找第一個字串字面。
 */
export function extractAppCalls(appRoot = APP_ROOT) {
  const servicesDir = join(appRoot, "src", "services");
  const calls = [];

  for (const file of readdirSync(servicesDir).sort()) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(join(servicesDir, file), "utf8");
    for (const match of source.matchAll(CLIENT_CALL)) {
      const after = source.slice(match.index, match.index + 900);
      const literal = FIRST_LITERAL.exec(after);
      if (!literal) continue;
      const raw = literal[1] ?? literal[2] ?? literal[3];
      calls.push({
        method: match[1].toUpperCase(),
        raw,
        file,
        line: source.slice(0, match.index).split("\n").length,
      });
    }
  }
  return calls;
}

/**
 * 把 App 的呼叫字串轉成可與後端比對的鍵。
 *
 * 回傳 `{ scope: 'event', path }` 或 `{ scope: 'non-event', path }`；
 * 不認得的基底（例如打去別人的服務）回 `null` 並由呼叫端報錯，
 * 因為那代表這支閘門守不到它。
 */
export function describeAppCall(raw) {
  const withoutQuery = String(raw).split("?")[0];
  const collapsed = withoutQuery
    .replace(/\$\{[^}]*\}/g, ":param")
    .replace(/\/+/g, "/");

  if (collapsed.startsWith("/api/v1/events")) {
    const rest = collapsed.slice("/api/v1/events".length);
    return { scope: "event", path: normaliseRoutePath(rest || "/") };
  }
  if (collapsed.startsWith("/api/")) {
    return { scope: "non-event", path: normaliseRoutePath(collapsed) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

/**
 * @returns {{violations: Array, unknownBase: Array, checked: number}}
 */
export function checkContract(
  appRoot = APP_ROOT,
  snapshotPath = SNAPSHOT_PATH,
) {
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const eventKeys = new Set(
    snapshot.eventRoutes.map((r) => shapeKey(r.method, r.path)),
  );
  const nonEventKeys = new Set(
    snapshot.nonEventRoutes.map((r) => shapeKey(r.method, r.path)),
  );

  const calls = extractAppCalls(appRoot);
  const violations = [];
  const unknownBase = [];
  let checked = 0;

  for (const call of calls) {
    const described = describeAppCall(call.raw);
    if (!described) {
      unknownBase.push(call);
      continue;
    }
    checked += 1;
    const key = shapeKey(call.method, described.path);
    const pool = described.scope === "event" ? eventKeys : nonEventKeys;
    if (!pool.has(key)) {
      violations.push({ ...call, key });
    }
  }

  return { violations, unknownBase, checked };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function refresh(backendRoot) {
  if (!backendRoot) {
    console.error(
      "--refresh 需要 --backend <path-to-LinkCard_ExpressJS_Backend>",
    );
    process.exit(2);
  }
  const missing = verifyNonEventRoutes(backendRoot);
  if (missing.length > 0) {
    console.error("非 events 端點的證據已失效，請先更新 NON_EVENT_ROUTES：");
    for (const item of missing)
      console.error(`  - ${item.method} ${item.path}: ${item.reason}`);
    process.exit(2);
  }

  const eventRoutes = extractBackendEventRoutes(backendRoot);
  const commit = readBackendCommit(backendRoot);
  const snapshot = {
    _comment:
      "由 scripts/check-backend-contract.mjs --refresh 產生。不要手改；改後端就重跑。",
    generatedFrom: {
      repo: "LinkCard_ExpressJS_Backend",
      commit,
      generatedAt: new Date().toISOString(),
    },
    eventRoutes,
    nonEventRoutes: NON_EVENT_ROUTES.map(({ method, path, evidence }) => ({
      method,
      path,
      evidence,
    })),
  };
  writeFileSync(
    SNAPSHOT_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `已寫入 ${basename(SNAPSHOT_PATH)}：${eventRoutes.length} 條 events 路由（後端 ${commit ?? "unknown"}）`,
  );
}

function readBackendCommit(backendRoot) {
  try {
    const head = readFileSync(join(backendRoot, ".git", "HEAD"), "utf8").trim();
    if (head.startsWith("ref: ")) {
      const ref = head.slice("ref: ".length);
      return readFileSync(join(backendRoot, ".git", ref), "utf8")
        .trim()
        .slice(0, 7);
    }
    return head.slice(0, 7);
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--refresh")) {
    const index = args.indexOf("--backend");
    refresh(index >= 0 ? args[index + 1] : null);
    return;
  }

  const { violations, unknownBase, checked } = checkContract();
  if (unknownBase.length > 0) {
    console.error(
      "以下呼叫的基底不在本閘門的守備範圍（請擴充 describeAppCall）：",
    );
    for (const call of unknownBase) {
      console.error(`  - ${call.file}:${call.line} ${call.method} ${call.raw}`);
    }
    process.exit(2);
  }
  if (violations.length > 0) {
    console.error(`✗ ${violations.length} 條呼叫在後端路由快照中找不到：`);
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} ${v.method} ${v.raw}`);
      console.error(`    shape: ${v.key}`);
    }
    console.error(
      "若後端確實已新增，請重跑：node scripts/check-backend-contract.mjs --refresh --backend <後端路徑>",
    );
    process.exit(1);
  }
  console.log(`✓ ${checked} 條 App 呼叫全部對得上後端路由快照`);
}

if (process.argv[1] && process.argv[1].endsWith("check-backend-contract.mjs")) {
  main();
}
