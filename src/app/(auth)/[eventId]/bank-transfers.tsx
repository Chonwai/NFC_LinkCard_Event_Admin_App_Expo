import { type ReactNode, useEffect, useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldInput } from "@/components/ui/FieldInput";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { bankTransferService } from "@/services/bank-transfer.service";
import { eventService } from "@/services/event.service";
import type {
  BankTransferApproval,
  BankTransferDecision,
  BankTransferStatusFilter,
} from "@/types/bankTransfer.types";
import {
  bankTransferStatusLabel,
  bankTransferTabCounts,
  formatBankTransferPersonName,
} from "@/utils/bank-transfer-display";
import {
  buildReviewConfirmation,
  buildReviewRequest,
  classifyBankTransferReviewError,
  type BankTransferReviewConfirmation,
  type BankTransferReviewIntent,
} from "@/utils/bank-transfer-review";

/**
 * 銀行轉賬審批（parity `bank-transfers`）。
 *
 * 前端 counterpart：
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/bank-transfers/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * ## 這一頁會放行款項
 *
 * 批准一筆匯款＝把那筆報名推進到已付款、併發放票種的 `initialTokens`；
 * 拒絕＝讓那筆報名維持／變成 `REJECTED`。兩者都在後端的同一個 transaction
 * 內完成，且用 `status: PENDING` 當條件（`EventRegistrationService:1155-1160`）。
 * 所以**只有 `PENDING` 的資料列**會出現動作鈕——與 Web 的
 * `{approval.status === 'PENDING' && (...)}` 一致。已核過的資料列顯示狀態徽章
 * 就好，不提供註定失敗的按鈕。
 *
 * ### 與 Web 唯一的行為差異：兩個動作都多一道確認
 *
 * Web 對「批准」**沒有任何確認**（一按就送），對「拒絕」用 `window.prompt`
 * 收原因。這一頁兩者都要二次確認，理由是這兩個動作都不可逆：後端對非
 * `PENDING` 一律回 `BANK_TRANSFER_ALREADY_REVIEWED`，沒有任何介面能把已批的
 * 匯款退回待核。確認框顯示「誰、多少錢、哪一筆」——那是唯一能讓人發現
 * 「點錯列」的資訊。
 *
 * Web 的 `prompt` 還有一個更貴的坑：使用者按「取消」時 `prompt` 回 `null`，
 * 而 `null ?? undefined` 之後**照樣送出 `REJECTED`**——「取消」等於「無理由
 * 拒絕」，而且沒有任何提示。App 的取消就是取消（不建立意圖，什麼都不送）。
 *
 * ## 分頁：照 Web 不送 page／limit（一個已知的落差）
 *
 * 後端預設 `limit=20`，而 Web 的 `load()` 只送 `{ status }`，也沒有下一頁。
 * App 照做（不送），因此**第 21 筆以後在兩邊都看不到**。這是 Web 既有的限制，
 * 不是本頁漏做；把它寫在這裡，是因為「看不到」與「後台沒有」在現場長得一樣。
 *
 * ## 為什麼失敗要講出來（與 Web 不同）
 *
 * Web 的 `load()` 是 `catch { /* ignore *\/ }`：失敗時畫面收成
 * 「暫無待審批的轉賬記錄」——**看起來跟真的一筆都沒有完全一樣**。這一頁處理的
 * 是錢，把「讀不到」講成「沒有人匯款」會直接導致誤判。App 分成兩條：載入失敗
 * 給橫幅（可重新整理），查無資料才給 EmptyState。理由同 `polls.tsx` /
 * `ticket-types.tsx`。
 *
 * ## 計數走 `manage-stats`（一次請求）
 *
 * Web 曾在 QA EV-04 修掉「每個頁籤各打一次 `limit: 1`」的做法，改用
 * `GET /manage-stats` 的 `bankTransfers`。App 用同一支
 * （`eventService.getEventManageStats`），而且**計數與清單分兩條 effect**：
 * 切頁籤時 Web 不會重打計數（`useManageStats` 有它自己的 reload 時機），
 * 這裡也一樣。計數失敗（例如 OPERATOR 被 403）不影響清單——清單自己會顯示
 * 權限錯誤。
 *
 * ## 憑證怎麼看
 *
 * Web 是 `<a target="_blank">` 的縮圖。App 沒有「新分頁」這個概念，改成
 * 一顆「查看轉賬憑證」把 `proofUrl` 交給系統瀏覽器（`Linking.openURL`，
 * react-native 內建，**不新增依賴**）。功能等價（看得到同一張圖），差別只在
 * 不在頁內內嵌縮圖——`noProof` 的資料列照 Web 顯示「無憑證」。
 *
 * ## 為什麼重新整理走 `reloadKey`
 *
 * 與 `polls.tsx` / `content.tsx` / `ticket-types.tsx` 同一個理由：標頭的重新
 * 整理鈕不能在 effect 外直接呼叫會 `setState` 的載入函式
 * （`react-hooks/set-state-in-effect`），所以把「重載」表達成「把 key 加一」。
 */
export default function EventBankTransfersScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  /** 與 Web 相同：預設就停在「待審批」。 */
  const [statusFilter, setStatusFilter] =
    useState<BankTransferStatusFilter>("PENDING");
  const [approvals, setApprovals] = useState<BankTransferApproval[]>([]);
  const [counts, setCounts] = useState<Record<
    BankTransferStatusFilter,
    number
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [proofError, setProofError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * 待確認的覆核意圖。
   *
   * 按下「批准」只會**建立意圖**，不會送出任何請求；唯一的送出點是確認框的
   * `onConfirm`（見 `submitReview`）。這是「確認前的狀態不會被送出」的實作位置。
   *
   * 存的是按下當下的快照（含人名與金額）。清單在確認期間若被重新整理，
   * 快照不會跟著變——但送出的是 `approval.id`，後端以資料庫現況為準，
   * 過期的意圖只會換得 `BANK_TRANSFER_ALREADY_REVIEWED`，不會錯放行。
   */
  const [pendingReview, setPendingReview] =
    useState<BankTransferReviewIntent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);

  // 清單：跟著頁籤與重新整理走。
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await bankTransferService.listApprovals(eventId, {
          // Web 是 `status: statusFilter || undefined`：空字串＝「全部」＝不帶參數。
          status: statusFilter === "" ? undefined : statusFilter,
        });
        if (cancelled) return;
        setApprovals(data.approvals ?? []);
        setLoadError(false);
      } catch {
        if (cancelled) return;
        // 只說「載入失敗」，不把後端原文倒到畫面上。
        setLoadError(true);
        setApprovals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, statusFilter, reloadKey]);

  // 計數：**不**跟著頁籤走（Web 也不重抓）。失敗就當作沒有數字，不擋清單。
  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      try {
        const stats = await eventService.getEventManageStats(eventId);
        if (cancelled) return;
        setCounts(bankTransferTabCounts(stats));
      } catch {
        if (cancelled) return;
        // `null` ＝ 不顯示數字（不是 0）：讀不到與真的是 0 是兩件事。
        setCounts(null);
      }
    }

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  async function openProof(approval: BankTransferApproval) {
    try {
      await Linking.openURL(approval.proofUrl);
      setProofError(false);
    } catch {
      setProofError(true);
    }
  }

  /** 建立意圖（不送出）。批准與拒絕都經過這裡。 */
  function requestReview(
    approval: BankTransferApproval,
    decision: BankTransferDecision,
  ) {
    setFeedback(null);
    setPendingReview({ approval, decision, reason: "" });
  }

  /**
   * 唯一的送出點。
   *
   * `buildReviewRequest(..., { confirmed })` 在 `confirmed === false` 時回
   * `null`——所以「意圖存在但還沒確認」這個狀態**不可能**產生請求。
   * 這裡保留 `confirmed` 參數而不是讓呼叫端自己判斷，是為了讓那條規則住在
   * `utils/bank-transfer-review.ts`（可被 `node:test` 釘住），而不是住在畫面裡。
   */
  async function submitReview(intent: BankTransferReviewIntent) {
    const request = buildReviewRequest(intent, { confirmed: true });
    if (request == null) return;

    setSubmitting(true);
    try {
      await bankTransferService.review(
        eventId,
        request.approvalId,
        request.decision,
        request.reviewNote,
      );
      setPendingReview(null);
      setFeedback({
        tone: "success",
        message:
          request.decision === "APPROVED"
            ? copy.bankTransfers.approveSuccess
            : copy.bankTransfers.rejectSuccess,
      });
      // 與 Web 一樣：成功後重新載入清單（金額是後端重算的，不能拿回應拼本地狀態）。
      setReloadKey((key) => key + 1);
    } catch (error) {
      const outcome = classifyBankTransferReviewError(error);
      setPendingReview(null);
      setFeedback({
        tone: "danger",
        message: copy.bankTransfers.reviewErrors[outcome.kind],
      });
      // 這一列已經不是我們以為的樣子（被別人審完了／不見了）⇒ 一定要重讀。
      if (outcome.kind === "alreadyReviewed" || outcome.kind === "notFound") {
        setReloadKey((key) => key + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const totalForFilter = counts?.[statusFilter] ?? approvals.length;
  /** 確認框要顯示的內容；沒有待確認的意圖時是 `null`。 */
  const confirmation =
    pendingReview == null ? null : buildReviewConfirmation(pendingReview);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.bankTransfers.title}
        subtitle={copy.bankTransfers.subtitle}
        leading="back"
        onRefresh={() => setReloadKey((key) => key + 1)}
        isRefreshing={loading}
        testID="bank-transfers-header"
      />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.screen },
        ]}
      >
        <ChoiceChips
          label={copy.bankTransfers.title}
          options={STATUS_TABS}
          value={statusFilter}
          labelFor={(value) => tabLabel(value, counts)}
          onSelect={setStatusFilter}
          testID="bank-transfers-filter"
        />

        <Text style={styles.total} testID="bank-transfers-total">
          {copy.bankTransfers.total(totalForFilter)}
        </Text>

        {proofError ? (
          <InlineBanner
            compact
            tone="danger"
            message={copy.bankTransfers.proofOpenFailed}
            dismissible
            onDismiss={() => setProofError(false)}
          />
        ) : null}

        {feedback ? (
          <InlineBanner
            compact
            tone={feedback.tone}
            message={feedback.message}
            dismissible
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        {loadError ? (
          <InlineBanner
            compact
            tone="danger"
            message={copy.bankTransfers.loadError}
            actionLabel={copy.common.refresh}
            onAction={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {loading ? (
          <View style={styles.skeletonGroup}>
            {[0, 1].map((index) => (
              <Skeleton key={index} height={112} />
            ))}
          </View>
        ) : approvals.length === 0 ? (
          // 載入失敗時不要同時給「暫無待審批」——那會把失敗說成事實。
          loadError ? null : (
            <EmptyState
              kind="first-use"
              headingLevel={2}
              icon="empty-card"
              title={
                statusFilter === "PENDING"
                  ? copy.bankTransfers.emptyPending
                  : copy.bankTransfers.emptyGeneric
              }
            />
          )
        ) : (
          <View style={styles.list}>
            {approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onOpenProof={() => void openProof(approval)}
                onApprove={() => requestReview(approval, "APPROVED")}
                onReject={() => requestReview(approval, "REJECTED")}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {pendingReview && confirmation ? (
        <ReviewDialog
          confirmation={confirmation}
          title={
            pendingReview.decision === "APPROVED"
              ? copy.bankTransfers.approveConfirm.title
              : copy.bankTransfers.rejectConfirm.title
          }
          intro={
            pendingReview.decision === "APPROVED"
              ? copy.bankTransfers.approveConfirm.intro
              : copy.bankTransfers.rejectConfirm.intro
          }
          confirmLabel={
            pendingReview.decision === "APPROVED"
              ? copy.bankTransfers.approveConfirm.confirm
              : copy.bankTransfers.rejectConfirm.confirm
          }
          busy={submitting}
          tone={pendingReview.decision === "APPROVED" ? "primary" : "danger"}
          onConfirm={() => void submitReview(pendingReview)}
          onCancel={() => setPendingReview(null)}
          testID={`bank-transfer-${pendingReview.decision === "APPROVED" ? "approve" : "reject"}-confirm`}
        >
          {pendingReview.decision === "REJECTED" ? (
            <View style={styles.reasonBlock}>
              <FieldInput
                label={copy.bankTransfers.rejectConfirm.reasonLabel}
                value={pendingReview.reason}
                onChangeText={(text) =>
                  setPendingReview((current) =>
                    current == null ? null : { ...current, reason: text },
                  )
                }
                placeholder={copy.bankTransfers.rejectConfirm.reasonPlaceholder}
                multiline
                editable={!submitting}
                testID="bank-transfer-reject-reason"
              />
              {confirmation.reason === "" ? (
                <Text style={styles.confirmNote}>
                  {copy.bankTransfers.rejectConfirm.noReason}
                </Text>
              ) : null}
            </View>
          ) : null}
        </ReviewDialog>
      ) : null}
    </View>
  );
}

/** 四個頁籤的值（順序即畫面順序，照 Web 的 `STATUS_TABS`）。 */
const STATUS_TABS: readonly BankTransferStatusFilter[] = [
  "",
  "PENDING",
  "APPROVED",
  "REJECTED",
];

/**
 * 頁籤文字（有計數時附在後面）。
 *
 * Web 是「文字 + 灰底數字膠囊」，手機上把數字併進字裡比較省空間，也讓
 * 讀屏把它念成一整句。計數還沒到（`null`）時只顯示文字——不顯示 0。
 */
function tabLabel(
  value: BankTransferStatusFilter,
  counts: Record<BankTransferStatusFilter, number> | null,
): string {
  const label =
    value === "" ? copy.bankTransfers.tabs.all : bankTransferStatusLabel(value);
  if (counts == null) return label;
  return `${label} ${counts[value]}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return copy.event.dash;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

/**
 * 一筆匯款。
 *
 * 資訊順序照 Web：憑證 → 人名 → email → 狀態徽章 → 報名碼 → 提交時間 → 金額。
 * 金額維持 `currency amount` 兩個字串直接相接（`MOP 1500.50`），**不四捨五入、
 * 不轉數字**：那是後端重算後的字串（見 `types/bankTransfer.types.ts` 檔頭）。
 */
function ApprovalCard({
  approval,
  onOpenProof,
  onApprove,
  onReject,
}: {
  approval: BankTransferApproval;
  onOpenProof: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card testID={`bank-transfer-card-${approval.id}`}>
      <View style={styles.cardHead}>
        <View style={styles.cardIdentity}>
          <Text style={styles.person}>
            {formatBankTransferPersonName(approval.registration)}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {approval.registration.email}
          </Text>
        </View>
        <StatusBadge status={approval.status} />
      </View>

      <View style={styles.metaBlock}>
        <InfoLine
          label={copy.bankTransfers.registrationCode}
          value={approval.registration.registrationCode}
          monospace
        />
        <InfoLine
          label={copy.bankTransfers.submittedAt}
          value={formatDateTime(approval.submittedAt)}
        />
        {approval.bankRef ? (
          <InfoLine
            label={copy.bankTransfers.bankRef}
            value={approval.bankRef}
          />
        ) : null}
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>{copy.bankTransfers.amount}</Text>
        <Text
          style={styles.amount}
          testID={`bank-transfer-amount-${approval.id}`}
        >
          {approval.currency} {approval.amount}
        </Text>
      </View>

      {approval.proofUrl ? (
        <Button
          label={copy.bankTransfers.viewProof}
          variant="secondary"
          onPress={onOpenProof}
          testID={`bank-transfer-proof-${approval.id}`}
        />
      ) : (
        <Text style={styles.noProof}>{copy.bankTransfers.noProof}</Text>
      )}

      {/* 只有 PENDING 才有動作鈕（與 Web 同一個條件）：已核過的列不提供註定失敗的按鈕。 */}
      {approval.status === "PENDING" ? (
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button
              label={copy.bankTransfers.reject}
              variant="danger"
              onPress={onReject}
              testID={`bank-transfer-reject-${approval.id}`}
            />
          </View>
          <View style={styles.actionButton}>
            <Button
              label={copy.bankTransfers.approve}
              variant="primary"
              onPress={onApprove}
              testID={`bank-transfer-approve-${approval.id}`}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * 覆核的二次確認框。
 *
 * 形狀照 `ticket-types.tsx` / `content.tsx` 的 `ConfirmDialog`：自繪 `Modal`、
 * 按鈕順序「主動作在上、取消在下」。不用 RN 的 `Alert.alert`（全案沒有用過它）。
 *
 * 三個欄位（報名者／金額／報名碼）不是裝飾：這是**放行款項**，而唯一能在按下
 * 確認前發現「點錯列」的資訊就是「誰、多少錢、哪一筆」。文字由
 * `buildReviewConfirmation` 產生（可被測試），這裡只負責畫。
 */
function ReviewDialog({
  confirmation,
  title,
  intro,
  confirmLabel,
  busy,
  tone,
  onConfirm,
  onCancel,
  testID,
  children,
}: {
  confirmation: BankTransferReviewConfirmation;
  title: string;
  intro: string;
  confirmLabel: string;
  busy: boolean;
  tone: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  testID: string;
  /** 決定相關的額外欄位（拒絕時的原因輸入框）。 */
  children?: ReactNode;
}) {
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
          <Text style={type.h3}>{title}</Text>
          <Text style={styles.confirmNote}>{intro}</Text>

          <View style={styles.confirmRow}>
            <Text style={styles.infoLabel}>
              {copy.bankTransfers.approveConfirm.personLabel}
            </Text>
            <Text style={styles.confirmLine}>{confirmation.person}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.infoLabel}>
              {copy.bankTransfers.approveConfirm.amountLabel}
            </Text>
            <Text style={styles.confirmLine} testID={`${testID}-amount`}>
              {confirmation.amount}
            </Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.infoLabel}>
              {copy.bankTransfers.approveConfirm.codeLabel}
            </Text>
            <Text style={styles.confirmLine}>
              {confirmation.registrationCode}
            </Text>
          </View>

          {children}

          <Button
            label={confirmLabel}
            variant={tone === "danger" ? "dangerSolid" : "primary"}
            loading={busy}
            onPress={onConfirm}
            testID={`${testID}-confirm`}
          />
          <Button
            label={copy.bankTransfers.cancel}
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
            testID={`${testID}-cancel`}
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * 狀態徽章。
 *
 * 用 `semantic.status.*`，不自己挑顏色：`contrast` 閘門驗的是 token 組合，
 * 自創的 hex 不會被它守到。對照 Web 的 amber／emerald／rose 三色。
 */
function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PENDING"
      ? semantic.status.warning
      : status === "APPROVED"
        ? semantic.status.success
        : status === "REJECTED"
          ? semantic.status.danger
          : semantic.status.neutral;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      <Text style={[styles.badgeLabel, { color: tone.fg }]}>
        {bankTransferStatusLabel(status)}
      </Text>
    </View>
  );
}

function InfoLine({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, monospace && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  skeletonGroup: { gap: spacing.gap },
  list: { gap: spacing.gap },
  total: { ...type.caption, color: semantic.text.muted },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space[2],
  },
  cardIdentity: { flex: 1, minWidth: 0 },
  person: { ...type.label, color: semantic.text.primary },
  email: { ...type.caption, color: semantic.text.secondary },
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeLabel: { ...type.caption },
  metaBlock: { gap: space[1] },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  infoLabel: { ...type.caption, color: semantic.text.muted },
  infoValue: { ...type.caption, color: semantic.text.primary },
  mono: { fontVariant: ["tabular-nums"] },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space[2],
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  amountLabel: { ...type.caption, color: semantic.text.muted },
  amount: { ...type.label, color: semantic.text.primary },
  noProof: { ...type.caption, color: semantic.text.muted },
  /**
   * 卡片內動作列。
   *
   * 與 `ticket-types.tsx` / `polls.tsx` 同一個處理：加上分隔線，否則按鈕會
   * 看起來像屬於上面那行字。
   */
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space[2],
    marginTop: space[2],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  /** 動作鈕不撐滿卡片寬度（`Button` 預設 `fullWidth`），用外層限寬。 */
  actionButton: { minWidth: layout.touchMin * 2.6 },

  // ── 二次確認彈窗 ──────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: semantic.bg.scrim,
    justifyContent: "center",
    padding: spacing.screen,
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    padding: spacing.screen,
    gap: spacing.gap,
    maxHeight: "88%",
  },
  confirmRow: { gap: space[1] },
  confirmLine: { ...type.label, color: semantic.text.primary },
  confirmNote: { ...type.caption, color: semantic.text.secondary },
  reasonBlock: { gap: space[1] },
});
