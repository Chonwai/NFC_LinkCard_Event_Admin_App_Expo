import { useCallback, useMemo, useState } from "react";
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
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import {
  type GuestImportFile,
  registrationService,
} from "@/services/registration.service";
import type {
  GuestImportConfirmResult,
  GuestImportMode,
  GuestImportPreview,
  TicketTypeItem,
} from "@/types/api.types";
import {
  chunkRegistrationIds,
  hasBlockingRows,
  invalidRowText,
  previewCounts,
  suggestionNames,
} from "@/utils/guest-import";

/**
 * 貴賓／VIP 名單匯入面板（對應 Web `RegistrationImportPanel`，gap G-6）。
 *
 * 四步，與 BE 端點一一對應：
 *   1. 模板（`GET …/import/template`）——純文字，交給系統分享面板
 *   2. 選檔 → 預覽（`POST …/import/preview`；**零寫入**）
 *   3. 確認匯入（`POST …/import/confirm`；`create` / `upsert`）
 *   4. 寄票（`POST …/import/notify`；自動切批，每批 ≤100）
 *
 * ## 為什麼選檔要一個新依賴
 * Web 用 `<input type="file">`。RN 沒有這個東西；`expo-document-picker` 是
 * Expo SDK 內建家族的一員（`expo install` 會裝到與 SDK 對齊的版本），
 * 是這件事在 App 上唯一的正規做法。
 *
 * ## iOS／Android 的選檔差異（**不要假裝一致**）
 * - **`type` 的語意不同**：iOS 走 UTI（`text/csv` → `public.comma-separated-values-text`），
 *   Android 走 MIME，且由各文件供應商自行回報。同一個 `.csv` 在部分 Android
 *   供應商會回 `application/octet-stream` 甚至空值。
 *   ⇒ 白名單刻意放寬到含 `application/octet-stream`；後端
 *   `createSpreadsheetUploadMiddleware` 也放行它，且真正格式由**檔案內容**
 *   （magic byte）判定，不是靠 MIME。
 * - **URI 型態不同**：iOS 回 `file://`（`copyToCacheDirectory: true` 會先複製到
 *   快取，避免分享來源被回收後讀不到）；Android 常回 `content://`，RN 的
 *   `FormData` 會經 ContentResolver 讀取，不需要先複製。
 * - **取消行為相同**：`canceled: true` 且 `assets` 為 `null`，兩端都一樣。
 */
export function GuestImportModal({
  eventId,
  ticketTypes,
  onClose,
  onImported,
}: {
  eventId: string;
  /** 名單頁已經載入的票種（用來顯示「ticketType 欄要填什麼」）。 */
  ticketTypes: TicketTypeItem[];
  onClose: () => void;
  /** 匯入成功後通知外層重新載入名單。 */
  onImported?: () => void;
}) {
  const [step, setStep] = useState<"select" | "preview" | "done">("select");
  const [file, setFile] = useState<GuestImportFile | null>(null);
  const [mode, setMode] = useState<GuestImportMode>("create");
  const [preview, setPreview] = useState<GuestImportPreview | null>(null);
  const [result, setResult] = useState<GuestImportConfirmResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notifyState, setNotifyState] = useState<{
    sent: number;
    failed: number;
  } | null>(null);

  const counts = useMemo(() => previewCounts(preview), [preview]);
  const blocking = hasBlockingRows(preview);

  /** 選檔。取消不是錯誤——不設 `error`，畫面維持原狀。 */
  const pickFile = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // 放寬是刻意的，見檔頭 iOS／Android 差異說明。
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/csv",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/octet-stream",
        ],
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
      // 換檔就作廢上一份預覽／結果，否則「確認匯入 N 筆」會對到舊檔案。
      setPreview(null);
      setResult(null);
      setNotifyState(null);
      setStep("select");
    } catch {
      setError(copy.roster.guestImport.pickFailed);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setPreview(await registrationService.previewGuestImport(eventId, file));
      setStep("preview");
    } catch {
      setError(copy.roster.guestImport.previewFailed);
    } finally {
      setBusy(false);
    }
  }, [eventId, file]);

  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const confirmed = await registrationService.confirmGuestImport(
        eventId,
        file,
        mode,
      );
      setResult(confirmed);
      setStep("done");
      onImported?.();
    } catch {
      setError(copy.roster.guestImport.confirmFailed);
    } finally {
      setBusy(false);
    }
  }, [eventId, file, mode, onImported]);

  /**
   * 寄票：**逐批**呼叫，並把「寄出幾筆、失敗幾筆」加總。
   *
   * 任何一批失敗就整段中止並回報——繼續寄下去會讓操作員看到一個「部分成功」
   * 的數字，卻不知道是哪幾筆沒收到。中止至少讓下一次重試是完整的。
   */
  const handleNotify = useCallback(async () => {
    if (!result || result.created.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const ids = result.created.map((row) => row.registrationId);
      let sent = 0;
      let failed = 0;
      for (const batch of chunkRegistrationIds(ids)) {
        const outcome = await registrationService.notifyGuestImport(
          eventId,
          batch,
        );
        sent += outcome.sent.length;
        failed += outcome.failed.length;
      }
      setNotifyState({ sent, failed });
    } catch {
      setError(copy.roster.guestImport.notifyFailed);
    } finally {
      setBusy(false);
    }
  }, [eventId, result]);

  /**
   * 模板下載。
   *
   * App 沒有「下載到資料夾」這個概念，所以把 CSV 文字交給系統分享面板
   * （存到檔案、寄給自己、丟進雲端硬碟都可以）。不新增檔案系統依賴。
   */
  const handleDownloadTemplate = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const csv =
        await registrationService.downloadGuestImportTemplate(eventId);
      await Share.share({ message: csv });
      setNotice(copy.roster.guestImport.templateReady);
    } catch {
      setError(copy.roster.guestImport.templateFailed);
    }
  }, [eventId]);

  const canConfirm = counts.valid > 0 && !blocking && !busy;

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
            <Text style={type.h3}>{copy.roster.guestImport.title}</Text>
            <Text style={styles.hint}>{copy.roster.guestImport.subtitle}</Text>

            {/* 合規告知：與 Web 一樣常駐，不可移除。 */}
            <InlineBanner
              tone="info"
              compact
              message={copy.roster.guestImport.complianceNotice}
            />

            {error ? (
              <InlineBanner tone="danger" compact message={error} />
            ) : null}
            {notice ? (
              <InlineBanner tone="success" compact message={notice} />
            ) : null}

            {/* Step 1 — 模板 + 選檔 */}
            {ticketTypes.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {copy.roster.guestImport.acceptedTicketTypes}
                </Text>
                <Text style={styles.hint}>
                  {copy.roster.guestImport.ticketTypeColumnHint}
                </Text>
                <View style={styles.chipRow}>
                  {ticketTypes.map((ticketType) => (
                    <View key={ticketType.id} style={styles.chip}>
                      <Text style={styles.chipCode}>
                        {ticketType.name ?? ticketType.id}
                      </Text>
                      <Text style={styles.chipText}>
                        {ticketType.displayName || ticketType.name || ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => void handleDownloadTemplate()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.smallButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={copy.roster.guestImport.downloadTemplate}
              >
                <Text style={styles.smallButtonText}>
                  {copy.roster.guestImport.downloadTemplate}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void pickFile()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.smallButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={copy.roster.guestImport.chooseFile}
              >
                <Text style={styles.smallButtonText}>
                  {file
                    ? copy.roster.guestImport.changeFile(file.name)
                    : copy.roster.guestImport.chooseFile}
                </Text>
              </Pressable>
            </View>

            <Button
              label={copy.roster.guestImport.preview}
              disabled={!file || busy}
              loading={busy && step === "select"}
              onPress={() => void handlePreview()}
            />

            {/* Step 2 — 預覽 */}
            {step !== "select" && preview ? (
              <>
                <View style={styles.statGrid}>
                  <Stat
                    label={copy.roster.guestImport.totalRows}
                    value={counts.total}
                  />
                  <Stat
                    label={copy.roster.guestImport.validRows}
                    value={counts.valid}
                  />
                  <Stat
                    label={copy.roster.guestImport.invalidRows}
                    value={counts.invalid}
                  />
                  <Stat
                    label={copy.roster.guestImport.duplicates}
                    value={counts.duplicates}
                  />
                </View>

                {preview.capacityImpact.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {copy.roster.guestImport.capacityHeading}
                    </Text>
                    {preview.capacityImpact.map((row) => (
                      <Text key={row.ticketType} style={styles.hint}>
                        {copy.roster.guestImport.capacityLine(
                          row.ticketType,
                          row.adding,
                          row.soldCount,
                          row.capacity,
                        )}
                        {row.wouldExceed
                          ? copy.roster.guestImport.capacityExceeded
                          : ""}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {preview.invalid.length > 0 ? (
                  <View style={[styles.card, styles.cardDanger]}>
                    <Text style={styles.cardTitleDanger}>
                      {copy.roster.guestImport.invalidHeading}
                    </Text>
                    {/* 與 Web 一樣只列前 20 列；其餘用一句話交代。 */}
                    {preview.invalid.slice(0, 20).map((row) => (
                      <View key={row.row} style={styles.invalidRow}>
                        <Text style={styles.invalidText}>
                          {invalidRowText(row)}
                        </Text>
                        {suggestionNames(row).length > 0 ? (
                          <View style={styles.chipRow}>
                            {suggestionNames(row).map((name) => (
                              <Text key={name} style={styles.suggestion}>
                                {name}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ))}
                    {preview.invalid.length > 20 ? (
                      <Text style={styles.hint}>
                        {copy.roster.guestImport.invalidMore(
                          preview.invalid.length - 20,
                        )}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Step 3 — 模式 + 確認 */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {copy.roster.guestImport.modeLabel}
                  </Text>
                  <View style={styles.actions}>
                    {(["create", "upsert"] as const).map((value) => {
                      const selected = mode === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => setMode(value)}
                          style={({ pressed }) => [
                            styles.modeChip,
                            selected && styles.modeChipOn,
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={
                            copy.roster.guestImport.mode[value]
                          }
                        >
                          <Icon
                            name={
                              selected ? "check-circle" : "information-circle"
                            }
                            size="sm"
                            color={
                              selected
                                ? semantic.status.success.fg
                                : semantic.icon.muted
                            }
                          />
                          <Text style={styles.smallButtonText}>
                            {copy.roster.guestImport.mode[value]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {blocking ? (
                  <Text style={styles.dangerHint}>
                    {copy.roster.guestImport.fixInvalidFirst}
                  </Text>
                ) : null}

                <Button
                  label={copy.roster.guestImport.confirm(counts.valid)}
                  disabled={!canConfirm}
                  loading={busy && step === "preview"}
                  onPress={() => void handleConfirm()}
                />
              </>
            ) : null}

            {/* Step 4 — 結果 + 寄票 */}
            {step === "done" && result ? (
              <>
                <View style={styles.statGrid}>
                  <Stat
                    label={copy.roster.guestImport.created}
                    value={result.created.length}
                  />
                  <Stat
                    label={copy.roster.guestImport.skipped}
                    value={result.skipped.length}
                  />
                  <Stat
                    label={copy.roster.guestImport.failed}
                    value={result.failed.length}
                  />
                </View>

                {result.created.length > 0 ? (
                  <Button
                    label={copy.roster.guestImport.notify(
                      result.created.length,
                    )}
                    variant="secondary"
                    disabled={busy || notifyState !== null}
                    loading={busy}
                    onPress={() => void handleNotify()}
                  />
                ) : null}

                {notifyState ? (
                  <Text style={styles.hint}>
                    {copy.roster.guestImport.notifyResult(
                      notifyState.sent,
                      notifyState.failed,
                    )}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Button
              label={copy.roster.guestImport.close}
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
  dangerHint: { ...type.caption, color: semantic.status.danger.fg },
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
  cardDanger: { borderColor: semantic.status.danger.fg },
  cardTitle: {
    ...type.caption,
    fontWeight: "600",
    color: semantic.text.primary,
  },
  cardTitleDanger: {
    ...type.caption,
    fontWeight: "600",
    color: semantic.status.danger.fg,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space[1] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  chipCode: { ...type.micro, color: semantic.text.primary },
  chipText: { ...type.micro, color: semantic.text.muted },
  invalidRow: { gap: space[1], paddingVertical: space[1] },
  invalidText: { ...type.micro, color: semantic.status.danger.fg },
  suggestion: {
    ...type.micro,
    paddingHorizontal: space[1],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    color: semantic.text.secondary,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    minHeight: layout.touchMin,
    paddingHorizontal: space[3],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  modeChipOn: {
    borderColor: semantic.border.interactiveSelected,
    backgroundColor: semantic.bg.brandSoft,
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
});
