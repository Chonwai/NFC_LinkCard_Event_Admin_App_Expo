import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as DocumentPicker from "expo-document-picker";

import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { exhibitorService } from "@/services/exhibitor.service";
import type { ExhibitorImportPreview } from "@/types/exhibitor.types";
import { importErrorText, MAX_PREVIEW_ROWS } from "@/utils/exhibitor-import";
import {
  type SpreadsheetFile,
  SPREADSHEET_MIME_TYPES,
} from "@/utils/spreadsheet-upload";

/**
 * 展商名單匯入面板（parity `exhibitors`，EXH-IMPORT 契約 §11.2）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/exhibitors/import/page.tsx`
 * （749 行，四步精靈）。
 *
 * 四步與後端四個端點一一對應：
 *   1. 模板（`GET …/import/template`）——純文字，交給系統分享面板
 *   2. 選檔 → 預覽（`POST …/import/preview`；**零寫入**）
 *   3. 確認匯入（`POST …/import/confirm`；`mode` 只有 `skip_existing`）
 *   4. 寄邀請信（`POST …/import/notify`；自動切批，每批 ≤100）
 *
 * ## 為什麼做成面板而不是獨立頁面
 *
 * Web 是獨立路由，因為它有深連結（列表頁的「匯入名單」按鈕帶過去）。App 用
 * `Modal`：入口只有一個、流程是線性的，而且「匯入到一半按系統返回」在面板上
 * 有明確答案（`onRequestClose`），在獨立頁上則會變成一個說不清楚的半途狀態。
 *
 * ## 選檔與切批不是這裡發明的
 *
 * 選檔器用的是 `registrations` 匯入已經在用的那一組 MIME 白名單
 * （`SPREADSHEET_MIME_TYPES`）。兩邊各留一份一定會分岔（見
 * `utils/spreadsheet-upload.ts` 開頭）。
 */
export function ExhibitorImportModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"select" | "preview">("select");
  const [file, setFile] = useState<SpreadsheetFile | null>(null);
  const [preview, setPreview] = useState<ExhibitorImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** 選檔。取消不是錯誤——不設 `error`，畫面維持原狀。 */
  const pickFile = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [...SPREADSHEET_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? null,
      });
      // 換檔就作廢上一份預覽，否則下一步會對到舊檔案。
      setPreview(null);
      setStep("select");
    } catch {
      setError(copy.exhibitors.import.step1.pickFailed);
    }
  }, []);

  /** 模板：App 沒有下載資料夾，把 CSV 文字交給系統分享面板。 */
  const handleDownloadTemplate = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const csv = await exhibitorService.downloadImportTemplate(eventId);
      await Share.share({ message: csv });
      setNotice(copy.exhibitors.import.step1.templateReady);
    } catch {
      setError(copy.exhibitors.import.step1.templateFailed);
    }
  }, [eventId]);

  /**
   * 預覽（**零寫入**）。
   *
   * 失敗時用 `importErrorText` 挑字：後端對解析失敗、超過 500 列、檔案過大
   * 各有不同的 code，一句泛用訊息會讓操作員不知道該改什麼。
   */
  const handlePreview = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setPreview(await exhibitorService.previewImport(eventId, file));
      setStep("preview");
    } catch (err) {
      setError(importErrorText(err));
    } finally {
      setBusy(false);
    }
  }, [eventId, file]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={type.h3}>{copy.exhibitors.import.title}</Text>
            <Text style={styles.hint}>{copy.exhibitors.import.subtitle}</Text>

            {error ? (
              <InlineBanner tone="danger" compact message={error} />
            ) : null}
            {notice ? (
              <InlineBanner tone="success" compact message={notice} />
            ) : null}

            {step === "select" ? (
              <SelectStep
                file={file}
                busy={busy}
                onDownloadTemplate={() => void handleDownloadTemplate()}
                onPickFile={() => void pickFile()}
                onPreview={() => void handlePreview()}
              />
            ) : null}

            {step === "preview" && preview ? (
              <PreviewStep
                preview={preview}
                busy={busy}
                onBack={() => setStep("select")}
              />
            ) : null}

            <Button
              label={copy.exhibitors.import.close}
              variant="ghost"
              disabled={busy}
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** 第一步：下載模板、選檔、送出預覽。 */
function SelectStep({
  file,
  busy,
  onDownloadTemplate,
  onPickFile,
  onPreview,
}: {
  file: SpreadsheetFile | null;
  busy: boolean;
  onDownloadTemplate: () => void;
  onPickFile: () => void;
  onPreview: () => void;
}) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {copy.exhibitors.import.step1.title}
        </Text>
        <Text style={styles.hint}>
          {copy.exhibitors.import.step1.description}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onDownloadTemplate}
            disabled={busy}
            style={({ pressed }) => [
              styles.smallButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={copy.exhibitors.import.step1.downloadTemplate}
          >
            <Text style={styles.smallButtonText}>
              {copy.exhibitors.import.step1.downloadTemplate}
            </Text>
          </Pressable>
          <Pressable
            onPress={onPickFile}
            disabled={busy}
            style={({ pressed }) => [
              styles.smallButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={copy.exhibitors.import.step1.chooseFile}
          >
            <Text style={styles.smallButtonText}>
              {file
                ? copy.exhibitors.import.step1.changeFile(file.name)
                : copy.exhibitors.import.step1.chooseFile}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {copy.exhibitors.import.step1.templateHint}
        </Text>

        {!file ? (
          <Text style={styles.hint}>{copy.exhibitors.import.step1.noFile}</Text>
        ) : null}
      </View>

      <Button
        label={
          busy
            ? copy.exhibitors.import.step1.previewing
            : copy.exhibitors.import.step1.preview
        }
        disabled={!file || busy}
        loading={busy}
        onPress={onPreview}
        testID="exhibitor-import-preview"
      />
    </>
  );
}

/**
 * 第二步：預覽（**尚未寫入任何資料**）。
 *
 * 四個數字直接取後端的 `summary`，不自己從陣列長度重算——後端的三類不是互斥
 * 分割（一列可以既重複又無效），用減法會在邊界情況算出負數。這與
 * `utils/guest-import.ts` 的 `previewCounts` 是同一條紀律。
 */
function PreviewStep({
  preview,
  busy,
  onBack,
}: {
  preview: ExhibitorImportPreview;
  busy: boolean;
  onBack: () => void;
}) {
  const overCap = preview.valid.length > MAX_PREVIEW_ROWS;
  const validRows = preview.valid.slice(0, MAX_PREVIEW_ROWS);

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {copy.exhibitors.import.step2.title}
        </Text>
        <View style={styles.statGrid}>
          <Stat
            label={copy.exhibitors.import.step2.summaryTotal}
            value={preview.total}
          />
          <Stat
            label={copy.exhibitors.import.step2.summaryValid}
            value={preview.summary.valid}
          />
          <Stat
            label={copy.exhibitors.import.step2.summaryInvalid}
            value={preview.summary.invalid}
          />
          <Stat
            label={copy.exhibitors.import.step2.summaryDuplicate}
            value={preview.summary.duplicate}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {copy.exhibitors.import.step2.validTitle}
        </Text>
        {validRows.length === 0 ? (
          <Text style={styles.hint}>
            {copy.exhibitors.import.step2.noValid}
          </Text>
        ) : (
          validRows.map((row) => (
            <View key={row.row} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{row.row}</Text>
              <View style={styles.lineBody}>
                <Text style={styles.lineStrong}>{row.companyName}</Text>
                <Text style={styles.hint}>{row.email}</Text>
                {row.slug ? (
                  <Text style={styles.lineMono}>{row.slug}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
        {overCap ? (
          <Text style={styles.hint}>
            {copy.exhibitors.import.step2.showingFirst(MAX_PREVIEW_ROWS)}
          </Text>
        ) : null}
      </View>

      <Button
        label={copy.exhibitors.import.step2.back}
        variant="secondary"
        disabled={busy}
        onPress={onBack}
        testID="exhibitor-import-back"
      />
    </>
  );
}

/** 一格統計數字（標籤 + 值）。 */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.screen,
  },
  panel: {
    backgroundColor: semantic.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    maxHeight: "88%",
  },
  body: { padding: space[4], gap: space[3] },
  hint: { ...type.caption, color: semantic.text.muted },
  actions: { flexDirection: "row", gap: space[2], flexWrap: "wrap" },
  smallButton: {
    minHeight: layout.touchMin,
    justifyContent: "center",
    paddingHorizontal: space[3],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
  },
  smallButtonText: { ...type.caption, color: semantic.text.secondary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  card: {
    gap: space[1],
    padding: space[3],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    backgroundColor: semantic.bg.surface,
  },
  cardTitle: {
    ...type.caption,
    fontWeight: "600",
    color: semantic.text.primary,
  },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  stat: {
    flexGrow: 1,
    minWidth: 72,
    alignItems: "center",
    paddingVertical: space[2],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  statValue: { ...type.h3, color: semantic.text.primary },
  statLabel: { ...type.micro, color: semantic.text.muted },
  /**
   * 一列可匯入資料。
   *
   * 手機放不下一張五欄表格（Web 的 `<table>` 有五個表頭），所以一列排成
   * 「列號 + 縱向堆疊的三行」。資訊相同，只是把欄位變成行。
   */
  lineRow: {
    flexDirection: "row",
    gap: space[2],
    paddingVertical: space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.border.decorativeSubtle,
  },
  lineIndex: { ...type.micro, minWidth: 28, color: semantic.text.muted },
  lineBody: { flex: 1, gap: 2 },
  lineStrong: { ...type.caption, color: semantic.text.primary },
  lineMono: { ...type.micro, color: semantic.text.muted },
});
