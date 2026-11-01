import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { FieldInput } from "@/components/ui/FieldInput";
import { copy } from "@/constants/copy.zh-TW";
import { layout, radius, semantic, space, type } from "@/constants/theme";
import type { BadgeType, CreateNfcBatchParams } from "@/types/api.types";
import {
  CREATE_BATCH_MAX,
  CREATE_BATCH_MIN,
  parseCreateBatchInput,
  type CreateBatchError,
} from "@/utils/badge-batch";

/** 載體類型的晶片值。`NONE` 代表「不指定」，讓後端套自己的預設。 */
type BadgeTypeChoice = "NONE" | BadgeType;

const BADGE_TYPE_CHOICES: readonly BadgeTypeChoice[] = [
  "NONE",
  "WRISTBAND",
  "CARD",
  "QR_ONLY",
];

/** 對應 `parseCreateBatchInput` 的錯誤鍵。 */
const CREATE_BATCH_ERROR_COPY: Record<CreateBatchError, string> = {
  countRange: copy.badges.errorCountRange,
  colorFormat: copy.badges.errorColorFormat,
};

export interface CreateBatchDialogProps {
  busy: boolean;
  onSubmit: (params: CreateNfcBatchParams) => void;
  onCancel: () => void;
}

/**
 * 建立 badge 批次的**表單**（不含確認；確認由 `ConfirmActionDialog` 負責）。
 *
 * ## 為什麼表單與確認分成兩個元件
 *
 * `org-roles.tsx` 的邀請流程就是這個形狀：表單收值 → 純函式組出確認內容 →
 * 另一個 dialog 顯示它 → 按確認才送出。好處是「送出前的狀態」是一個
 * **可被測試的位置**（`parseCreateBatchInput`），而不是散在 `onPress` 裡的
 * `if`。
 *
 * ## 預設值照 Web
 *
 * 張數預設 50、其餘空白。Web 在成功後把張數重置回 50（`setCount(50)`），
 * 這裡因為 dialog 每次開啟都重新掛載，天然就是同一個行為。
 *
 * ## 為什麼欄位錯誤顯示在表單、送出錯誤顯示在確認框
 *
 * 兩種錯誤的原因不同：「張數不是 1–500」是**填錯**，要回到欄位旁改；
 * 「建立失敗」是**後端拒絕**（權限、額度），表單再送出一次也不會變。
 * 混在一起會讓操作員改一個沒問題的欄位。
 */
export function CreateBatchDialog({
  busy,
  onSubmit,
  onCancel,
}: CreateBatchDialogProps) {
  const [count, setCount] = useState("50");
  const [badgeType, setBadgeType] = useState<BadgeTypeChoice>("NONE");
  const [colorCode, setColorCode] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [fieldError, setFieldError] = useState<CreateBatchError | null>(null);

  const handleSubmit = () => {
    const parsed = parseCreateBatchInput({
      count,
      badgeType: badgeType === "NONE" ? null : badgeType,
      colorCode,
      batchLabel,
    });

    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }

    setFieldError(null);
    onSubmit(parsed.params);
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
        <View style={styles.dialog} testID="badges-create-batch">
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={styles.title}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {copy.badges.createBatchTitle}
            </Text>
            <Text
              style={styles.intro}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.badges.createBatchIntro}
            </Text>

            <FieldInput
              label={copy.badges.countLabel}
              value={count}
              onChangeText={(text) => {
                setCount(text);
                setFieldError(null);
              }}
              placeholder={copy.badges.countPlaceholder}
              keyboardType="number-pad"
              error={
                fieldError === "countRange"
                  ? CREATE_BATCH_ERROR_COPY.countRange
                  : null
              }
              required
              testID="badges-create-count"
            />

            <ChoiceChips
              label={copy.badges.badgeTypeLabel}
              options={BADGE_TYPE_CHOICES}
              value={badgeType}
              labelFor={(value) =>
                value === "NONE" ? copy.badges.badgeTypeAny : value
              }
              onSelect={setBadgeType}
              testID="badges-create-type"
            />

            <FieldInput
              label={copy.badges.colorCodeLabel}
              value={colorCode}
              onChangeText={(text) => {
                setColorCode(text);
                setFieldError(null);
              }}
              placeholder={copy.badges.colorCodePlaceholder}
              autoCapitalize="none"
              error={
                fieldError === "colorFormat"
                  ? CREATE_BATCH_ERROR_COPY.colorFormat
                  : null
              }
              testID="badges-create-color"
            />

            <FieldInput
              label={copy.badges.batchLabelLabel}
              value={batchLabel}
              onChangeText={setBatchLabel}
              placeholder={copy.badges.batchLabelPlaceholder}
              maxLength={60}
              testID="badges-create-label"
            />

            <Text
              style={styles.hint}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.badges.countRangeHint(CREATE_BATCH_MIN, CREATE_BATCH_MAX)}
            </Text>
          </ScrollView>

          <Button
            label={copy.badges.nextStep}
            onPress={handleSubmit}
            disabled={busy}
            testID="badges-create-next"
          />
          <Button
            label={copy.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID="badges-create-cancel"
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
  scrollContent: { gap: space[4] },
  title: { ...type.h3, color: semantic.text.primary },
  intro: { ...type.caption, color: semantic.text.secondary },
  hint: { ...type.caption, color: semantic.text.muted },
});
