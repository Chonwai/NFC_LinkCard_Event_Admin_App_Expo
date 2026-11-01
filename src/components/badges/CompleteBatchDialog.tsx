import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { FieldInput } from "@/components/ui/FieldInput";
import { copy } from "@/constants/copy.zh-TW";
import { layout, radius, semantic, space, type } from "@/constants/theme";
import {
  parseCompleteBatchInput,
  type CompleteBatchError,
  type CompleteBatchLine,
} from "@/utils/badge-batch";

/** 對應 `parseCompleteBatchInput` 的錯誤鍵。 */
const COMPLETE_ERROR_COPY: Record<CompleteBatchError, string> = {
  completeFormat: copy.badges.errorCompleteFormat,
  duplicateBadgeId: copy.badges.errorCompleteDuplicate,
};

export interface CompleteBatchDialogProps {
  /** 批次的顯示名稱（讓人確認自己回填的是哪一批）。 */
  batchLabel: string;
  busy: boolean;
  onSubmit: (updated: CompleteBatchLine[]) => void;
  onCancel: () => void;
}

/**
 * 完成批次（回填實體 tagUid）的**表單**。
 *
 * ## 為什麼是貼上多行文字，而不是逐張手環掃描
 *
 * Web 就是這樣做的（它自己的註解寫 `MVP：textarea 每行 badgeId,realTagUid`）。
 * 「不增不減」的意思是 App 要在同一個成熟度上做到同一件事，不是替 Web 補完
 * 一個掃描流程——那會變成兩邊行為不同，而現場只會其中一邊有演練過。
 *
 * ## 為什麼驗證在 `parseCompleteBatchInput` 而不是這裡
 *
 * 同 `CreateBatchDialog`：規則要能被測試釘住。這裡只負責把錯誤鍵換成文案。
 *
 * ## 錯誤顯示在欄位下方
 *
 * 格式錯誤要改的是**文字內容**，所以回到輸入框旁邊才有意義。
 * 送出失敗（權限）留在確認框——那時改文字沒有用。
 */
export function CompleteBatchDialog({
  batchLabel,
  busy,
  onSubmit,
  onCancel,
}: CompleteBatchDialogProps) {
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<CompleteBatchError | null>(null);

  const handleSubmit = () => {
    const parsed = parseCompleteBatchInput(text);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }
    setFieldError(null);
    onSubmit(parsed.updated);
  };

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
        <View style={styles.dialog} testID="badges-complete-batch">
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={styles.title}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {copy.badges.completeBatchTitle}
            </Text>
            <Text
              style={styles.batchLabel}
              numberOfLines={2}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {batchLabel}
            </Text>
            <Text
              style={styles.intro}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.badges.completeBatchIntro}
            </Text>

            <FieldInput
              label={copy.badges.completeBatchTitle}
              value={text}
              onChangeText={(next) => {
                setText(next);
                setFieldError(null);
              }}
              placeholder={copy.badges.completeBatchPlaceholder}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              error={fieldError ? COMPLETE_ERROR_COPY[fieldError] : null}
              testID="badges-complete-input"
            />

            <Text
              style={styles.hint}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.badges.completeBatchHint}
            </Text>
          </ScrollView>

          <Button
            label={copy.badges.nextStep}
            onPress={handleSubmit}
            disabled={busy}
            testID="badges-complete-next"
          />
          <Button
            label={copy.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID="badges-complete-cancel"
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
  batchLabel: { ...type.label, color: semantic.text.secondary },
  intro: { ...type.caption, color: semantic.text.secondary },
  hint: { ...type.caption, color: semantic.text.muted },
});
