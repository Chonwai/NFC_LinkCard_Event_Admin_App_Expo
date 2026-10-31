import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { registrationService } from "@/services/registration.service";
import type { ActivationLinkInfo, Registration } from "@/types/api.types";
import {
  type BatchSendOutcome,
  batchClaimCandidates,
  batchSummary,
  claimReason,
  classifySendError,
  isDefaultClaimRecipient,
} from "@/utils/registration-claim-batch";
import {
  getRegistrationDisplayName,
  maskEmail,
} from "@/utils/registration-display";

/**
 * 批次寄送 claim email 面板（對應 Web `BatchSendClaimEmailModal`，FE-08）。
 *
 * 三段式（`S-5` 的人工確認閘門）：`select` → `confirm` → `result`。
 * **只有 `confirm` 段的「確認寄送」會發請求**；`select` 段的「下一步」是純前端
 * 狀態轉移。這條界線是這個面板存在的理由——批次寄信不可撤回。
 *
 * ## 開啟面板會打 N 次 GET —— 那是刻意的，而且**必須**帶 `readonly=1`
 * 名單列表的回應沒有 claim 狀態，而 `A-6` 禁止新增端點，所以只能逐筆探測。
 * 那條 `GET …/activation-link` 的**預設**行為是「當場簽發 token」；少了
 * `readonly=1`，開一次面板就把每個 `pending_claim` 變成「已有有效連結」，
 * 預設收件人於是歸零（`AA-F-01`）。
 *
 * 防線放在 service：`registrationService.getActivationLinkStatus()` **沒有參數**
 * 可以傳錯，`?readonly=1` 寫死在 URL 上（`src/services/registration.service.ts`）。
 * 這個檔案因此連「不小心傳 false」都寫不出來。
 *
 * ## 為什麼是 Modal 而不是一個 route
 * 與名單管理面板同一理由：這是「不改路由、原位返回」的暫時性面板，
 * RN 內建 `Modal` 就夠，不新增 overlay 依賴。
 */
export function BatchSendClaimEmailModal({
  eventId,
  registrations,
  onClose,
  onSent,
}: {
  eventId: string;
  /** 目前畫面上**已載入**的名單（與 Web 一樣：只處理當前頁） */
  registrations: Registration[];
  onClose: () => void;
  /** 批次流程結束後通知外層重載（email 狀態可能已改變） */
  onSent?: () => void;
}) {
  const candidates = useMemo(
    () => batchClaimCandidates(registrations),
    [registrations],
  );

  const [infoById, setInfoById] = useState<
    Record<string, ActivationLinkInfo | null>
  >({});
  const [step, setStep] = useState<"select" | "confirm" | "result">("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, BatchSendOutcome>>(
    {},
  );
  const [sending, setSending] = useState(false);

  /**
   * 「還在探測」由**已探測筆數**推導，不另外存一個 state。
   *
   * 兩個理由：① 把 `setProbing` 寫在 effect 主體會在首次 render 後同步觸發
   * setState（`react-hooks/set-state-in-effect`），多一輪 render 又容易被誤用；
   * ② 推導值不會與事實脱鉤——名單在面板開著時變長（外層 refresh），`probing`
   * 會自己變回 true，不需要有人記得同步它。
   *
   * 探測失敗的列存 `null`，也算「已探測」；否則那一筆會讓面板永遠停在
   * 「正在確認 claim 狀態…」。
   */
  const probing =
    candidates.length > 0 && Object.keys(infoById).length < candidates.length;

  /**
   * 逐筆探測 claim 狀態。
   *
   * 失敗的那一筆存 `null`：它既不是預設收件人、也**不**從畫面消失——操作員要
   * 看得見「這一筆查不到狀態」而不是以為名單只有這麼短。
   */
  useEffect(() => {
    let cancelled = false;
    if (candidates.length === 0) return;
    void Promise.all(
      candidates.map(async (reg) => {
        try {
          const info = await registrationService.getActivationLinkStatus(
            eventId,
            reg.id,
          );
          return [reg.id, info] as const;
        } catch {
          return [reg.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ActivationLinkInfo | null> = {};
      const defaults: string[] = [];
      for (const [id, info] of entries) {
        next[id] = info;
        if (info && isDefaultClaimRecipient(info)) defaults.push(id);
      }
      setInfoById(next);
      setSelectedIds(defaults);
    });
    return () => {
      cancelled = true;
    };
  }, [candidates, eventId]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  /**
   * 可寄送的完整集合（`P2-1`）。
   * 「可寄送」＝既有預設資格。無帳號列**不**納入全選——補發會建帳號＋寄信，
   * 屬較重的動作，需逐一 opt-in。
   */
  const sendableIds = useMemo(
    () =>
      candidates
        .filter((reg) => {
          const info = infoById[reg.id];
          return Boolean(info && isDefaultClaimRecipient(info));
        })
        .map((reg) => reg.id),
    [candidates, infoById],
  );

  /** 被操作員手動放寬（已 claim／已有 token／無帳號）的筆數。 */
  const relaxedCount = selectedIds.filter((id) => {
    const info = infoById[id];
    return Boolean(info && !isDefaultClaimRecipient(info));
  }).length;

  const summary = batchSummary(selectedIds, outcomes);

  /**
   * 逐筆、**循序**寄送。不做任何重試（`S-4`），每一筆的結果各自記錄——
   * 自動重試會讓「到底是第幾次才成功」消失在稽核之外，而 claim 信寄兩封給同一個人
   * 是真實的使用者困擾。
   */
  const send = useCallback(async () => {
    setSending(true);
    const next: Record<string, BatchSendOutcome> = {};
    for (const id of selectedIds) {
      try {
        const result = await registrationService.resendActivationEmail(
          eventId,
          id,
        );
        next[id] = { status: "sent", sentAt: result.activationEmailSentAt };
      } catch (error) {
        next[id] = classifySendError(error);
      }
    }
    setOutcomes(next);
    setSending(false);
    setStep("result");
    onSent?.();
  }, [eventId, onSent, selectedIds]);

  const selectedRegs = candidates.filter((reg) => selectedIds.includes(reg.id));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!sending) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={type.h3}>{copy.roster.batchClaim.title}</Text>

            {step === "select" ? (
              <>
                <Text style={styles.hint}>
                  {copy.roster.batchClaim.description}
                </Text>
                {probing ? (
                  <InlineBanner
                    tone="info"
                    compact
                    message={copy.roster.batchClaim.loading}
                  />
                ) : candidates.length === 0 ? (
                  <Text style={styles.hint}>
                    {copy.roster.batchClaim.noEligible}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.counter}>
                      {copy.roster.batchClaim.recipientCount(
                        selectedIds.length,
                      )}
                    </Text>
                    <View style={styles.selectActions}>
                      <Pressable
                        onPress={() => setSelectedIds(sendableIds)}
                        disabled={sendableIds.length === 0}
                        style={({ pressed }) => [
                          styles.smallButton,
                          sendableIds.length === 0 && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.smallButtonText}>
                          {copy.roster.batchClaim.selectAllSendable(
                            sendableIds.length,
                          )}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setSelectedIds([])}
                        style={({ pressed }) => [
                          styles.smallButton,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.smallButtonText}>
                          {copy.roster.batchClaim.clearSelection}
                        </Text>
                      </Pressable>
                    </View>
                    {candidates.map((reg) => {
                      const info = infoById[reg.id];
                      const selected = selectedIds.includes(reg.id);
                      const reason = info ? claimReason(info) : null;
                      return (
                        <Pressable
                          key={reg.id}
                          onPress={() => toggle(reg.id)}
                          style={({ pressed }) => [
                            styles.row,
                            selected && styles.rowSelected,
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={copy.roster.batchClaim.selectRow(
                            getRegistrationDisplayName(reg),
                          )}
                        >
                          <Icon
                            name={
                              selected ? "check-circle" : "information-circle"
                            }
                            size="md"
                            color={
                              selected
                                ? semantic.status.success.fg
                                : semantic.icon.muted
                            }
                          />
                          <View style={styles.rowText}>
                            <Text style={styles.rowName} numberOfLines={1}>
                              {getRegistrationDisplayName(reg)}
                            </Text>
                            <Text style={styles.rowEmail} numberOfLines={1}>
                              {maskEmail(reg.email)}
                            </Text>
                            {reason ? (
                              <Text style={styles.rowReason}>
                                {copy.roster.batchClaim.reason[reason]}
                              </Text>
                            ) : (
                              <Text style={styles.rowReason}>
                                {copy.roster.batchClaim.outcome.failed}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                    {selectedIds.some((id) => {
                      const info = infoById[id];
                      return info ? claimReason(info) === "no_account" : false;
                    }) ? (
                      <Text style={styles.hint}>
                        {copy.roster.batchClaim.noAccountHint}
                      </Text>
                    ) : null}
                  </>
                )}
              </>
            ) : null}

            {step === "confirm" ? (
              <>
                <Text style={styles.confirmTitle}>
                  {copy.roster.batchClaim.confirmTitle}
                </Text>
                <Text style={styles.hint}>
                  {copy.roster.batchClaim.confirmBody(selectedIds.length)}
                </Text>
                {relaxedCount > 0 ? (
                  <InlineBanner
                    tone="warning"
                    compact
                    message={copy.roster.batchClaim.confirmRelaxed(
                      relaxedCount,
                    )}
                  />
                ) : null}
                {selectedRegs.map((reg) => (
                  <Text
                    key={reg.id}
                    style={styles.confirmRow}
                    numberOfLines={1}
                  >
                    {`· ${getRegistrationDisplayName(reg)} · ${maskEmail(reg.email)}`}
                  </Text>
                ))}
              </>
            ) : null}

            {step === "result" ? (
              <>
                <Text style={styles.confirmTitle}>
                  {copy.roster.batchClaim.resultTitle}
                </Text>
                <Text style={styles.counter}>
                  {copy.roster.batchClaim.resultSummary(
                    summary.success,
                    summary.failed,
                  )}
                </Text>
                {selectedRegs.map((reg) => {
                  const outcome = outcomes[reg.id];
                  const sent = outcome?.status === "sent";
                  return (
                    <View key={reg.id} style={styles.resultRow}>
                      <Icon
                        name={sent ? "check-circle" : "x-circle"}
                        size="sm"
                        color={
                          sent
                            ? semantic.status.success.fg
                            : semantic.status.danger.fg
                        }
                      />
                      <View style={styles.rowText}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {getRegistrationDisplayName(reg)}
                        </Text>
                        <Text style={styles.rowReason}>
                          {outcome
                            ? copy.roster.batchClaim.outcome[outcome.status]
                            : copy.roster.batchClaim.outcome.failed}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}

            <View style={styles.footer}>
              {step === "select" ? (
                <>
                  <Button
                    label={copy.roster.batchClaim.back}
                    variant="secondary"
                    onPress={onClose}
                  />
                  <Button
                    label={copy.roster.batchClaim.next}
                    disabled={probing || sending || selectedIds.length === 0}
                    onPress={() => setStep("confirm")}
                  />
                </>
              ) : step === "confirm" ? (
                <>
                  <Button
                    label={copy.roster.batchClaim.back}
                    variant="secondary"
                    disabled={sending}
                    onPress={() => setStep("select")}
                  />
                  <Button
                    label={
                      sending
                        ? copy.roster.batchClaim.sending
                        : copy.roster.batchClaim.confirmSend
                    }
                    loading={sending}
                    disabled={sending}
                    onPress={() => {
                      void send();
                    }}
                  />
                </>
              ) : (
                <Button
                  label={copy.roster.batchClaim.close}
                  onPress={onClose}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  counter: {
    ...type.caption,
    color: semantic.text.secondary,
    fontWeight: "600",
  },
  selectActions: { flexDirection: "row", gap: space[2], flexWrap: "wrap" },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: layout.touchMin,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  rowSelected: {
    borderColor: semantic.border.interactiveSelected,
    backgroundColor: semantic.bg.brandSoft,
  },
  rowText: { flex: 1, minWidth: 0, gap: space[1] },
  rowName: { ...type.body, color: semantic.text.primary },
  rowEmail: { ...type.micro, color: semantic.text.muted },
  rowReason: { ...type.micro, color: semantic.text.secondary },
  confirmTitle: {
    ...type.body,
    fontWeight: "600",
    color: semantic.text.primary,
  },
  confirmRow: { ...type.caption, color: semantic.text.secondary },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingVertical: space[1],
  },
  footer: { gap: space[2], paddingTop: space[2] },
});
