import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFocusRing } from "@/components/ui/useFocusRing";
import { copy } from "@/constants/copy.zh-TW";
import {
  hairline,
  layout,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { useEventStore } from "@/stores/event.store";
import { formatCount, getCountUnavailableHint } from "@/utils/count-display";
import { getEventListPhase } from "@/utils/event-list-phase";
import { EVENT_STATUS_TONE, getEventStatusLabel } from "@/utils/event-status";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const refreshRing = useFocusRing();
  const { events, loading, loadEvents, error } = useEventStore();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * `F-02`：失敗態只能從 store 讀。
   *
   * `loadEvents()` **不 rethrow**（失敗收進 `state.error`），所以包在這裡的
   * `try/catch` 永遠不會觸發；先前是靠這個死掉的 catch 顯示橫幅，結果載入失敗
   * 與「真的沒有活動」是同一個畫面，`copy.home.loadFailed` 也就永遠不可達。
   */
  const phase = getEventListPhase({ loading, error, count: events.length });
  const loadFailed = error != null;

  const retry = useCallback(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const renderEvent = ({ item }: { item: (typeof events)[number] }) => {
    const tone = EVENT_STATUS_TONE[item.status] ?? "neutral";
    const label = getEventStatusLabel(item.status) || copy.event.unknownStatus;
    const statusToken = semantic.status[tone];
    /**
     * `CRA-V1-002`：這一屏的兩個計數只要有一個未知，就在下方補一行說明。
     * 破折號本身讀不出「真的掛零」與「沒拿到數字」的差別，而兩者的下一步不同
     * （前者不用處理，後者要去查為什麼）。
     */
    const countHint = getCountUnavailableHint(
      item.registrationCount,
      item.exhibitorCount,
    );

    return (
      <Pressable
        onPress={() => {
          useEventStore.getState().selectEvent(item.id);
          router.push({
            pathname: "/(auth)/[eventId]/overview",
            params: { eventId: item.id },
          });
        }}
        style={({ pressed }) => [
          styles.eventCard,
          pressed && styles.eventCardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.eventCardHeader}>
          <Text
            style={[type.h3, styles.eventName]}
            numberOfLines={2}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {item.name}
          </Text>
          <View
            style={[styles.statusBadge, { backgroundColor: statusToken.bg }]}
          >
            <Text
              style={[type.badge, { color: statusToken.fg }]}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {label}
            </Text>
          </View>
        </View>

        <View style={styles.eventMeta}>
          {item.userRole ? (
            <View style={styles.metaItem}>
              <Icon
                name="users"
                size={layout.icon.sm}
                color={semantic.text.muted}
              />
              <Text style={[type.caption, styles.metaText]}>
                {item.userRole.replace(/_/g, " ")}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Icon
              name="check-circle"
              size={layout.icon.sm}
              color={semantic.text.muted}
            />
            <Text style={[type.caption, styles.metaText]}>
              {formatCount(item.registrationCount)} {copy.event.registrations}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Icon
              name="users"
              size={layout.icon.sm}
              color={semantic.text.muted}
            />
            <Text style={[type.caption, styles.metaText]}>
              {formatCount(item.exhibitorCount)} {copy.event.exhibitors}
            </Text>
          </View>
        </View>
        {countHint ? (
          <Text
            style={[type.caption, styles.countHint]}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {countHint}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Logo size="sm" withWordmark wordmark={copy.app.name} />
        </View>
        <Pressable
          onPress={() => {
            void onRefresh();
          }}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel={
            refreshing ? copy.common.refreshing : copy.common.refresh
          }
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          hitSlop={space[2]}
          style={[styles.refreshButton, refreshRing.focusRingStyle]}
          {...refreshRing.focusRingProps}
        >
          {refreshing ? (
            <ActivityIndicator color={semantic.action.primary} />
          ) : (
            <Icon name="refresh" size="lg" color={semantic.icon.default} />
          )}
        </Pressable>
      </View>

      <View style={styles.bodyHeader}>
        <Text
          style={styles.pageTitle}
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={layout.maxFontScaleFixed}
        >
          {copy.home.title}
        </Text>
        <Text
          style={styles.pageSubtitle}
          numberOfLines={1}
          maxFontSizeMultiplier={layout.maxFontScaleFixed}
        >
          {copy.app.tagline}
        </Text>
      </View>

      {loadFailed ? (
        <View style={styles.bannerWrapper}>
          <InlineBanner
            tone="danger"
            message={copy.home.loadFailed}
            actionLabel={copy.home.retry}
            onAction={retry}
          />
        </View>
      ) : null}

      {phase === "loading" ? (
        <View style={styles.skeletonWrapper}>
          <Skeleton width="100%" height={96} radius={12} />
          <Skeleton width="100%" height={96} radius={12} />
          <Skeleton width="100%" height={96} radius={12} />
        </View>
      ) : phase === "empty" ? (
        <EmptyState
          icon="empty-card"
          title={copy.home.emptyTitle}
          description={copy.home.emptyHint}
          actionLabel={copy.home.retry}
          onAction={retry}
        />
      ) : phase === "list" ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: space[4] },
          ]}
          ItemSeparatorComponent={() => (
            <View style={{ height: spacing.gap }} />
          )}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: semantic.bg.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.headerHeight,
    paddingHorizontal: spacing.screen,
    paddingTop: space[1],
    paddingBottom: space[2],
    gap: space[2],
    borderBottomWidth: hairline,
    borderBottomColor: semantic.border.decorative,
  },
  headerBrand: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  refreshButton: {
    width: layout.touchMin,
    height: layout.touchMin,
    marginRight: -space[2],
    alignItems: "center",
    justifyContent: "center",
  },
  bodyHeader: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[4],
    paddingBottom: space[2],
    gap: space[1],
  },
  pageTitle: {
    ...type.h2,
    color: semantic.text.primary,
  },
  pageSubtitle: {
    ...type.caption,
    color: semantic.text.muted,
  },
  bannerWrapper: {
    paddingHorizontal: spacing.screen,
    marginBottom: space[2],
  },
  skeletonWrapper: {
    paddingHorizontal: spacing.screen,
    marginTop: space[2],
    gap: space[3],
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[2],
  },
  eventCard: {
    backgroundColor: semantic.bg.surface,
    borderRadius: 12,
    padding: spacing.card,
    gap: space[3],
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  eventCardPressed: {
    backgroundColor: semantic.bg.pressedOnLight,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space[3],
  },
  eventName: {
    flex: 1,
    minWidth: 0,
    color: semantic.text.primary,
  },
  eventMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[4],
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
  },
  metaText: {
    color: semantic.text.muted,
  },
  /** `CRA-V1-002`：只在真的出現破折號時才渲染的說明行 */
  countHint: {
    ...type.caption,
    color: semantic.text.muted,
    marginTop: space[1],
  },
  statusBadge: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
});
