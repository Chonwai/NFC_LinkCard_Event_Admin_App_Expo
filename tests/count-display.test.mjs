/**
 * `NEW-D2-03` 的行為鎖定：「未知」與「零」必須顯示成不同東西。
 *
 * runtime 半：直接讀真正的轉換函式，確認 `null` / `undefined` 走破折號，
 * 而**真正的 0 仍然顯示 0**——這條是負向控制，避免「修好未知」變成
 * 「把所有零都吃掉」。
 *
 * static 半：`home.tsx` / `overview.tsx` 是 .tsx，需要 React Native 才能
 * render，純 Node 下載不進來（同 `lookup-timeout.test.mjs` 的既有做法）。
 * 因此改讀原始碼，確認呼叫端真的用了這個轉換，而不是只有一個沒有讀者的函式。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { formatCount, getCountUnavailableHint } =
  await import("@/utils/count-display");
const { copy } = await import("@/constants/copy.zh-TW");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readSource = (relative) =>
  readFileSync(path.join(REPO_ROOT, relative), "utf8");

test("未知的數量顯示破折號，不是 0", () => {
  assert.equal(formatCount(undefined), copy.event.dash);
  assert.equal(formatCount(null), copy.event.dash);
});

test("真正的 0 必須顯示 0（破折號不得吃掉真值）", () => {
  assert.equal(formatCount(0), "0");
  assert.notEqual(formatCount(0), copy.event.dash);
});

test("已知的正整數原樣顯示", () => {
  assert.equal(formatCount(1), "1");
  assert.equal(formatCount(128), "128");
});

test("[static] 活動列表的兩張計數卡都不再寫死 `?? 0`", () => {
  const source = readSource("src/app/(auth)/home.tsx");

  assert.match(
    source,
    /formatCount\(item\.registrationCount\)/,
    "報名人數必須走 formatCount",
  );
  assert.match(
    source,
    /formatCount\(item\.exhibitorCount\)/,
    "參展商必須走 formatCount",
  );
  assert.doesNotMatch(
    source,
    /registrationCount \?\? 0|exhibitorCount \?\? 0/,
    "不得再有把未知講成 0 的寫法",
  );
});

test("[static] 活動概覽的參展商卡走同一個轉換", () => {
  const source = readSource("src/app/(auth)/[eventId]/overview.tsx");

  assert.match(
    source,
    /formatCount\(event\?\.exhibitorCount\)/,
    "概覽的參展商卡必須與列表共用同一個轉換",
  );
});

test("破折號的說明只在真的出現破折號時回傳（`CRA-V1-002`）", () => {
  assert.equal(
    getCountUnavailableHint(3, 4),
    null,
    "兩個數字都拿到時不該多一行說明",
  );
  assert.equal(
    getCountUnavailableHint(0, 0),
    null,
    "真正的 0 不算未知，不得把它講成沒拿到",
  );
  assert.equal(
    getCountUnavailableHint(3, undefined),
    copy.event.countUnavailableHint,
  );
  assert.equal(
    getCountUnavailableHint(null, 4),
    copy.event.countUnavailableHint,
  );
  assert.equal(
    getCountUnavailableHint(undefined),
    copy.event.countUnavailableHint,
    "單一參數的呼叫形式（概覽）也必須生效",
  );
});

test("[static] 兩張會出現破折號的畫面都把它說明出來了", () => {
  const home = readSource("src/app/(auth)/home.tsx");

  assert.match(
    home,
    /getCountUnavailableHint\(\s*item\.registrationCount,\s*item\.exhibitorCount,?\s*\)/,
    "活動列表的兩個計數必須走同一條說明推導",
  );
  assert.match(home, /\{countHint\}/, "推導出來不等於有渲染");

  const overview = readSource("src/app/(auth)/[eventId]/overview.tsx");

  assert.match(
    overview,
    /getCountUnavailableHint\(event\?\.exhibitorCount\)/,
    "概覽的參展商卡必須與列表共用同一個轉換",
  );
  assert.match(
    overview,
    /hint:\s*getCountUnavailableHint\(event\?\.exhibitorCount\)/,
    "概覽的參展商卡同樣要說明破折號，且與顯示值同源",
  );
  assert.match(overview, /\{s\.hint\}/, "推導出來不等於有渲染");
});
