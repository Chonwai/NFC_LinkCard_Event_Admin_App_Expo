import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import * as Clipboard from "expo-clipboard";

import { Button } from "@/components/ui/Button";
import { copy } from "@/constants/copy.zh-TW";
import { layout, radius, semantic, space, type } from "@/constants/theme";

export interface ExportCsvDialogProps {
  csv: string;
  onClose: () => void;
}

/**
 * 匯出結果。
 *
 * ## 為什麼不是「下載檔案」
 *
 * Web 收到 `{ csv }` 之後用 `Blob` ＋ `<a download>` 存檔。React Native 沒有
 * 這條路：要寫檔得靠 `expo-file-system`、要分享得靠 `expo-sharing`，而這個
 * repo **沒有這兩個依賴**，本輪的契約也明訂不加依賴。
 *
 * 所以這裡給的是同一份資料的另一個出口：**完整 CSV 原文 ＋ 一鍵複製**。
 * 操作員複製後可以貼進 Numbers／Excel／備忘錄，也可以在支援的環境直接存檔。
 * 這是**平台等價物**，不是少做——差別只在「檔案落地的位置由使用者決定」。
 *
 * 這件事必須在交付裡單獨列出，因為它與 Web 的行為不完全相同：Web 按下就得到
 * 一個 `.csv` 檔，App 按下得到可複製的文字。
 *
 * ## 為什麼原文完整顯示而不是預覽前幾行
 *
 * 匯出的用途是**核對**（例如「已寫卡」統計對不起來時逐筆看）。只顯示前幾行
 * 等於逼操作員先複製再貼到別的地方才能看，多繞一圈。
 */
export function ExportCsvDialog({ csv, onClose }: ExportCsvDialogProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID="badges-export">
          <Text
            style={styles.title}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {copy.badges.exportTitle}
          </Text>
          <Text
            style={styles.intro}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {copy.badges.exportIntro}
          </Text>

          <ScrollView style={styles.csvBox} testID="badges-export-csv">
            <Text
              style={styles.csv}
              selectable
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {csv}
            </Text>
          </ScrollView>

          <Button
            label={copied ? copy.badges.csvCopied : copy.badges.copyCsv}
            onPress={() => {
              void Clipboard.setStringAsync(csv).then(() => setCopied(true));
            }}
            testID="badges-export-copy"
          />
          <Button
            label={copy.badges.exportClose}
            variant="secondary"
            onPress={onClose}
            testID="badges-export-close"
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
  title: { ...type.h3, color: semantic.text.primary },
  intro: { ...type.caption, color: semantic.text.secondary },
  csvBox: {
    flexGrow: 0,
    maxHeight: 320,
    backgroundColor: semantic.bg.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    padding: space[3],
  },
  csv: { ...type.monoSm, color: semantic.text.primary },
});
