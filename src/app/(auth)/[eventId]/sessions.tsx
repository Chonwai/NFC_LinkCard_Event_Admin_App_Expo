import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
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
import { sessionService } from "@/services/session.service";
import type { EventSession } from "@/types/session.types";

/**
 * 場次管理（parity `sessions`）。
 *
 * 前端 counterpart：
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/sessions/page.tsx`。
 *
 * ## ⚠️ 這一頁沒有「刪除」按鈕，而且那不是還沒做
 *
 * Web 有刪除按鈕但後端無 `DELETE /sessions/:sessionId`
 * （`LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:27-49`
 * 沒有這條），而 Web 的 `handleDelete`
 * （`sessions/page.tsx:315-319`）呼叫 `deleteSession`
 * （`lib/events/sessions.ts:142-144`）是**活的**——所以 Web 那顆按下去是 404。
 *
 * App 不重現一個壞掉的按鈕（見
 * `docs/analysis/adminapp-parity-20261028/12-parity-build-plan-20261029.md`
 * §12.3.2 `ESC-CRA-001`）。要恢復這個功能，得先讓後端補一條端點，
 * 並且先回答「已有報名者時是 409 還是軟刪」——那是跨 repo 的決定，
 * 不是 App 這一頁能自己解決的。
 *
 * ## 為什麼失敗要講出來
 *
 * Web 的 `load()` 是 `catch { /* ignore *\/ }`：請求失敗時畫面停在
 * 「載入中」的骨架，或收成一個空狀態。App 不接受這種把失敗偽裝成空的情形
 * （與 `polls.tsx` 同一個立場），所以分成兩條：載入失敗給橫幅
 * （`loadError`），查無資料才給 EmptyState。
 *
 * ## 為什麼重新整理走 `reloadKey`
 *
 * 與 `polls.tsx` / `content.tsx` / `profile.tsx` 同一個理由：標頭的重新整理鈕
 * 不能在 effect 外直接呼叫會 `setState` 的載入函式
 * （`react-hooks/set-state-in-effect`），所以把「重載」表達成「把 key 加一」，
 * 由 effect 自己監聽。載入邏輯只留一份。
 *
 * ## 後端只回已發佈的場次
 *
 * `EventSessionService.listSessions:66` 的 where 是 `{ isPublished: true }`。
 * 已取消發佈的場次**不會出現**，而且沒有任何切換方式——Web 也一樣。
 * 這是後端行為，寫在這裡是為了讓下一個人不必重新查一次才發現。
 */
export default function EventSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!eventId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const res = await sessionService.listSessions(eventId);
        if (!active) return;
        setSessions(res.sessions);
      } catch {
        if (!active) return;
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [eventId, reloadKey]);

  /** 已有資料時不重畫骨架，避免重新整理把清單閃成空白（同 `polls.tsx`）。 */
  const showSkeleton = loading && sessions.length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.sessions.title}
        subtitle={copy.sessions.subtitle}
        leading="back"
        backFallbackPath="/(auth)/[eventId]/overview"
        onRefresh={() => setReloadKey((key) => key + 1)}
        isRefreshing={loading}
      />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
      >
        {loadError ? (
          <InlineBanner
            compact
            tone="danger"
            message={copy.sessions.loadError}
          />
        ) : null}

        {showSkeleton ? (
          <View
            style={styles.skeletonGroup}
            testID="sessions-skeleton"
            accessible
            accessibilityLabel={copy.sessions.loading}
            accessibilityState={{ busy: true }}
          >
            <Skeleton height={110} radius={radius.lg} />
            <Skeleton height={110} radius={radius.lg} />
          </View>
        ) : null}

        {!showSkeleton && !loadError && sessions.length === 0 ? (
          <EmptyState
            kind="first-use"
            title={copy.sessions.empty}
            headingLevel={2}
            testID="sessions-empty"
          />
        ) : null}

        {!showSkeleton && sessions.length > 0 ? (
          <View style={styles.list}>
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * 一個場次。
 *
 * 資訊來源照 Web 的列表列（`sessions/page.tsx:355-405`）：標題、類型徽章、
 * 開始時間、講者、已報名／容量、地點。
 *
 * ## 為什麼「已報名 N / 容量」用的是 `currentCount`
 *
 * 後端列表把 `currentCount` **覆寫**成 `_count.sessionRegistrations`
 * （`EventSessionService:91-94`），也就是活列數。直接顯示即可；
 * 但**不要**拿它跟 `capacity` 相減後寫回後端——它是一個投影，不是可寫狀態。
 *
 * ## 為什麼日期沒有照 Web 用 `toLocaleString('zh-Hant')`
 *
 * Hermes 的 `Intl` 支援不保證存在，帶 locale 參數在部分裝置上會直接回
 * ISO 字串。App 全庫的既有做法是無參數 `toLocaleString()`
 * （`bank-transfers.tsx:443-448`、`check-in.tsx:62-67`），這裡照抄，
 * 不另外引入日期函式庫。
 */
function SessionCard({ session }: { session: EventSession }) {
  const tone = semantic.status.neutral;
  const capacityLabel =
    session.capacity != null
      ? String(session.capacity)
      : copy.sessions.unlimited;

  return (
    <Card testID={`session-card-${session.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{session.title}</Text>
        <View
          style={[
            styles.pill,
            { backgroundColor: tone.bg, borderColor: tone.border },
          ]}
        >
          <Text
            style={[type.badge, { color: tone.fg }]}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {copy.sessions.sessionType[session.sessionType]}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Icon name="clock" size="sm" color={semantic.icon.default} />
        <Text style={styles.metaText}>{formatDateTime(session.startDate)}</Text>
      </View>

      {session.speakerName ? (
        <Text style={styles.metaText}>
          {copy.sessions.speakerLabel(session.speakerName)}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <Icon name="users" size="sm" color={semantic.icon.default} />
        <Text style={styles.metaText}>
          {copy.sessions.registeredCount(session.currentCount, capacityLabel)}
        </Text>
      </View>

      {session.location ? (
        <Text style={styles.metaText}>{session.location}</Text>
      ) : null}
    </Card>
  );
}

/**
 * ISO → 本地時間字串。
 *
 * 與 `bank-transfers.tsx` / `check-in.tsx` 的版本同一個行為：
 * 空值給 `-`，無法解析就原樣回傳（不要顯示 `Invalid Date`）。
 */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return copy.event.dash;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  skeletonGroup: { gap: spacing.gap },
  list: { gap: spacing.gap },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
  },
  title: { ...type.body, flex: 1, color: semantic.text.primary },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    marginTop: space[2],
  },
  metaText: {
    ...type.caption,
    color: semantic.text.muted,
    marginTop: space[1],
  },
});
