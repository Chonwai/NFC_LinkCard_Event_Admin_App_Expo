import { type Ref, useState } from "react";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { Icon } from "@/components/ui/Icon";
import { useFocusRing } from "@/components/ui/useFocusRing";
import { copy } from "@/constants/copy.zh-TW";
import { components, layout, semantic, space, type } from "@/constants/theme";

export interface FieldInputProps {
  /** 欄位標籤（繁體中文） */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** 錯誤訊息；非 null 時邊框轉 danger 並顯示訊息 */
  error?: string | null;
  keyboardType?:
    "default" | "email-address" | "phone-pad" | "url" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  editable?: boolean;
  /** 必填欄位：label 後顯示 *，並在可存取名稱補「必填」 */
  required?: boolean;
  /** 多行輸入（如 AddCardsModal 的 tagUid 批次輸入） */
  multiline?: boolean;
  /** 由父層帶入，用於鍵盤遮擋時的捲動修正 */
  onFocus?: TextInputProps["onFocus"];
  /** 讓父層可捲動至該欄位（錯誤跳轉用） */
  inputRef?: Ref<TextInput>;
  /** 密碼欄位（顯示／隱藏切換由父層提供） */
  secureTextEntry?: boolean;
  /**
   * 顯示密碼可見度切換鈕（眼睛 icon；C8 新增）。
   * 只在 `secureTextEntry` 時有意義；切換鈕為 48×48 觸控區、`aria-pressed` 同步。
   */
  revealable?: boolean;
  /** 自動校正；tagUid／Email 等機器輸入欄位應傳 `false` */
  autoCorrect?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * 多行輸入的最小高度（§3.5）。此數值在 token 系統中無對應刻度，
 * 因此明示為具名常數而非游離魔術數字。
 */
const MULTILINE_MIN_HEIGHT = 120;

/**
 * 共用表單輸入（由舊的 ocr 版 FieldInput 重構）
 *
 * 修正項目：
 * - 舊邊框色（對比 1.24:1，WCAG 1.4.11 不達標）→ `components.field.borderColor`（4.83 ✅）
 * - 原本行內硬編碼的紅色 hex → `semantic.text.danger` / `semantic.border.danger`
 * - placeholder 的淺灰 hex → `semantic.text.muted`（7.23 ✅）
 * - 補上 a11y（`accessibilityLabel` / `accessibilityState` / `accessibilityHint`）
 * - 補上 `maxFontSizeMultiplier`（原本 0 處防護，見 §0.1）
 *
 * 高度由 `components.field.minHeight` 保證觸控目標 ≥ 48（WCAG 2.5.5）。
 */
export function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  autoCapitalize = "sentences",
  editable = true,
  required = false,
  multiline = false,
  onFocus,
  inputRef,
  secureTextEntry = false,
  revealable = false,
  autoCorrect,
  style,
  testID,
}: FieldInputProps) {
  const { focused, focusRingProps, focusRingResetStyle } = useFocusRing();
  /**
   * `CRA-V1-003`：顯示密碼鈕自己的聚焦環，**不能共用**上面那一組。
   *
   * 共用會讓「聚焦在眼睛圖示上」被讀成「輸入框被聚焦」，輸入框邊框會跟著加粗
   * 到 `focusRingWidth`——那是視覺 regression，不是無障礙改善。
   *
   * 在此之前這一顆鈕**完全沒有掛任何聚焦環**，靠的是 Chromium 自己的
   * UA 框（`outline: 1px auto rgb(0,95,204)`）。它剛好過 WCAG 2.4.7，但那不是
   * 這個 App 的決定，是瀏覽器的預設值：換瀏覽器、換版本、或哪天有人補上
   * `outline: none`，指示就消失了。掛上自家 token 之後，這顆鈕與 `Button`、
   * `Chip`、tab 用同一套 `components.focusRing`。
   */
  const revealRing = useFocusRing();
  /** 密碼明碼顯示（僅在 `revealable` 時可切換） */
  const [revealed, setRevealed] = useState(false);

  const isDisabled = !editable;
  const hasError = error != null;
  const canReveal = revealable && secureTextEntry;

  /** 錯誤色優先於聚焦色；聚焦時加粗為 `focusRingWidth`（對齊 Button / Card 的作法） */
  const borderColor = hasError
    ? components.field.borderColorError
    : focused
      ? components.field.borderColorFocused
      : components.field.borderColor;

  const handleFocus: NonNullable<TextInputProps["onFocus"]> = (event) => {
    focusRingProps.onFocus();
    onFocus?.(event);
  };

  return (
    <View style={[styles.field, style]}>
      <Text
        style={styles.label}
        maxFontSizeMultiplier={layout.maxFontScaleBody}
      >
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <View style={styles.inputShell}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            canReveal && styles.inputWithAccessory,
            {
              borderColor,
              borderWidth: focused
                ? components.field.focusRingWidth
                : components.field.borderWidth,
              backgroundColor: isDisabled
                ? semantic.action.primaryDisabledBg
                : components.field.bg,
              color: isDisabled
                ? semantic.text.disabled
                : semantic.text.primary,
              textAlignVertical: multiline ? "top" : "center",
            },
            multiline && styles.inputMultiline,
            /** M-5：只歸零 UA 橘框；聚焦環仍由 `focusRingWidth` 邊框承擔 */
            focusRingResetStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={() => focusRingProps.onBlur()}
          placeholder={placeholder}
          placeholderTextColor={semantic.text.muted}
          selectionColor={semantic.action.primary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          testID={testID}
          accessibilityLabel={
            required ? copy.common.requiredLabel(label) : label
          }
          accessibilityState={{ disabled: isDisabled }}
          /** H1（C12）：RNW 0.21 不映射 `accessibilityState` → 補 `aria-disabled` */
          aria-disabled={isDisabled}
          accessibilityHint={error ?? placeholder}
        />

        {canReveal ? (
          <Pressable
            onPress={() => setRevealed((previous) => !previous)}
            disabled={isDisabled}
            {...revealRing.focusRingProps}
            accessibilityRole="button"
            accessibilityLabel={
              revealed ? copy.common.hidePassword : copy.common.revealPassword
            }
            /** RNW 0.21 不映射 `accessibilityState`，故同時給 aria-*（C6 H1 發現） */
            accessibilityState={{ disabled: isDisabled, selected: revealed }}
            aria-pressed={revealed}
            /** H1（C12）：同上的 `aria-disabled` 補完 */
            aria-disabled={isDisabled}
            /**
             * `CRA-V1-003`：外框式聚焦環（`outline`），掛在被聚焦的這個節點上。
             * 這一顆鈕沒有自己的底色（坐在 `field.bg` 上），所以不需要
             * `needsOutlineFocusRing` 的內描邊／外框二選一——紫對白一直是
             * `5.70:1`。
             */
            style={[styles.reveal, revealRing.focusRingStyle]}
            hitSlop={space[1]}
            testID={testID != null ? `${testID}-reveal` : undefined}
          >
            <Icon
              name={revealed ? "eye-off" : "eye"}
              size="md"
              color={isDisabled ? semantic.icon.disabled : semantic.icon.brand}
            />
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <View
          style={styles.errorRow}
          /**
           * 欄位錯誤是「送出後立即需要修正」的訊息，因此與 `InlineBanner` 的
           * `danger` 一致使用 alert + assertive（原本只有 polite，讀屏可能等
           * 使用者停下來才念）。`role=alert` 也讓自動化測試能穩定找到它（**C-5**）。
           */
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Icon name="alert-circle" size="sm" color={semantic.icon.danger} />
          <Text
            style={styles.errorText}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: "stretch" },
  label: {
    ...type.label,
    color: semantic.text.secondary,
    marginBottom: space[2],
  },
  required: { color: semantic.text.danger },
  inputShell: {
    position: "relative",
    alignSelf: "stretch",
  },
  input: {
    minHeight: components.field.minHeight,
    borderRadius: components.field.radius,
    borderWidth: components.field.borderWidth,
    paddingHorizontal: components.field.paddingHorizontal,
    paddingVertical: space[3],
    ...type.bodyLg,
  },
  /** 右側留出 48×48 切換鈕的寬度，避免文字被鈕遮住 */
  inputWithAccessory: { paddingRight: layout.touchMin + space[2] },
  inputMultiline: { minHeight: MULTILINE_MIN_HEIGHT },
  reveal: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: layout.touchMin,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    marginTop: space[1],
  },
  errorText: {
    ...type.caption,
    color: semantic.text.danger,
    flexShrink: 1,
  },
});
