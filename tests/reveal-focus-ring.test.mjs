/**
 * `CRA-V1-003` 的行為鎖定：顯示密碼鈕的聚焦指示必須是**這個 App 自己的**。
 *
 * 缺陷的性質是「歸屬錯誤」，不是使用者可見的缺陷。`FieldInput` 的顯示密碼
 * `Pressable` 從來沒有掛過任何聚焦環，卻在紀錄裡被當成「同一個畫面上健康的
 * 對照組」——`6804354` 用它來佐證 CTA 是唯一的問題。實際上它會顯示聚焦環，
 * 靠的是 Chromium 的 UA 框（`outline: 1px auto rgb(0,95,204)`，實測見
 * `/tmp/lc-exe-focusmeasure.json`），不是 `components.focusRing`。
 * WCAG 2.4.7 因此一直是被滿足的，但滿足它的是瀏覽器的預設值：換瀏覽器、
 * 換版本，或哪天有人補一句 `outline: none`，指示就消失了。
 *
 * runtime 半：用專案自己的對比函式算「品牌紫環 vs 輸入框底色」。
 * static 半：`FieldInput.tsx` 需要 React Native 才能 render，純 Node 載不進來
 * （同 `count-display.test.mjs` 的既有做法），因此讀原始碼確認接線真的在，
 * 且**沒有**和輸入框共用同一組聚焦狀態。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { MIN_FOCUS_CONTRAST, contrastRatio } =
  await import("@/components/ui/focusRingContrast");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readSource = (relative) =>
  readFileSync(path.join(REPO_ROOT, relative), "utf8");

/** `theme.ts` 的凍結值（僅供本檔比較；token 本身不動） */
const PURPLE_600 = "#7C3AED";
const FIELD_SURFACE = "#FFFFFF";

test("CRA-V1-003：品牌紫環畫在輸入框底色上看得見（≥ 3:1）", () => {
  const ratio = contrastRatio(FIELD_SURFACE, PURPLE_600);
  assert.ok(ratio != null);
  assert.ok(
    ratio >= MIN_FOCUS_CONTRAST,
    `實測 ${ratio}:1，應 ≥ ${MIN_FOCUS_CONTRAST}:1`,
  );
  // 與 6804354 的紀錄同源：同一組色對在那一輪量到 5.70。
  assert.equal(ratio.toFixed(2), "5.70");
});

test("[static] 顯示密碼鈕有自己的聚焦環，且沒有和輸入框共用", () => {
  const source = readSource("src/components/ui/FieldInput.tsx");

  assert.match(
    source,
    /const revealRing = useFocusRing\(\);/,
    "切換鈕必須有自己的聚焦狀態",
  );
  assert.match(
    source,
    /\{\.\.\.revealRing\.focusRingProps\}/,
    "onFocus/onBlur 要真的掛在 Pressable 上，否則 focused 永遠是 false",
  );
  assert.match(
    source,
    /style=\{\[styles\.reveal, revealRing\.focusRingStyle\]\}/,
    "掛了 props 卻沒掛 style 等於沒有環",
  );
  assert.equal(
    (source.match(/useFocusRing\(\)/g) || []).length,
    2,
    "必須是兩個獨立實例：共用會讓「聚焦眼睛圖示」把輸入框邊框也加粗",
  );
});

test("[static] 輸入框自己的處置沒有被這次改動動到", () => {
  const source = readSource("src/components/ui/FieldInput.tsx");

  assert.match(
    source,
    /const \{ focused, focusRingProps, focusRingResetStyle \} = useFocusRing\(\);/,
    "輸入框仍是內描邊式聚焦（只歸零 UA 框）",
  );
  assert.match(source, /focusRingResetStyle,/, "TextInput 仍要吃 reset style");
});

test("[static] 本判定的前提仍成立：聚焦環 token 未被改動", () => {
  const theme = readSource("src/constants/theme.ts");

  assert.match(
    theme,
    /focusRing: \{\s*color: semantic\.border\.focus,\s*width: 2,/,
    "focusRing 仍應指向 border.focus、寬度 2",
  );
  assert.match(
    theme,
    /focus: primitive\.palette\.purple\[600\]/,
    "border.focus 應為 purple[600]；若改掉，本檔的 hex 常數要一起更新",
  );
});
