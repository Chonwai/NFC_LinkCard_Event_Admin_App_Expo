import { Pressable, StyleSheet, Text, View } from "react-native";

import { layout, radius, semantic, space, type } from "@/constants/theme";

export interface ChoiceChipsProps<T extends string> {
  /** 欄位標籤（繁體中文） */
  label: string;
  /** 單選清單；順序即畫面順序 */
  options: readonly T[];
  value: T;
  /** 值 → 顯示文字（讓呼叫端決定要不要走 `copy`） */
  labelFor: (value: T) => string;
  onSelect: (value: T) => void;
  /** 每個晶片會得到 `${testID}-${option}` */
  testID: string;
}

/**
 * 單選晶片列。
 *
 * ## 為什麼不是 `FieldInput`
 * `FieldInput` 是自由文字輸入，`keyboardType` 只有
 * email/phone/url/number 這些，**沒有選單**這個型別。Web 用 `<select>`；
 * 手機上等效、而且更容易點的是晶片列（`walk-in.tsx` 的票種選法同一個模式）。
 *
 * ## 為什麼現在才抽成共用元件
 * 它先在「活動資料」頁當區域元件（活動類型／狀態／落地頁模式三處），
 * 當時只有一個畫面用得到，抽出來只是搬家。`2026-11-01` 的「活動設定」
 * 需要同一種互動（暗色模式 開／關），第二個消費者出現了，才升級到
 * `components/ui/`——兩個畫面各留一份一定會分岔（`CR-D4`）。
 *
 * 焦點環走 `Pressable` 的原生行為：`accessibilityRole="radio"` 讓讀屏把它
 * 念成單選項，`accessibilityState.selected` 同步選中態。
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  labelFor,
  onSelect,
  testID,
}: ChoiceChipsProps<T>) {
  return (
    <View style={styles.field}>
      <Text
        style={styles.label}
        maxFontSizeMultiplier={layout.maxFontScaleBody}
      >
        {label}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={labelFor(option)}
              testID={`${testID}-${option}`}
            >
              <Text
                style={[type.label, selected && styles.chipLabelSelected]}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {labelFor(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  label: {
    color: semantic.text.secondary,
    fontSize: 14,
    fontWeight: "600",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chip: {
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: semantic.bg.surface,
  },
  chipSelected: {
    borderColor: semantic.border.interactiveSelected,
    backgroundColor: semantic.bg.brandSoft,
  },
  chipLabelSelected: { color: semantic.text.primary, fontWeight: "600" },
});
