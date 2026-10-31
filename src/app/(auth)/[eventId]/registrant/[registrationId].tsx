import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import { semantic, space, spacing, type } from "@/constants/theme";
import { registrationService } from "@/services/registration.service";
import type { Registration, WalletTransactionItem } from "@/types/api.types";
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
        }

        const walletRegistrationId =
          registrationId || remembered?.id || registration?.id;
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
    // `registration` 只用作 wallet 的 id 備援，放進 deps 會造成重跑迴圈。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, eventId, registrationId]);

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
});
