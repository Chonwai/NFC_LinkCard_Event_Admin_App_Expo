import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { registrationService } from "@/services/registration.service";
import type {
  ActivationLinkInfo,
  Registration,
  WalletTransactionItem,
} from "@/types/api.types";
import {
  absoluteActivationUrl,
  canIssueActivation,
  classifyIssueError,
  describeIssueResult,
} from "@/utils/registration-activation";
import { emailStatusLabel } from "@/utils/registration-email-status";
import { findRememberedRegistration } from "@/utils/registration-list-cache";
import {
  getRegistrationCheckedInAt,
  getRegistrationCode,
  getRegistrationCompany,
  getRegistrationDisplayName,
  getRegistrationTicketType,
  maskEmail,
  maskPhone,
} from "@/utils/registration-display";

/**
 * 流水一次抓多少筆。
 *
 * 後端 `limit` 上限是 100（`EventWalletController.getTransactions` 的
 * `Math.min(100, …)`）。取上限而不是預設的 20，是因為這一頁是「查一個人的帳」，
 * 分頁互動在這裡價值低；超過 100 筆時仍會以 `tokenPagingHint` 明說（S-2）。
 */
const WALLET_PAGE_SIZE = 100;

/**
 * 資料來源。
 *
 * - `list`：名單已載入的完整那一列（**首選**）。
 * - `by-code`：深連結／冷啟動時的退路——欄位較窄，擴充欄位顯示不了。
 */
type DetailSource = "list" | "by-code";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.h3}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[type.caption, styles.muted]}>{label}</Text>
      <Text style={type.body}>{value}</Text>
    </View>
  );
}

export default function RegistrantDetailScreen() {
  const insets = useSafeAreaInsets();
  const { eventId, registrationId, code } = useLocalSearchParams<{
    eventId: string;
    registrationId: string;
    code?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [source, setSource] = useState<DetailSource>("list");
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [tokenMissing, setTokenMissing] = useState(false);
  /** 後端回報的總筆數（`pagination.total`）；大於已載入筆數時要明說（S-2）。 */
  const [txTotal, setTxTotal] = useState(0);

  /* ── 帳號啟用／activation link ─────────────────────────────────────────── */
  /**
   * `null` ＝**還沒查**，不是「查不到」。兩者在畫面上必須分開：前者該顯示
   * 「查看帳號狀態」的按鈕，後者該說「查不到」。
   */
  const [activationInfo, setActivationInfo] =
    useState<ActivationLinkInfo | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);
  const [activationCopied, setActivationCopied] = useState(false);
  /**
   * 簽發前的二次確認。
   *
   * Web 沒有這一步（它的「查看帳號狀態」順手就簽發了）。這裡刻意加上：簽發會
   * 鑄出一顆可啟用帳號的 token，不該和「看一下狀態」共用同一顆按鈕。
   */
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!eventId) {
        setLoading(false);
        setError(copy.roster.loadFailed);
        return;
      }
      setLoading(true);
      setError(null);

      /**
       * 首選：名單已經載入的那一列。
       *
       * 它比 `by-code` **多** `isHidden / archivedAt / depositRefunded* /
       * emailStatus / checkedInBy`，而這些正是本頁先前只能顯示「—」的欄位。
       * 用快取也就不需要再打一次公開的 `by-code`（那條會回整包 PII）。
       */
      const remembered = findRememberedRegistration(eventId, registrationId);
      if (remembered) {
        setRegistration(remembered);
        setSource("list");
      }

      try {
        /**
         * 已經確定下來的 id。用區域變數而不是讀 `registration` state：
         * state 在這個 effect 裡是**上一次 render** 的值，剛 `setRegistration`
         * 不會立刻反映，拿它當備援等於在用一份落後的資料。
         */
        let resolvedId = remembered?.id ?? registrationId;
        if (!remembered) {
          // 退路：沒有快取（深連結／冷啟動）或根本沒有報名編號。
          // 沒有 code 就無從查起——那就只能說載入失敗，不能拿名單裡別人的資料充數。
          if (!code) throw new Error("MISSING_CODE");
          const { registration: next } = await registrationService.getByCode(
            eventId,
            code,
          );
          if (!active) return;
          setRegistration(next);
          setSource("by-code");
          resolvedId = next.id;
        }

        const walletRegistrationId = resolvedId;
        if (!walletRegistrationId) {
          // 兩條路都拿不到 id 時，只影響「Token 流水」這一區。
          setTransactions([]);
          setTxTotal(0);
          setTokenMissing(true);
          return;
        }
        try {
          const wallet = await registrationService.getWalletTransactions(
            eventId,
            walletRegistrationId,
            { page: 1, limit: WALLET_PAGE_SIZE },
          );
          if (!active) return;
          const rows = wallet.transactions ?? [];
          setTransactions(rows);
          setTxTotal(wallet.pagination?.total ?? rows.length);
          setTokenMissing(false);
        } catch {
          if (!active) return;
          setTransactions([]);
          setTxTotal(0);
          setTokenMissing(true);
        }
      } catch {
        if (!active) return;
        // 已有名單快取時，錢包失敗不該把整個畫面打成「找不到」——
        // 上面的 wallet 分支已經處理掉那種情況，走到裡代表連身份都沒拿到。
        setError(
          remembered
            ? copy.roster.loadFailed
            : copy.checkIn.registrationNotFound,
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [code, eventId, registrationId]);

  /** 這個報名的 id（簽發／探針都需要它）。`by-code` 退路也有 `id`。 */
  const activationTargetId = registration?.id ?? null;

  /**
   * **查看**帳號狀態。
   *
   * 走唯讀探針（`?readonly=1`），**不鑄 token**。與下面的簽發是兩個動作，
   * 差別寫在 `src/utils/registration-activation.ts` 的檔頭。
   */
  const loadActivationStatus = useCallback(async () => {
    if (!eventId || !activationTargetId) return;
    setActivationLoading(true);
    setActivationError(null);
    setActivationNotice(null);
    try {
      setActivationInfo(
        await registrationService.getActivationLinkStatus(
          eventId,
          activationTargetId,
        ),
      );
    } catch (cause) {
      setActivationError(copy.roster.activationErrFailed);
      void cause;
    } finally {
      setActivationLoading(false);
    }
  }, [activationTargetId, eventId]);

  /**
   * **簽發**一條可啟用帳號的連結（`?issue=1`）。
   *
   * 只有使用者按了二次確認的「確認簽發」才會走到這裡。
   */
  const issueActivation = useCallback(async () => {
    if (!eventId || !activationTargetId) return;
    setIssuing(true);
    setActivationError(null);
    setActivationNotice(null);
    setActivationCopied(false);
    try {
      const info = await registrationService.issueActivationLink(
        eventId,
        activationTargetId,
      );
      setActivationInfo(info);
      setConfirmIssue(false);
      switch (describeIssueResult(info)) {
        case "issued":
          setActivationNotice(copy.roster.activationIssued);
          break;
        case "reused":
          setActivationNotice(copy.roster.activationReused);
          break;
        case "already_active":
          setActivationNotice(copy.roster.activationAlreadyActive);
          break;
        case "no_account":
          setActivationNotice(copy.roster.activationNoAccountHint);
          break;
        default:
          setActivationError(copy.roster.activationEmpty);
      }
    } catch (cause) {
      // 與 `classifySendError` 同一條紀律：只呈現分類，不回顯後端 message。
      switch (classifyIssueError(cause)) {
        case "claimed":
          setActivationError(copy.roster.activationErrClaimed);
          break;
        case "forbidden":
          setActivationError(copy.roster.activationErrForbidden);
          break;
        case "not_found":
          setActivationError(copy.roster.activationErrNotFound);
          break;
        default:
          setActivationError(copy.roster.activationErrFailed);
      }
    } finally {
      setIssuing(false);
    }
  }, [activationTargetId, eventId]);

  const copyActivationLink = useCallback(async () => {
    const url = absoluteActivationUrl(activationInfo);
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setActivationCopied(true);
  }, [activationInfo]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={
          registration
            ? getRegistrationDisplayName(registration)
            : copy.roster.viewDetail
        }
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
      >
        {error ? <InlineBanner tone="danger" message={error} /> : null}
        {/*
          直接開啟（沒經過名單）時，後端沒有可用來補齊的端點。
          與其把那些欄位畫成永恆的「—」，不如說明缺什麼、怎麼補。
        */}
        {registration && source === "by-code" ? (
          <InlineBanner
            tone="warning"
            message={copy.roster.detailFallbackHint}
          />
        ) : null}
        {loading ? (
          <Skeleton height={180} radius={12} />
        ) : registration ? (
          <>
            <Section title={copy.roster.sectionProfile}>
              <Row
                label={copy.checkIn.attendeeName}
                value={getRegistrationDisplayName(registration)}
              />
              <Row
                label={copy.checkIn.attendeeEmail}
                value={maskEmail(
                  registration.email ?? registration.profile?.email,
                )}
              />
              <Row
                label={copy.roster.phone}
                value={maskPhone(
                  registration.phone ?? registration.profile?.phone,
                )}
              />
              <Row
                label={copy.checkIn.attendeeCompany}
                value={getRegistrationCompany(registration)}
              />
            </Section>
            <Section title={copy.roster.sectionRegistration}>
              <Row
                label={copy.checkIn.codePlaceholder}
                value={getRegistrationCode(registration)}
              />
              <Row
                label={copy.checkIn.attendeeStatus}
                value={
                  copy.roster.statusLabels[
                    registration.status as keyof typeof copy.roster.statusLabels
                  ] ?? registration.status
                }
              />
              <Row
                label={copy.checkIn.attendeeTicket}
                value={getRegistrationTicketType(registration)}
              />
              <Row
                label={copy.checkIn.attendeeRegisteredAt}
                value={registration.createdAt ?? copy.checkIn.dash}
              />
            </Section>
            <Section title={copy.roster.sectionCheckIn}>
              <Row
                label={copy.checkIn.checkedInAt}
                value={
                  getRegistrationCheckedInAt(registration) ?? copy.checkIn.dash
                }
              />
              {/*
                以下三項**只有**名單端點會回。`by-code` 沒有它們，所以直接開啟
                時不渲染——畫成「—」等於宣稱「沒有報到人員」，那是假的。
              */}
              {source === "list" ? (
                <>
                  <Row
                    label={copy.roster.emailStatus.label}
                    value={emailStatusLabel(registration.emailStatus)}
                  />
                  <Row
                    label={copy.roster.checkedInBy}
                    value={registration.checkedInBy ?? copy.checkIn.dash}
                  />
                </>
              ) : null}
            </Section>
            {/*
              帳號啟用／activation link（Web `RegistrationDetailDrawer.tsx:429-477`）。

              **查看**與**簽發**是兩顆不同的按鈕、兩條不同的路徑：
              「查看帳號狀態」帶 `?readonly=1`（純讀）；「簽發新的啟用連結」帶
              `?issue=1`（會鑄 token），且中間夾一道確認。
            */}
            <Section title={copy.roster.sectionAccount}>
              {activationInfo === null && !activationLoading ? (
                <Button
                  label={copy.roster.activationView}
                  variant="secondary"
                  disabled={!activationTargetId}
                  onPress={() => {
                    void loadActivationStatus();
                  }}
                />
              ) : null}
              {activationLoading ? (
                <Text style={[type.caption, styles.muted]}>
                  {copy.roster.activationLoading}
                </Text>
              ) : null}
              {activationError ? (
                <InlineBanner tone="danger" message={activationError} />
              ) : null}
              {activationNotice ? (
                <InlineBanner tone="success" message={activationNotice} />
              ) : null}
              {activationInfo ? (
                <>
                  <Row
                    label={copy.roster.sectionAccount}
                    value={
                      activationInfo.isActivated
                        ? copy.roster.activationActivated
                        : copy.roster.activationPending
                    }
                  />
                  {activationInfo.userId === null ? (
                    <Row
                      label={copy.roster.activationNoAccount}
                      value={copy.checkIn.dash}
                    />
                  ) : null}
                  {absoluteActivationUrl(activationInfo) ? (
                    <>
                      <Text style={[type.caption, styles.muted]}>
                        {copy.roster.activationHint(
                          activationInfo.firstName || copy.checkIn.dash,
                        )}
                      </Text>
                      {/*
                        `selectable` 讓長按可以自己選取：剪貼簿按鈕之外的第二條路，
                        按鈕壞掉時連結仍然拿得出來。
                      */}
                      <Text selectable style={styles.activationUrl}>
                        {absoluteActivationUrl(activationInfo)}
                      </Text>
                      <Pressable
                        onPress={() => {
                          void copyActivationLink();
                        }}
                        style={({ pressed }) => [
                          styles.copyButton,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={copy.roster.activationCopy}
                      >
                        <Text
                          style={styles.copyButtonText}
                          maxFontSizeMultiplier={layout.maxFontScaleFixed}
                        >
                          {activationCopied
                            ? copy.roster.activationCopied
                            : copy.roster.activationCopy}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                  {/*
                    簽發：只有「有帳號且未啟用」時才有意義（與 BE 的簽發分支
                    同一條判定）。給一顆必定什麼都不做的按鈕比不給更糟。
                  */}
                  {canIssueActivation(activationInfo) ? (
                    confirmIssue ? (
                      <>
                        <InlineBanner
                          tone="warning"
                          message={copy.roster.activationIssueWarn}
                        />
                        <Button
                          label={copy.roster.activationIssueCancel}
                          variant="secondary"
                          disabled={issuing}
                          onPress={() => setConfirmIssue(false)}
                        />
                        <Button
                          label={
                            issuing
                              ? copy.roster.activationIssuing
                              : copy.roster.activationIssueConfirm
                          }
                          loading={issuing}
                          disabled={issuing}
                          onPress={() => {
                            void issueActivation();
                          }}
                        />
                      </>
                    ) : (
                      <Button
                        label={copy.roster.activationIssue}
                        variant="secondary"
                        disabled={issuing}
                        onPress={() => setConfirmIssue(true)}
                      />
                    )
                  ) : null}
                </>
              ) : null}
            </Section>
            {source === "list" ? (
              <Section title={copy.roster.sectionVisibility}>
                <Row
                  label={copy.roster.filterVisibility}
                  value={
                    registration.isHidden
                      ? copy.roster.hiddenYes
                      : copy.roster.hiddenNo
                  }
                />
                {registration.isHidden ? (
                  <Row
                    label={copy.roster.hiddenReason}
                    value={registration.hiddenReason ?? copy.checkIn.dash}
                  />
                ) : null}
                <Row
                  label={copy.roster.archivedAt}
                  value={registration.archivedAt ?? copy.checkIn.dash}
                />
                {registration.archivedAt ? (
                  <Row
                    label={copy.roster.archivedReason}
                    value={registration.archivedReason ?? copy.checkIn.dash}
                  />
                ) : null}
              </Section>
            ) : null}
            {source === "list" ? (
              <Section title={copy.roster.sectionDeposit}>
                {registration.depositRefundedAt ? (
                  <>
                    <Row
                      label={copy.roster.depositRefundedAt}
                      value={registration.depositRefundedAt}
                    />
                    <Row
                      label={copy.roster.depositRefundedAmount}
                      value={
                        registration.depositRefundedAmount ?? copy.checkIn.dash
                      }
                    />
                    <Row
                      label={copy.roster.depositRefundedReference}
                      value={
                        registration.depositRefundedReference ??
                        copy.checkIn.dash
                      }
                    />
                    <Row
                      label={copy.roster.depositRefundedNote}
                      value={
                        registration.depositRefundedNote ?? copy.checkIn.dash
                      }
                    />
                  </>
                ) : (
                  <Row
                    label={copy.roster.depositRefundedAt}
                    value={copy.checkIn.dash}
                  />
                )}
              </Section>
            ) : null}
            <Section title={copy.roster.sectionToken}>
              {tokenMissing || transactions.length === 0 ? (
                <EmptyState
                  compact
                  kind="no-results"
                  headingLevel={2}
                  title={copy.roster.tokenEmptyTitle}
                  description={copy.roster.tokenEmptyHint}
                />
              ) : (
                <>
                  {transactions.map((tx) => (
                    <Row
                      key={tx.id}
                      label={
                        tx.sourceType
                          ? `${tx.type} · ${tx.sourceType}`
                          : tx.type
                      }
                      value={`${tx.amount} · ${copy.roster.tokenBalanceLabel} ${tx.balanceAfter}`}
                    />
                  ))}
                  {txTotal > transactions.length ? (
                    <Text style={[type.caption, styles.muted]}>
                      {copy.roster.tokenPagingHint}
                    </Text>
                  ) : null}
                </>
              )}
            </Section>
            <Section title={copy.roster.sectionNfc}>
              <EmptyState
                compact
                kind="no-results"
                headingLevel={2}
                title={copy.roster.nfcEmptyTitle}
                description={copy.roster.nfcEmptyHint}
              />
            </Section>
            <Section title={copy.roster.sectionOrg}>
              <EmptyState
                compact
                kind="no-results"
                headingLevel={2}
                title={copy.roster.orgEmptyTitle}
                description={copy.roster.orgEmptyHint}
              />
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: { padding: spacing.screen, gap: spacing.section },
  section: {
    gap: space[2],
    backgroundColor: semantic.bg.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    padding: space[4],
  },
  row: { gap: space[1] },
  muted: { color: semantic.text.muted },
  /**
   * 啟用連結本體。
   *
   * 等寬字 + 可選取：這是一串要被複製走的 token，不是給人讀的句子。長度會
   * 換行（`flexWrap` 由 Text 自動處理），不截斷——截斷的連結貼出去就是壞的。
   */
  activationUrl: {
    ...type.micro,
    color: semantic.text.secondary,
    padding: space[2],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  copyButton: {
    minHeight: layout.touchMin,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space[3],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
  },
  copyButtonText: { ...type.caption, color: semantic.text.secondary },
  pressed: { opacity: 0.72 },
});
