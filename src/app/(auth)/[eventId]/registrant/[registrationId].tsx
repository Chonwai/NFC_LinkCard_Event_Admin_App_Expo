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
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [tokenMissing, setTokenMissing] = useState(false);
  /** 後端回報的總筆數（`pagination.total`）；大於已載入筆數時要明說（S-2）。 */
  const [txTotal, setTxTotal] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!eventId || !code) {
        setLoading(false);
        setError(copy.roster.loadFailed);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { registration: next } = await registrationService.getByCode(
          eventId,
          code,
        );
        if (!active) return;
        setRegistration(next);
        try {
          const wallet = await registrationService.getWalletTransactions(
            eventId,
            registrationId || next.id,
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
        setError(copy.checkIn.registrationNotFound);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
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
            </Section>
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
