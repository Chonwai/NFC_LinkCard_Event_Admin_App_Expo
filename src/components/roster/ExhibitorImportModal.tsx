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
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { exhibitorService } from "@/services/exhibitor.service";
import type {
  ExhibitorImportConfirmResult,
  ExhibitorImportPreview,
} from "@/types/exhibitor.types";
import {
  buildImportErrorReportCsv,
  canConfirmImport,
  flattenImportErrors,
  importErrorText,
  MAX_PREVIEW_ROWS,
} from "@/utils/exhibitor-import";
import {
  chunkSpreadsheetIds,
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
  onImported,
}: {
  eventId: string;
  onClose: () => void;
  /** 匯入成功後通知外層重新載入名單。 */
  onImported?: () => void;
}) {
  const [step, setStep] = useState<"select" | "preview" | "done" | "notify">(
    "select",
  );
  const [file, setFile] = useState<SpreadsheetFile | null>(null);
  const [preview, setPreview] = useState<ExhibitorImportPreview | null>(null);
  const [result, setResult] = useState<ExhibitorImportConfirmResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** 寄邀請信的進度（分批序列呼叫，見 `runNotify`）。 */
  const [notifyState, setNotifyState] = useState<{
    total: number;
    sent: number;
    /** 失敗的 memberId。重試只重寄這些，不是重寄全部。 */
    failedIds: string[];
    running: boolean;
    done: boolean;
  } | null>(null);

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
      // 換檔就作廢上一份預覽與結果，否則下一步會對到舊檔案。
      setPreview(null);
      setResult(null);
      setNotifyState(null);
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

  /**
   * 確認匯入（**寫入**）。後端是 per-row 交易、`skip_existing` 冪等，
   * 所以同一份檔案重跑不會重複建立。
   *
   * 只有一件事會讓它不幂等：`mode` 傳錯。後端對「有送但不等於
   * `skip_existing`」是明確拒絕（400）——不會靜默降級成其他行為，所以
   * 那個字串寫死在 service 裡，這裡不傳。
   */
  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const confirmed = await exhibitorService.confirmImport(eventId, file);
      setResult(confirmed);
      setStep("done");
      // 即使 created 為空也要通知外層：skipped 也可能改變了名單的組成。
      onImported?.();
    } catch (err) {
      setError(importErrorText(err));
    } finally {
      setBusy(false);
    }
  }, [eventId, file, onImported]);

  /**
   * 寄邀請信：**分批序列呼叫**（每批 ≤100，後端硬上限）。
   *
   * 為什麼不到 100 就整批不用送：後端對超量是**整批拒絕**，不是截斷。
   * 為什麼序列而不是並行：進度條要能顯示「寄到第幾封」，並行呼叫的完成
   * 順序不可預期，畫面只能跳來跳去；而且這是寄信，不是讀資料。
   */
  const runNotify = useCallback(
    async (memberIds: string[]) => {
      if (memberIds.length === 0) return;
      setNotifyState((current) => ({
        total: current?.total ?? memberIds.length,
        sent: current?.sent ?? 0,
        failedIds: [],
        running: true,
        done: false,
      }));
      let sent = 0;
      const failedIds: string[] = [];
      for (const batch of chunkSpreadsheetIds(memberIds)) {
        try {
          const outcome = await exhibitorService.notifyImport(eventId, batch);
          sent += outcome.sent.length;
          /*
           * `skipped` 不是失敗：已接受／已撤銷／已寄過都在那裡，重寄也不會
           * 變成寄出。把它算成失敗會讓操作員去追一個不存在的問題。
           */
          failedIds.push(...outcome.failed.map((item) => item.memberId));
        } catch {
          // 整批失敗時，這一批的每一個 id 都算沒寄出去。
          failedIds.push(...batch);
        }
        setNotifyState((current) =>
          current ? { ...current, sent, failedIds: [...failedIds] } : current,
        );
      }
      setNotifyState((current) =>
        current ? { ...current, running: false, done: true } : current,
      );
    },
    [eventId],
  );

  /**
   * 錯誤報表：從**預覽的回應**自行組出 CSV（後端沒有這個端點，契約 §11.2 C2-4
   * 就是這樣設計的），再交給系統分享面板——手機沒有「下載到資料夾」。
   *
   * 為什麼不讓使用者自己抄：一列多錯時，畫面上只列前 100 列，而 500 列的
   * 匯入常常就是「後面 400 列要一次修完」。報表是唯一能完整帶走錯誤的載體。
   */
  const handleShareErrorReport = useCallback(async () => {
    if (!preview || preview.invalid.length === 0) return;
    setError(null);
    setNotice(null);
    try {
      await Share.share({
        message: buildImportErrorReportCsv(preview.invalid),
      });
      setNotice(copy.exhibitors.import.step2.errorReportReady);
    } catch {
      setError(copy.exhibitors.import.step2.errorReportFailed);
    }
  }, [preview]);

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
                onConfirm={() => void handleConfirm()}
                onShareErrors={() => void handleShareErrorReport()}
              />
            ) : null}

            {step === "done" && result ? (
              <ResultStep
                result={result}
                onNotify={() => {
                  if (notifyState?.running) return;
                  setStep("notify");
                  void runNotify(result.created.map((row) => row.memberId));
                }}
              />
            ) : null}

            {step === "notify" && notifyState ? (
              <NotifyStep
                state={notifyState}
                onRetry={() => void runNotify(notifyState.failedIds)}
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
  onConfirm,
  onShareErrors,
}: {
  preview: ExhibitorImportPreview;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onShareErrors: () => void;
}) {
  const overCap = preview.valid.length > MAX_PREVIEW_ROWS;
  const validRows = preview.valid.slice(0, MAX_PREVIEW_ROWS);
  const confirmable = canConfirmImport(preview);
  const errors = flattenImportErrors(preview.invalid).slice(
    0,
    MAX_PREVIEW_ROWS,
  );

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

      {/*
       * 逐列錯誤。手機排不下 Web 那張五欄表（row / field / code / message /
       * value），所以一條錯排成「列號 → 欄位＋訊息 → 錯誤碼」。資訊相同，
       * 只是把欄位變成行。
       */}
      {errors.length > 0 ? (
        <View style={[styles.card, styles.cardDanger]}>
          <Text style={styles.cardTitleDanger}>
            {copy.exhibitors.import.step2.invalidTitle}
          </Text>
          {errors.map((error, index) => (
            <View
              key={`${error.row}-${error.field}-${error.code}-${index}`}
              style={styles.lineRow}
            >
              <Text style={styles.lineIndex}>{error.row}</Text>
              <View style={styles.lineBody}>
                <Text style={styles.lineStrong}>
                  {error.field}：{error.message}
                </Text>
                <Text style={styles.lineMono}>{error.code}</Text>
                {error.value ? (
                  <Text style={styles.lineMono}>值：{error.value}</Text>
                ) : null}
              </View>
            </View>
          ))}
          {preview.summary.invalid > MAX_PREVIEW_ROWS ? (
            <Text style={styles.hint}>
              {copy.exhibitors.import.step2.showingFirst(MAX_PREVIEW_ROWS)}
            </Text>
          ) : null}
          <Button
            label={copy.exhibitors.import.step2.downloadErrors}
            variant="secondary"
            disabled={busy}
            onPress={onShareErrors}
            testID="exhibitor-import-error-report"
          />
        </View>
      ) : null}

      {preview.duplicates.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {copy.exhibitors.import.step2.duplicatesTitle}
          </Text>
          {preview.duplicates.slice(0, MAX_PREVIEW_ROWS).map((row) => (
            <View key={`${row.row}-${row.reason}`} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{row.row}</Text>
              {/* reason 是後端碼（EMAIL_EXISTS_IN_EVENT 等），照原樣顯示。 */}
              <Text style={styles.lineMono}>{row.reason}</Text>
            </View>
          ))}
          {preview.duplicates.length > MAX_PREVIEW_ROWS ? (
            <Text style={styles.hint}>
              {copy.exhibitors.import.step2.showingFirst(MAX_PREVIEW_ROWS)}
            </Text>
          ) : null}
        </View>
      ) : null}

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

      {!confirmable && preview.summary.invalid > 0 ? (
        <InlineBanner
          compact
          tone="danger"
          message={copy.exhibitors.import.step2.blockingHint(
            preview.summary.invalid,
          )}
        />
      ) : null}

      <Button
        label={
          busy
            ? copy.exhibitors.import.step2.confirming
            : copy.exhibitors.import.step2.confirm
        }
        disabled={!confirmable || busy}
        loading={busy}
        onPress={onConfirm}
        testID="exhibitor-import-confirm"
      />

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

/**
 * 第三步：確認匯入的結果。
 *
 * 三態互斥（後端保證）：`created` 交易提交、`skipped` 去重命中、`failed` 該列
 * 交易回滾。三類都畫，因為「建了幾家」與「為什麼沒建」是同一個問題的兩半。
 *
 * 「寄送邀請信」只在 `created` 非空時出現——沒有新成員就沒有信可寄，一顆按了
 * 什麼都不會發生的按鈕比沒有按鈕更糟。
 */
function ResultStep({
  result,
  onNotify,
}: {
  result: ExhibitorImportConfirmResult;
  onNotify: () => void;
}) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {copy.exhibitors.import.step3.title}
        </Text>
        <View style={styles.statGrid}>
          <Stat
            label={copy.exhibitors.import.step3.created}
            value={result.created.length}
          />
          <Stat
            label={copy.exhibitors.import.step3.skipped}
            value={result.skipped.length}
          />
          <Stat
            label={copy.exhibitors.import.step3.failed}
            value={result.failed.length}
          />
        </View>
      </View>

      {result.created.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {copy.exhibitors.import.step3.createdTitle}
          </Text>
          {result.created.map((row) => (
            <View key={row.memberId} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{row.row}</Text>
              <View style={styles.lineBody}>
                <Text style={styles.lineStrong}>{row.email}</Text>
                <Text style={styles.lineMono}>{row.slug}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {result.skipped.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {copy.exhibitors.import.step3.skippedTitle}
          </Text>
          {result.skipped.map((row) => (
            <View key={`${row.row}-${row.reason}`} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{row.row}</Text>
              {/* reason 是後端碼（EMAIL_EXISTS_IN_EVENT 等），照原樣顯示。 */}
              <Text style={styles.lineMono}>{row.reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.failed.length > 0 ? (
        <View style={[styles.card, styles.cardDanger]}>
          <Text style={styles.cardTitleDanger}>
            {copy.exhibitors.import.step3.failedTitle}
          </Text>
          {result.failed.map((row) => (
            <View key={`${row.row}-${row.code ?? "?"}`} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{row.row}</Text>
              <View style={styles.lineBody}>
                <Text style={styles.lineDanger}>{row.reason}</Text>
                {row.code ? (
                  <Text style={styles.lineMono}>{row.code}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {result.created.length > 0 ? (
        <>
          <Text style={styles.hint}>
            {copy.exhibitors.import.step3.notifyHint(result.created.length)}
          </Text>
          <Button
            label={copy.exhibitors.import.step3.notify}
            onPress={onNotify}
            testID="exhibitor-import-notify"
          />
        </>
      ) : null}
    </>
  );
}

/**
 * 第四步：寄送邀請信。
 *
 * 進度用「已寄出 / 總數」兩邊都顯示：只有一條進度條時，`sent` 停住不動與
 * 整批卡住看起來完全一樣。失敗數用紅色區塊另外講，因為它需要一個動作
 * （重試），不是一句狀態。
 */
function NotifyStep({
  state,
  onRetry,
}: {
  state: {
    total: number;
    sent: number;
    failedIds: string[];
    running: boolean;
    done: boolean;
  };
  onRetry: () => void;
}) {
  const percent = state.total > 0 ? (state.sent / state.total) * 100 : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{copy.exhibitors.import.step4.title}</Text>

      <Text style={styles.hint}>
        {state.running
          ? copy.exhibitors.import.step4.sending
          : state.done
            ? copy.exhibitors.import.step4.complete
            : ""}
      </Text>
      <Text style={styles.lineMono}>
        {copy.exhibitors.import.step4.progress(state.sent, state.total)}
      </Text>

      {/*
       * RN 沒有百分比寬度，所以用 flex 權重表達同一件事（與 `polls.tsx` 的
       * `PollBar` 同一個手法）。0% 走另一條分支：`flex: 0` 與 `flex: 1`
       * 併存在 `overflow: hidden` 的容器裡，某些 RN 版本會把整條壓成 0。
       */}
      <View
        style={styles.barTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: state.total,
          now: state.sent,
        }}
      >
        {percent > 0 ? (
          <>
            <View style={[styles.barFill, { flex: Math.round(percent) }]} />
            <View style={{ flex: Math.max(1, 100 - Math.round(percent)) }} />
          </>
        ) : null}
      </View>

      {state.failedIds.length > 0 ? (
        <>
          <Text style={styles.lineDanger}>
            {copy.exhibitors.import.step4.failedCount(state.failedIds.length)}
          </Text>
          <Button
            label={copy.exhibitors.import.step4.retryFailed}
            variant="secondary"
            disabled={state.running}
            onPress={onRetry}
            testID="exhibitor-import-notify-retry"
          />
        </>
      ) : null}
    </View>
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
  cardDanger: { borderColor: semantic.status.danger.fg },
  cardTitleDanger: {
    ...type.caption,
    fontWeight: "600",
    color: semantic.status.danger.fg,
  },
  lineDanger: { ...type.micro, color: semantic.status.danger.fg },
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
  barTrack: {
    flexDirection: "row",
    height: 8,
    marginTop: space[1],
    borderRadius: radius.full,
    overflow: "hidden",
    backgroundColor: semantic.bg.surfaceSunken,
  },
  barFill: {
    backgroundColor: semantic.action.primary,
    borderRadius: radius.full,
  },
});
