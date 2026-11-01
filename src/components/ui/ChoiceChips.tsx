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
  /**
   * `minHeight` 不是保險，是唯一的保證。
   *
   * 這裡的高度一直是「padding 24 + `type.label` 行高 22 + 邊框 2 = 48」，
   * 剛好等於 `layout.touchMin`——但那是**碰巧**，不是約定：行高或間距任何
   * 一個 token 調降 1px，晶片就會無聲掉到 48 以下，而畫面上看不出來。
   * 寫成 `minHeight` 之後，48 變成下限而不是副產品。
   *
   * `justifyContent: "center"` 是 `minHeight` 的必要搭檔：撐高之後多出來的
   * 空間若留給下方，文字會貼著上緣，看起來像被裁掉。
   */
  chip: {
    minHeight: layout.touchMin,
    justifyContent: "center",
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
