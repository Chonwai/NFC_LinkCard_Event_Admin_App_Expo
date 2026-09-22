/**
 * `F-02` 的行為鎖定：載入失敗必須是一個**看得見**的狀態，不能與「真的沒有活動」相同。
 *
 * 為什麼要有 runtime 半：`loadEvents()` 把失敗收進 `state.error` 而 `events`
 * 留在空陣列，所以「先判空、後判錯誤」會讓兩者顯示同一句話。那個**順序**是
 * 缺陷本身，也因此是可以被斷言的性質。
 *
 * static 半：`home.tsx` 是 .tsx，需要 React Native 才能 render，純 Node 載不進來
 * （同 `count-display.test.mjs` / `lookup-timeout.test.mjs` 的既有做法），
 * 因此改讀原始碼，確認畫面真的讀了 `error`、真的渲染了 `copy.home.loadFailed`，
 * 而不是只有一個沒有讀者的推導函式。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { getEventListPhase } = await import("@/utils/event-list-phase");
const { copy } = await import("@/constants/copy.zh-TW");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const homeSource = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/home.tsx"),
  "utf8",
);

test("F-02：載入失敗且清單為空 → error，不是 empty", () => {
  assert.equal(
    getEventListPhase({ loading: false, error: "boom", count: 0 }),
    "error",
  );
});

test("F-02：真的沒有活動（沒有錯誤）才顯示空狀態", () => {
  assert.equal(
    getEventListPhase({ loading: false, error: null, count: 0 }),
    "empty",
  );
});

test("F-02：載入中顯示 Skeleton，不打空狀態（既有凍結規則）", () => {
  assert.equal(
    getEventListPhase({ loading: true, error: null, count: 0 }),
    "loading",
  );
  // 重試途中（error 已由 store 清成 null、loading 為 true）也一樣。
  assert.equal(
    getEventListPhase({ loading: true, error: null, count: 0 }),
    "loading",
  );
});

test("F-02：重新整理失敗時舊清單仍然有效（count>0 → list）", () => {
  // 失敗由橫幅表達，不得把還有效的清單換成錯誤畫面。
  assert.equal(
    getEventListPhase({ loading: false, error: "boom", count: 2 }),
    "list",
  );
  assert.equal(
    getEventListPhase({ loading: true, error: "boom", count: 2 }),
    "list",
  );
});

test("四態互斥且涵蓋所有輸入組合", () => {
  for (const loading of [false, true]) {
    for (const error of [null, "boom"]) {
      for (const count of [0, 1, 7]) {
        const phase = getEventListPhase({ loading, error, count });
        assert.ok(
          ["loading", "error", "empty", "list"].includes(phase),
          `${phase} 不是合法階段`,
        );
        if (count > 0) assert.equal(phase, "list");
      }
    }
  }
});

test("失敗與空的文案本來就是兩個字串（缺陷是畫面用錯，不是文案缺漏）", () => {
  assert.notEqual(copy.home.loadFailed, copy.home.emptyTitle);
  assert.ok(copy.home.loadFailed.length > 0);
  assert.ok(copy.home.emptyTitle.length > 0);
});

test("[static] home.tsx 讀 store 的 error，並用它決定階段", () => {
  assert.match(
    homeSource,
    /const \{ events, loading, loadEvents, error \} = useEventStore\(\)/,
    "畫面必須讀出 store 的 error（否則失敗態沒有來源）",
  );
  assert.match(
    homeSource,
    /const phase = getEventListPhase\(\{\s*loading,\s*error,\s*count: events\.length,?\s*\}\)/,
    "階段必須由 getEventListPhase 推導",
  );
});

test("[static] 載入失敗橫幅帶著 copy.home.loadFailed 與重試動作", () => {
  assert.match(
    homeSource,
    /message=\{copy\.home\.loadFailed\}/,
    "copy.home.loadFailed 必須真的被渲染（先前是不可能到達的死字串）",
  );
  assert.match(
    homeSource,
    /actionLabel=\{copy\.home\.retry\}/,
    "失敗橫幅必須提供重試動作",
  );
  assert.match(homeSource, /onAction=\{retry\}/, "重試動作必須接上 retry");
});

test("[static] 空狀態只由 phase === 'empty' 觸發，不再以『清單為空』代替", () => {
  assert.match(homeSource, /phase === "empty" \?/);
  assert.doesNotMatch(
    homeSource,
    /events\.length === 0 \?/,
    "不得再用「清單為空」直接決定顯示，否則失敗與空集合又會合流",
  );
  assert.match(
    homeSource,
    /title=\{copy\.home\.emptyTitle\}/,
    "空狀態仍使用原本的空狀態文案",
  );
});
