/**
 * 聚焦環「看不看得見」的判定（`F-04`）。
 *
 * `Button` 的聚焦指示是**內描邊**：聚焦時把邊框畫成 `components.focusRing.color`
 * （品牌紫 `purple[600]`）。這在淺色底上可行——`FieldInput`、`secondary` 按鈕、
 * 顯示密碼鈕都是這樣過的。但 `primary` 按鈕的底**就是同一個 `purple[600]`**：
 * 環與底 1:1，聚焦時整個按鈕外觀完全不變，等於沒有聚焦指示
 * （`docs/evidence/UI-REVIEW/14-login-focus-login-btn.png`，實測外層
 * `outlineWidth: 0`、`border: 0`、`boxShadow: none`）。
 *
 * 這裡把「環與底色夠不夠分」寫成可計算的性質，而不是在元件裡列一張
 * 「我知道壞掉的那幾個 variant」清單：WCAG 2.2 SC 1.4.11 對這種非文字指示
 * 要求的是 3:1，同一個算式也能攔下未來新增的填色 variant。
 *
 * **不動 token**：本模組只讀顏色、回傳布林；顏色一律來自 `theme.ts`。
 * 呼叫端的處置是改用既有的外框式聚焦環（`useFocusRing().focusRingStyle`），
 * 不是改 `components.focusRing` 的色票或寬度。
 */

/** WCAG 2.2 SC 1.4.11 對非文字元素的對比要求 */
export const MIN_FOCUS_CONTRAST = 3;

/** `#RGB` / `#RRGGBB` → `[r, g, b]`；無法解析（如 `transparent`）回 `null` */
function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  const expanded =
    hex.length === 3 ? hex.replace(/./g, (char) => char + char) : hex;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return null;
  }

  return [0, 2, 4].map((offset) =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

/** sRGB 色版 → 線性亮度分量（WCAG 定義） */
function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number | null {
  const rgb = parseHexColor(color);

  if (rgb == null) {
    return null;
  }

  const [red, green, blue] = rgb.map(linearize) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 相對對比；任一邊無法解析時回 `null`（**不是** 0，也不是通過） */
export function contrastRatio(first: string, second: string): number | null {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);

  if (firstLuminance == null || secondLuminance == null) {
    return null;
  }

  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 內描邊式聚焦環是否會消失在底色裡。
 *
 * `true` → 呼叫端必須改用外框式聚焦環（`focusRingStyle`），因為這個角度上
 * 沒有任何可調整的顏色：環的顏色是凍結 token，底色也是凍結 token。
 *
 * 顏色無法解析（例如 `transparent`）時回 `false`——沿用原本的內描邊機制。
 * 保守預設：這支函式只該把「已知會消失」的情形挑出來，不該改變其他情形。
 */
export function needsOutlineFocusRing(
  backgroundColor: string,
  focusRingColor: string,
): boolean {
  const ratio = contrastRatio(backgroundColor, focusRingColor);

  return ratio != null && ratio < MIN_FOCUS_CONTRAST;
}
