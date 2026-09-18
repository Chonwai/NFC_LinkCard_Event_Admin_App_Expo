import { useCallback, useState } from "react";

import { components } from "@/constants/theme";

/**
 * 只含 `outline*` 覆寫的最小結構型別。
 *
 * 不用 `ViewStyle` / `TextStyle`：RN 0.86 這兩個介面在此版本互不相容
 * （`cursor` / `userSelect` 的聯集不同），拿其中一個去接 `Pressable` 或
 * `TextInput` 的另一邊會直接噴 TS2322。本型別的每個成員在兩個介面上都存在且
 * 同型，因此可同時套用到 `View` / `Pressable` / `TextInput`。
 */
export interface FocusRingOutline {
  outlineStyle?: "solid" | "dotted" | "dashed";
  outlineColor?: string;
  outlineWidth?: number;
  outlineOffset?: number;
}

export interface FocusRingProps {
  onFocus: () => void;
  onBlur: () => void;
}

export interface FocusRing {
  focused: boolean;
  /** 掛到**被聚焦的那個** `Pressable` / `TextInput` 上 */
  focusRingProps: FocusRingProps;
  /**
   * 品牌色聚焦環：掛到**被聚焦的那個節點**（`Pressable` 本身）上。
   *
   * 用 CSS outline 而非邊框，有三個理由：
   * 1. **不動 layout**：`Chip` / checkbox / tab 的尺寸都量測過（tab 內容區只有
   *    48 高，icon 28 + label 15 + marginTop 4 = 47，加 2px 上下邊框直接溢出）。
   * 2. **必須掛在聚焦節點上**：Chromium 的 UA 橘框
   *    （`outline: 1px auto rgb(229,151,0)`）畫在**被聚焦的元素**上。實測把
   *    outline 覆寫寫在內層 View 時橘框依然存在——作者 inline style 只在
   *    同一節點才勝過 UA 樣式。
   * 3. `outlineColor` 直接吃 `components.focusRing.color`（`#7C3AED`），無游離 hex。
   */
  focusRingStyle: FocusRingOutline | undefined;
  /**
   * 只關掉 UA 聚焦框、不加任何可見外框（`outlineWidth: 0`）。
   *
   * 給**已經用邊框表達聚焦**的元件使用（`Button` / `Card` / `FieldInput`）：
   * 既有視覺行為不動，只是不再出現「品牌紫邊框 + 橘色 UA 外框」的雙框。
   */
  focusRingResetStyle: FocusRingOutline | undefined;
}

/**
 * 品牌聚焦環（**M-5 結案**）
 *
 * 修正前：`theme.focusRing.color`（`#7C3AED`）只接在 `Button` / `Card` /
 * `FieldInput` 上；checkbox / tab / `Chip` 完全沒有，實測一律顯示 Chromium 的
 * UA 預設框 `outline: 1px auto rgb(229,151,0)`（橘色，非品牌色）。
 *
 * 契約：
 * - **顏色／寬度一律取自 `components.focusRing`**，呼叫端不得自帶 hex。
 * - 只負責「聚焦態的覆寫」；未聚焦時回傳 `undefined`，元件原本樣式不受影響。
 * - RN 0.86 的 `ViewStyle.outlineStyle` 只允許 `'solid' | 'dotted' | 'dashed'`
 *   （**不含 `'none'`**），因此關掉 UA 框只能用 `outlineWidth: 0`。
 *
 * ⚠️ 本檔刻意放在 `src/components/ui/` 而非 `src/hooks/`：R2 施工鐵律凍結
 * `src/hooks/**`，而 helper 的消費者也全在 UI 層。
 */
export function useFocusRing(): FocusRing {
  const [focused, setFocused] = useState(false);

  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  const ringColor = components.focusRing.color;
  const ringWidth = components.focusRing.width;

  return {
    focused,
    focusRingProps: { onFocus, onBlur },
    focusRingStyle: focused
      ? {
          outlineStyle: "solid",
          outlineColor: ringColor,
          outlineWidth: ringWidth,
          /** 正值：外框畫在元素外緣，不遮住 label / icon */
          outlineOffset: 2,
        }
      : undefined,
    focusRingResetStyle: focused
      ? {
          outlineStyle: "solid",
          outlineWidth: 0,
        }
      : undefined,
  };
}
