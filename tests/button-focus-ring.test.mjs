/**
 * `F-04` 的行為鎖定：主要 CTA 必須有看得見的聚焦指示（WCAG 2.4.7 / 1.4.11）。
 *
 * 缺陷不是「沒有機制」——`Button` 一直有內描邊式聚焦環，`FieldInput` 與
 * 顯示密碼鈕在實測中都有環。缺陷是**環的顏色與按鈕自己的填色相同**
 * （`primary.bg` 與 `components.focusRing.color` 都是 `purple[600]`），
 * 於是 `purple` 邊框畫在 `purple` 底上，1:1，等於沒有指示。
 *
 * runtime 半：跑真正的判定函式（含 WCAG 對比演算法）。
 * static 半：`Button.tsx` 需要 React Native 才能 render，純 Node 載不進來
 * （同 `count-display.test.mjs` 的既有做法），因此改讀原始碼確認判定真的被
 * 消費、且真的接上外框式聚焦環。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const {
  MIN_FOCUS_CONTRAST,
  contrastRatio,
  needsOutlineFocusRing,
  relativeLuminance,
} = await import("@/components/ui/focusRingContrast");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readSource = (relative) =>
  readFileSync(path.join(REPO_ROOT, relative), "utf8");

/**
 * `theme.ts` 的凍結值（僅供本檔比較；token 本身不動）。
 * `purple[600]` 同為 `action.primary`（按鈕底）與 `border.focus`（聚焦環）；
 * `red[700]` 是 `dangerSolid` 的底；`gray[50]` 是 disabled 的底。
 */
const PURPLE_600 = "#7C3AED";
const RED_700 = "#B91C1C";
const GRAY_50 = "#F9FAFB";
const WHITE = "#FFFFFF";

test("F-04：登入 CTA 的實況——環與底同色，判定為必須改用外框", () => {
  // primary 的底就是聚焦環的顏色，這是缺陷的完整成因。
  const ratio = contrastRatio(PURPLE_600, PURPLE_600);
  assert.equal(ratio, 1, "同色對比必須是 1:1");
  assert.equal(needsOutlineFocusRing(PURPLE_600, PURPLE_600), true);
});

test("白底與淺灰底上的紫色環看得見 → 維持原本的內描邊機制", () => {
  for (const background of [WHITE, GRAY_50]) {
    assert.ok(
      contrastRatio(background, PURPLE_600) >= MIN_FOCUS_CONTRAST,
      `${background} 的對比應 ≥ ${MIN_FOCUS_CONTRAST}`,
    );
    assert.equal(needsOutlineFocusRing(background, PURPLE_600), false);
  }
});

test("dangerSolid 的紅底同樣吃不住紫色環（同一個判定涵蓋第二個 variant）", () => {
  assert.ok(contrastRatio(RED_700, PURPLE_600) < MIN_FOCUS_CONTRAST);
  assert.equal(needsOutlineFocusRing(RED_700, PURPLE_600), true);
});

test("無法解析的顏色（transparent）不改變既有行為", () => {
  assert.equal(contrastRatio("transparent", PURPLE_600), null);
  assert.equal(needsOutlineFocusRing("transparent", PURPLE_600), false);
});

test("對比演算法本身：黑對白 21:1、同色 1:1、色版順序不影響結果", () => {
  assert.ok(Math.abs(contrastRatio(WHITE, "#000000") - 21) < 1e-6);
  assert.equal(
    contrastRatio(PURPLE_600, WHITE),
    contrastRatio(WHITE, PURPLE_600),
  );
  assert.equal(relativeLuminance("#000000"), 0);
  assert.ok(Math.abs(relativeLuminance("#FFFFFF") - 1) < 1e-9);
  // shorthand 也要解析得出來，否則呼叫端會靜默落回保守分支。
  assert.ok(Math.abs(relativeLuminance("#fff") - 1) < 1e-9);
});

test("[static] Button.tsx 依底色判定，並在需要時改用外框式聚焦環", () => {
  const source = readSource("src/components/ui/Button.tsx");

  assert.match(
    source,
    /needsOutlineFocusRing\(\s*colorToken\.bg,\s*components\.focusRing\.color,?\s*\)/,
    "判定必須吃「按鈕實際的底」與「凍結的聚焦環色」",
  );
  assert.match(
    source,
    /ringViaOutline \? focusRingStyle : focusRingResetStyle/,
    "需要外框時必須真的掛上 focusRingStyle，否則判定只是裝飾",
  );
  assert.match(
    source,
    /borderWidth: ringViaBorder/,
    "內描邊機制仍要保留給看得見的底色",
  );
});

test("[static] 本判定的前提仍成立：primary 的底與聚焦環是同一個 token", () => {
  const theme = readSource("src/constants/theme.ts");

  assert.match(
    theme,
    /focus: primitive\.palette\.purple\[600\]/,
    "border.focus 應為 purple[600]",
  );
  assert.match(
    theme,
    /primary: primitive\.palette\.purple\[600\]/,
    "action.primary 應為 purple[600]；若改掉，本檔的 hex 常數要一起更新",
  );
  assert.match(
    theme,
    /focusRing: \{\s*color: semantic\.border\.focus,\s*width: 2,/,
    "focusRing 仍應指向 border.focus、寬度 2",
  );
});
