import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { eventService } from "@/services/event.service";
import { useEventStore } from "@/stores/event.store";
import { getEventStatusLabel, EVENT_STATUS_TONE } from "@/utils/event-status";

interface StatItem {
  key: string;
  label: string;
  value: string;
  icon: IconName;
}

type EventRoute =
  | "check-in"
  | "token"
  | "registrations"
  | "nfc-bind"
  | "badges";

interface QuickAction {
  key: string;
  label: string;
  icon: IconName;
  route: EventRoute;
}

/**
 * 會議四大卡：掃碼簽到 / Token / 名單 / NFC。
 * Badge 為既有頁，保留以免深鏈才進得去。
 * Token、名單尚未實作，進 placeholder，不崩潰。
 */
const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "check-in",
    label: copy.event.scanCheckIn,
    icon: "qr-code",
    route: "check-in",
  },
  {
    key: "token",
    label: copy.event.tokenTitle,
    icon: "plus",
    route: "token",
  },
  {
    key: "registrations",
    label: copy.event.registrationsTitle,
    icon: "users",
    route: "registrations",
  },
  { key: "nfc", label: copy.nfc.writeTitle, icon: "nfc", route: "nfc-bind" },
  {
    key: "badges",
    label: copy.event.badgesTitle,
    icon: "clipboard-check",
    route: "badges",
  },
];

/** 到場率只用報名總數與已簽到數計算；分母為 0 時不顯示 0%。 */
function formatAttendanceRate(checkedIn: number, total: number): string {
  if (total <= 0) return copy.event.dash;
  return `${Math.round((checkedIn / total) * 100)}%`;
}

export default function EventOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { events } = useEventStore();
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);
  const [stats, setStats] = useState<StatItem[]>([]);

  const event = events.find((e) => e.id === eventId);
  const statusLabel = getEventStatusLabel(event?.status);
  const statusTone =
    semantic.status[EVENT_STATUS_TONE[event?.status ?? ""] ?? "neutral"];

  useEffect(() => {
    let active = true;

    async function load() {
      if (!eventId) return;
      setLoading(true);
      setBanner(null);
      try {
        const [totalRes, checkedInRes] = await Promise.all([
          eventService.getRegistrations(eventId, { limit: 1 }),
          eventService.getRegistrations(eventId, {
            limit: 1,
            status: "CHECKED_IN",
          }),
        ]);
        if (!active) return;
        const total = totalRes.pagination?.total ?? 0;
        const checkedIn = checkedInRes.pagination?.total ?? 0;
        setStats([
          {
            key: "registrations",
            label: copy.event.registrations,
            value: String(total),
            icon: "users",
          },
          {
            key: "checkedIn",
            label: copy.event.checkedIn,
            value: String(checkedIn),
            icon: "check-circle",
          },
          {
            key: "exhibitors",
            label: copy.event.exhibitors,
            value: String(event?.exhibitorCount ?? 0),
            icon: "archive",
          },
          {
            key: "attendance",
            label: copy.event.attendanceRate,
            value: formatAttendanceRate(checkedIn, total),
            icon: "check",
          },
        ]);
      } catch {
        if (!active) return;
        setBanner({ tone: "danger", message: copy.home.loadFailed });
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [eventId, event?.exhibitorCount]);

  if (!eventId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={copy.event.overviewTitle}
          leading="back"
          backFallbackPath="/(auth)/home"
        />
        <View style={styles.emptyBody}>
          <EmptyState
            kind="no-results"
            headingLevel={2}
            title={copy.event.unavailableTitle}
            description={copy.event.unavailableHint}
            testID="overview-empty"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={event?.name ?? copy.event.overviewTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
        right={
          statusLabel ? (
            <View
              style={[styles.statusBadge, { backgroundColor: statusTone.bg }]}
              accessibilityRole="text"
              accessibilityLabel={statusLabel}
            >
              <Text
                style={[type.badge, { color: statusTone.fg }]}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {statusLabel}
              </Text>
            </View>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
      >
        {banner ? (
          <InlineBanner tone={banner.tone} message={banner.message} />
        ) : null}

        {loading ? (
          <View style={styles.statGrid}>
            <Skeleton width="48%" height={96} radius={12} />
            <Skeleton width="48%" height={96} radius={12} />
            <Skeleton width="48%" height={96} radius={12} />
            <Skeleton width="48%" height={96} radius={12} />
          </View>
        ) : (
          <View style={styles.statGrid}>
            {stats.map((s) => (
              <Card key={s.key} style={styles.statCard}>
                <Icon name={s.icon} size="lg" color={semantic.icon.brand} />
                <Text style={type.h1}>{s.value}</Text>
                <Text style={[type.caption, styles.statLabel]}>{s.label}</Text>
              </Card>
            ))}
          </View>
        )}

        {!loading ? (
          <Card style={styles.tokenCard} testID="overview-token-degraded">
            <Text style={type.h3}>{copy.event.tokenTitle}</Text>
            <View style={styles.tokenRow}>
              <Text style={[type.body, styles.tokenLabel]}>
                {copy.event.tokenIssued}
              </Text>
              <Text style={type.h3}>{copy.event.dash}</Text>
            </View>
            <View style={styles.tokenRow}>
              <Text style={[type.body, styles.tokenLabel]}>
                {copy.event.tokenConsumed}
              </Text>
              <Text style={type.h3}>{copy.event.dash}</Text>
            </View>
            <Text style={[type.caption, styles.tokenHint]}>
              {copy.event.tokenDegradedHint}
            </Text>
          </Card>
        ) : null}

        <Text style={[type.h3, styles.sectionTitle]}>
          {copy.event.quickActions}
        </Text>
        <View style={styles.actionGrid}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => {
                router.push({
                  pathname: `/(auth)/[eventId]/${a.route}` as never,
                  params: { eventId: eventId ?? "" },
                });
              }}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              testID={`overview-action-${a.key}`}
            >
              <Icon name={a.icon} size="lg" color={semantic.icon.brand} />
              <Text style={[type.label, styles.actionLabel]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: semantic.bg.canvas,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.section,
    gap: spacing.section,
  },
  emptyBody: {
    flex: 1,
    padding: spacing.screen,
    justifyContent: "center",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.gap,
  },
  statCard: {
    width: "48%",
    alignItems: "center",
    gap: space[2],
  },
  statLabel: {
    color: semantic.text.muted,
  },
  tokenCard: {
    width: "100%",
    gap: space[2],
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tokenLabel: {
    color: semantic.text.secondary,
  },
  tokenHint: {
    color: semantic.text.muted,
  },
  sectionTitle: {
    marginTop: spacing.gap,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.gap,
  },
  actionCard: {
    width: "48%",
    minHeight: layout.touchMin * 2,
    backgroundColor: semantic.bg.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: spacing.card,
  },
  actionPressed: {
    backgroundColor: semantic.bg.pressedOnLight,
  },
  actionLabel: {
    textAlign: "center",
  },
});
