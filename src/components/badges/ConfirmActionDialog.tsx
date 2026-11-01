import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { copy } from "@/constants/copy.zh-TW";
import { layout, radius, semantic, space, type } from "@/constants/theme";

/** 確認框的一列「標籤：值」。 */
export interface ConfirmActionRow {
  label: string;
  value: string;
}

export interface ConfirmActionDialogProps {
  title: string;
  intro: string;
  rows: readonly ConfirmActionRow[];
  /** 粗體警告。**每個寫入都要有**——這三件事都會動到實體手環。 */
  warning: string;
  confirmLabel: string;
  busy: boolean;
  /** 上一次送出的錯誤（分類文案，不回顯後端 message）。 */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID: string;
}

/**
 * Badge 寫入動作的二次確認框。
 *
 * ## 為什麼是共用元件（而不是每個動作各畫一個）
 *
 * 這個頁面有三個寫入：建立批次、完成批次、指派展商。三者都要「按下主動作
 * 之後、真的送出之前」再問一次，而三份各畫一次一定會分岔——`CR-D4` 講的
 * 就是這件事（`ChoiceChips` 當初從兩個地方抽出來也是同一個理由）。
 *
 * ## 形狀照 `org-roles.tsx` 的 `InviteDialog`
 *
 * 自繪 `Modal`、按鈕順序「主動作在上、取消在下」。不用 RN 的 `Alert.alert`
 * （全案沒有用過它）。
 *
 * ## 為什麼一定要有 `warning`（不是選填）
 *
 * 這三件事都會動到**實體手環**：建立批次會產生實體庫存、完成批次會把手環
 * 寫成一次性資產、指派會把一批手環交給某個展商。三者的共同點是**沒有
 * 反轉動作**。確認框若只寫「確定嗎？」，它擋下的只是手滑，擋不下誤解。
 * 所以警告是必填欄位。
 *
 * ## 內容區可捲動
 *
 * 完成批次可能一次貼進上百行，確認框要顯示筆數與前幾筆；固定高度會把
 * 「取消」推出畫面外（那是最糟的失敗模式：使用者只能按到確認）。
 */
export function ConfirmActionDialog({
  title,
  intro,
  rows,
  warning,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
  testID,
}: ConfirmActionDialogProps) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID={testID}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <Text
              style={styles.title}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {title}
            </Text>
            <Text
              style={styles.intro}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {intro}
            </Text>

            {rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text
                  style={styles.rowLabel}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {row.label}
                </Text>
                <Text
                  style={styles.rowValue}
                  numberOfLines={3}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                  testID={`${testID}-row-${row.label}`}
                >
                  {row.value}
                </Text>
              </View>
            ))}

            <Text
              style={styles.warning}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {warning}
            </Text>

            {error ? (
              <Text
                style={styles.error}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <Button
            label={confirmLabel}
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
            testID={`${testID}-confirm`}
          />
          <Button
            label={copy.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID={`${testID}-cancel`}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: space[4],
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    maxHeight: "85%",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: space[3] },
  title: { ...type.h3, color: semantic.text.primary },
  intro: { ...type.caption, color: semantic.text.secondary },
  row: { flexDirection: "row", gap: space[3] },
  rowLabel: {
    ...type.caption,
    color: semantic.text.muted,
    width: 88,
    flexShrink: 0,
  },
  rowValue: {
    ...type.caption,
    color: semantic.text.primary,
    fontWeight: "600",
    flex: 1,
    minWidth: 0,
  },
  warning: {
    ...type.caption,
    color: semantic.status.warning.fg,
    backgroundColor: semantic.status.warning.bg,
    borderRadius: radius.sm,
    padding: space[3],
  },
  error: {
    ...type.caption,
    color: semantic.status.danger.fg,
  },
});
