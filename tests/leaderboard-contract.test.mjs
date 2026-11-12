/**
 * 排行榜的**呼叫契約鎖 ＋ 渲染禁令掃描**。
 *
 * ## 三件這一支才驗得到的事
 *
 * 1. **地址與守備範圍**：`leaderboard.service.ts` 的呼叫形狀恰好是
 *    `GET` ＋ `/:eventId/taps/leaderboard`，而且這條路徑**真的存在**於
 *    `scripts/backend-routes.snapshot.json`。
 *
 *    這一條特別重要，因為設計文件 §7.1 寫的路徑是
 *    `/api/v1/events/:eventId/leaderboard`，後端實作卻是
 *    `/taps/leaderboard`。兩者都沒有編譯錯誤——只有拿後端路由快照比對才分得出。
 *
 * 2. **`rank: null` 不得被直接渲染**：畫面檔裡不准出現 `{row.rank}` 或
 *    `{entry.rank}`。這是設計 §8.3 點名的頭號實作陷阱——RN 會把 `null` 當成
 *    「不畫」，於是那格就是**空白**，而且沒有任何錯誤訊息。
 *
 * 3. **進入點只有一個**：`_layout.tsx` 恰好註冊一次 `leaderboard`，
 *    `overview.tsx` 恰好有一個 `route: "leaderboard"` 的快速動作
 *    （設計 §8.1 明訂單一方案）。
 *
 * 它刻意**不驗**渲染結果長什麼樣（那是 `tests/leaderboard-display.test.mjs`），
 * 也不驗參數怎麼組（那是 `tests/leaderboard-service.test.mjs`）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { describeAppCall, extractAppCalls, pathShape } =
  await import("../scripts/check-backend-contract.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const SNAPSHOT = JSON.parse(
  readFileSync(
    join(REPO_ROOT, "scripts", "backend-routes.snapshot.json"),
    "utf8",
  ),
);

const readSource = (relative) =>
  readFileSync(join(REPO_ROOT, relative), "utf8");

/**
 * 去掉註解、保留程式碼（含字串內容）。
 *
 * 為什麼需要：這幾條斷言是「畫面不得出現 `{row.rank}`」「不得引用 `subjectHash`」
 * 這類**禁令掃描**。本 repo 的說明註解本身就是用同樣的符號寫的（例如檔頭那句
 * 「這個檔案裡沒有 `{row.rank}`」），不先去掉註解就會把自己的說明當成違規。
 *
 * 字串內容保留：要禁用的東西若真的寫在字串裡（例如硬寫的 key），那是真的要抓。
 */
function stripComments(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === "*" && source[i + 1] === "/")
      ) {
        if (source[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      out += c;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          out += source[i] + (source[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += source[i];
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** 後端快照裡所有 events 路由的形狀鍵（`METHOD 路徑形狀`）。 */
const BACKEND_KEYS = new Set(
  SNAPSHOT.eventRoutes.map(
    (route) => `${route.method} ${pathShape(route.path).join("/")}`,
  ),
);

// ---------------------------------------------------------------------------
// 一、地址鎖
// ---------------------------------------------------------------------------

test("leaderboard.service.ts 恰好有一條呼叫，形狀是 GET */taps/leaderboard", () => {
  const calls = extractAppCalls().filter(
    (call) => call.file === "leaderboard.service.ts",
  );

  assert.equal(calls.length, 1, "一支 service 一條呼叫，多一條就是能力漂移");

  const described = describeAppCall(calls[0].raw);
  assert.ok(described != null, `${calls[0].raw} 的基底不在契約閘門守備範圍`);
  assert.equal(described.scope, "event", "必須在 /api/v1/events 之下");

  assert.equal(calls[0].method, "GET");
  assert.equal(pathShape(described.path).join("/"), "*/taps/leaderboard");
});

test("那條路徑真的存在於後端路由快照（設計文件寫的 /leaderboard 不算）", () => {
  assert.ok(
    BACKEND_KEYS.has("GET */taps/leaderboard"),
    "後端快照缺少 GET /:eventId/taps/leaderboard——請確認快照是否過期",
  );
  assert.ok(
    !BACKEND_KEYS.has("GET */leaderboard"),
    "後端沒有 /:eventId/leaderboard；若真的加了，設計文件與 App 都要重新對齊",
  );
});

test("查詢參數留在 axios 的 params，網址字面不得夾帶 `?`（否則閘門比對會錯位）", () => {
  const source = stripComments(
    readSource("src/services/leaderboard.service.ts"),
  );

  // 只找**呼叫用的模板字串**（含 `/api/v1/events/` 的那一行），不是註解裡的說明。
  const callLines = source
    .split("\n")
    .filter((line) => line.includes("/api/v1/events/"))
    .filter((line) => line.includes("taps/leaderboard"));

  assert.equal(callLines.length, 1, "應該恰好有一行呼叫用的路徑字面");
  assert.ok(
    !callLines[0].includes("?"),
    "路徑字面不得含查詢字串，改走 { params } 讓閘門抽到乾淨的路徑",
  );

  const full = readSource("src/services/leaderboard.service.ts");
  assert.ok(full.includes("{ params: toQueryParams(query) }"));
});

// ---------------------------------------------------------------------------
// 二、渲染禁令：`rank: null`
// ---------------------------------------------------------------------------

const SCREEN = readSource("src/app/(auth)/[eventId]/leaderboard.tsx");
const DISPLAY = readSource("src/utils/leaderboard-display.ts");

test("畫面檔不得直接渲染 rank（只能走 rankLabel）", () => {
  const code = stripComments(SCREEN);
  const offenders = [
    "{row.rank}",
    "{entry.rank}",
    "{item.rank}",
    "String(row.rank)",
    "String(entry.rank)",
  ].filter((pattern) => code.includes(pattern));

  assert.deepEqual(
    offenders,
    [],
    "`rank` 為 null 時直接渲染會得到空白（RN 把 null 當成不畫）",
  );
  assert.ok(code.includes("{row.rankLabel}"), "名次必須經由 rankLabel");
});

test("名次文字只有一個產生點：`rankBadgeLabel(null)` 回 `—`", () => {
  assert.ok(
    DISPLAY.includes(
      "if (rank === null) return copy.leaderboard.rankPlaceholder",
    ),
  );
  assert.ok(
    DISPLAY.includes("copy.leaderboard.rankPlaceholder"),
    "placeholder 必須來自 copy（U+2014），不得在畫面硬寫 hyphen",
  );
});

test("below-threshold 的分流不得用 sampleQuality 或 uv 反推", () => {
  // 唯一允許的判準是 `entry.rank === null`。
  assert.ok(DISPLAY.includes("return entry.rank === null;"));

  const offenders = [
    'sampleQuality === "accumulating" && entry.rank',
    "uniqueVisitors === 0 &&",
  ].filter((pattern) => DISPLAY.includes(pattern));
  assert.deepEqual(offenders, []);
});

test("below-threshold 列不得使用 danger 色票（低於門檻不是錯誤）", () => {
  // 只降透明度；顏色 token 不得出現 danger 家族。
  assert.ok(SCREEN.includes("rowBelowThreshold: { opacity: 0.85 }"));
  assert.ok(!SCREEN.includes("semantic.status.danger"));
  assert.ok(!SCREEN.includes("semantic.text.danger"));
});

// ---------------------------------------------------------------------------
// 二之二、身分口徑：三選一（CR-20261112-01）
// ---------------------------------------------------------------------------

test("chip 上的身分口徑恰好三個：預設、展商、全部", () => {
  const code = stripComments(SCREEN);

  assert.ok(
    code.includes(
      'const SCOPE_OPTIONS = ["attendees", "exhibitors", "all"] as const;',
    ),
    "chip 選項順序＝預設、展商、全部",
  );
});

test("口徑標籤走 3 鍵 Record，不得退回二選一三元", () => {
  const code = stripComments(SCREEN);

  assert.ok(code.includes("const SCOPE_LABELS: Record<ScopeValue, string>"));
  assert.ok(code.includes("labelFor={(value) => SCOPE_LABELS[value]}"));
  assert.ok(
    !code.includes('value === "attendees"'),
    "三元鏈會把第三個口徑的標籤吞掉，改用 Record",
  );
  assert.ok(code.includes("copy.leaderboard.scopeExhibitors"));
});

test("畫面只從 buildLeaderboardQuery 取查詢；展商空狀態走專屬文案", () => {
  // 口徑→參數的語意由 `tests/leaderboard-display.test.mjs` 的表格測試釘住，
  // 這裡只驗接線：畫面不得自己再寫一份映射或 query 例外。
  const code = stripComments(SCREEN);

  assert.ok(
    code.includes("buildLeaderboardQuery(scope)"),
    "查詢必須走純函式，不能在畫面重複寫口徑規則",
  );
  assert.ok(
    !code.includes("REGISTRANT_TYPES"),
    "口徑→參數映射只能有一個真相來源（display 層）",
  );
  assert.ok(
    code.includes(
      "methodologyNotes(response.methodology.registrantTypesIncluded)",
    ),
    "排除句必須由後端實際套用的口徑推導，不是 chip 的請求意圖",
  );
  assert.ok(
    code.includes("copy.leaderboard.emptyNoCohortExhibitors"),
    "展商口徑的 cohort=0 空狀態不得說「本活動尚無可列入排名的參加者」",
  );
  assert.ok(
    code.includes("copy.leaderboard.emptyBelowThresholdExhibitors"),
    "展商口徑的 below-threshold 空狀態不得把展商叫成「參加者」",
  );
});

// ---------------------------------------------------------------------------
// 三、進入點與路由
// ---------------------------------------------------------------------------

test("_layout.tsx 恰好註冊一次 leaderboard 路由", () => {
  const layout = readSource("src/app/(auth)/[eventId]/_layout.tsx");
  const matches = layout.match(/<Stack\.Screen name="leaderboard" \/>/g) ?? [];

  assert.equal(matches.length, 1);
});

test("overview 的快速動作恰好有一個 leaderboard 入口（單一方案）", () => {
  const overview = readSource("src/app/(auth)/[eventId]/overview.tsx");
  const matches = overview.match(/route: "leaderboard"/g) ?? [];

  assert.equal(matches.length, 1, "設計 §8.1 明訂單一進入點");
  assert.ok(overview.includes("label: copy.leaderboard.title"));
});

test("overview 的 EventRoute union 已納入 leaderboard（否則 router.push 沒有型別保護）", () => {
  const overview = readSource("src/app/(auth)/[eventId]/overview.tsx");
  assert.ok(overview.includes('| "leaderboard"'));
});

// ---------------------------------------------------------------------------
// 四、不顯示敏感欄位
// ---------------------------------------------------------------------------

test("畫面與純邏輯都不得引用 subjectHash／ipPrefix／uaHash", () => {
  const screenCode = stripComments(SCREEN);
  const displayCode = stripComments(DISPLAY);

  for (const banned of ["subjectHash", "ipPrefix", "uaHash"]) {
    assert.ok(!screenCode.includes(banned), `畫面引用了 ${banned}`);
    assert.ok(!displayCode.includes(banned), `顯示層引用了 ${banned}`);
  }
});

test("excluded 的 email 不會被渲染（型別保留、UI 不讀）", () => {
  assert.ok(!stripComments(SCREEN).includes(".email"), "畫面不得讀 email");
  assert.ok(
    !stripComments(DISPLAY).includes("item.email"),
    "顯示層不得把 email 帶進可渲染的列",
  );
});

// ---------------------------------------------------------------------------
// 四之二、次指標的標籤必須黏著自己的數字（L-05）
// ---------------------------------------------------------------------------

/**
 * 舊版把 `聯絡` 放在「訪客數」與「聯絡數」兩個數字之間，於是它讀起來像在標註
 * **上面那個**數字（訪客）。兩個指標的去重單位不同（設計 §2.5 明文不得合成一個
 * 「互動數」），貼錯標籤等於讓主辦方用錯的口徑解釋名次。
 *
 * 這條斷言要求：`columnLeads` 與 `row.leadsCaptured` 必須在**同一個**
 * `metricSecondaryLine` 容器裡，且標籤不得出現在該容器之外。
 */
test("次指標標籤與次指標數字綁在同一個容器裡", () => {
  const screenCode = stripComments(SCREEN);

  const open = screenCode.indexOf("<View style={styles.metricSecondaryLine}>");
  assert.ok(open > -1, "缺少 metricSecondaryLine 容器");

  const close = screenCode.indexOf("</View>", open);
  assert.ok(close > open, "metricSecondaryLine 容器沒有閉合");

  const group = screenCode.slice(open, close + "</View>".length);
  assert.ok(
    group.includes("copy.leaderboard.columnLeads"),
    "標籤不在次指標容器內 ⇒ 會退回「夾在兩數字中間」的舊排版",
  );
  assert.ok(
    group.includes("row.leadsCaptured"),
    "次指標數字不在同一個容器內 ⇒ 標籤無法黏著自己的數字",
  );

  // 標籤不得另外出現在容器外（否則會出現兩個「聯絡」標籤）。
  const occurrences =
    screenCode.split("copy.leaderboard.columnLeads").length - 1;
  assert.equal(occurrences, 1, "columnLeads 只允許出現在次指標容器內一次");
});

// ---------------------------------------------------------------------------
// 五、狀態矩陣的接線（布林都要真的接到元件上）
// ---------------------------------------------------------------------------

test("S1–S14 的每個旗標在畫面上都有消費者", () => {
  const required = [
    "screen.showSkeleton",
    "screen.refreshing",
    "screen.emptyKind",
    "screen.errorKind",
    "screen.staleTone",
    "screen.showTrackingDisabled",
    "screen.showAttributionNotice",
    "screen.showRiskFlagsInactive",
    "screen.showBelowThresholdSection",
    "screen.showExcludedSection",
    "screen.showSummary",
  ];

  const missing = required.filter((flag) => !SCREEN.includes(flag));
  assert.deepEqual(missing, [], `以下狀態旗標算了卻沒接到畫面：${missing}`);
});
