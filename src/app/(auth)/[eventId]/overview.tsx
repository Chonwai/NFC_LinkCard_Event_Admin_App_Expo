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

interface TokenStatItem {
  key: string;
  label: string;
  icon: IconName;
  /** 卡片強調色（發放／消耗語意） */
  tone: "issued" | "consumed";
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
  const [tokenStats, setTokenStats] = useState<TokenStatItem[]>([]);

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
            key: "attendance",
            label: copy.event.attendanceRate,
            value: formatAttendanceRate(checkedIn, total),
            icon: "check",
          },
        ]);
        setTokenStats([
          {
            key: "tokenIssued",
            label: copy.event.tokenIssued,
            icon: "plus",
            tone: "issued",
          },
          {
            key: "tokenConsumed",
            label: copy.event.tokenConsumed,
            icon: "x-circle",
            tone: "consumed",
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
  }, [eventId]);

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

  /**
   * 參展商數來自 event store，不來自本頁呼叫的登記 API，因此**在 render 時推導**。
   * 原本寫在 effect 裡，會被 `react-hooks/exhaustive-deps` 要求把
   * `event?.exhibitorCount` 列入 deps，而那個 dep 又會在 store 載入後重打
   * 兩支 API（`CRA-V1-025`）。移出 effect 後兩件事一起消失。
   * 尚未載入時顯示破折號而非 `0`，與 Token 卡同一套「未知 ≠ 零」慣例（`CRA-V1-015`）。
   */
  const exhibitorStat: StatItem = {
    key: "exhibitors",
    label: copy.event.exhibitors,
    value:
      event?.exhibitorCount == null
        ? copy.event.dash
        : String(event.exhibitorCount),
    icon: "archive",
  };
  /** 維持原本的卡片順序：報名人數 → 參展商 → 已報到 → 到場率 */
  const displayStats = [...stats];
  displayStats.splice(1, 0, exhibitorStat);

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
          <View style={styles.loadingBlock}>
            <View style={styles.statGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={`stat-skel-${index}`}
                  width="48%"
                  height={88}
                  radius={12}
                />
              ))}
            </View>
            <Skeleton width="100%" height={20} radius={6} />
            <View style={styles.statGrid}>
              <Skeleton width="48%" height={88} radius={12} />
              <Skeleton width="48%" height={88} radius={12} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.statGrid} testID="overview-stats">
              {displayStats.map((s) => (
                <Card
                  key={s.key}
                  padding={space[3]}
                  style={styles.statCard}
                  testID={`overview-stat-${s.key}`}
                >
                  <View style={styles.statHeader}>
                    <View style={styles.statIconWrap}>
                      <Icon
                        name={s.icon}
                        size="sm"
                        color={semantic.icon.brand}
                      />
                    </View>
                    <Text
                      style={styles.statLabel}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleBody}
                    >
                      {s.label}
                    </Text>
                  </View>
                  <Text
                    style={styles.statValue}
                    numberOfLines={1}
                    maxFontSizeMultiplier={layout.maxFontScaleFixed}
                  >
                    {s.value}
                  </Text>
                </Card>
              ))}
            </View>

            <View style={styles.tokenSection} testID="overview-token-degraded">
              <Text
                style={styles.sectionTitle}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {copy.event.tokenTitle}
              </Text>
              <View style={styles.statGrid}>
                {tokenStats.map((t) => {
                  const accent =
                    t.tone === "issued"
                      ? semantic.status.success
                      : semantic.status.warning;
                  return (
                    <Card
                      key={t.key}
                      padding={space[3]}
                      style={styles.statCard}
                      testID={`overview-stat-${t.key}`}
                    >
                      <View style={styles.statHeader}>
                        <View
                          style={[
                            styles.statIconWrap,
                            { backgroundColor: accent.bg },
                          ]}
                        >
                          <Icon
                            name={t.icon}
                            size="sm"
                            color={accent.fg}
                          />
                        </View>
                        <Text
                          style={styles.statLabel}
                          numberOfLines={1}
                          maxFontSizeMultiplier={layout.maxFontScaleBody}
                        >
                          {t.label}
                        </Text>
                      </View>
                      <Text
                        style={styles.statValue}
                        numberOfLines={1}
                        maxFontSizeMultiplier={layout.maxFontScaleFixed}
                        accessibilityLabel={`${t.label}：${copy.event.dash}`}
                      >
                        {copy.event.dash}
                      </Text>
                    </Card>
                  );
                })}
              </View>
              <Text
                style={styles.tokenHint}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.event.tokenDegradedHint}
              </Text>
            </View>
          </>
        )}

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
    paddingTop: space[4],
    gap: space[4],
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
  loadingBlock: {
    gap: space[3],
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    gap: space[2],
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  statIconWrap: {
    width: layout.icon.md + space[2],
    height: layout.icon.md + space[2],
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: semantic.bg.brandSoft,
  },
  statLabel: {
    ...type.label,
    color: semantic.text.secondary,
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    ...type.display,
    color: semantic.text.primary,
  },
  tokenSection: {
    gap: space[2],
  },
  tokenHint: {
    ...type.caption,
    color: semantic.text.muted,
  },
  sectionTitle: {
    ...type.h3,
    color: semantic.text.primary,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  actionCard: {
    width: "48%",
    minHeight: layout.touchMin * 1.75,
    backgroundColor: semantic.bg.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
  },
  actionPressed: {
    backgroundColor: semantic.bg.pressedOnLight,
  },
  actionLabel: {
    textAlign: "center",
  },
});
