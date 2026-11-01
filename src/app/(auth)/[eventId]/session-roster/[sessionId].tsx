import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
import type {
  SessionAttendanceState,
  SessionRegistrationsResponse,
  SessionRegistrationAttendee,
} from "@/types/session.types";
import { getApiErrorMessage } from "@/utils/api-error";
import { formatPersonName } from "@/utils/person-name";

/** 名冊每頁筆數。與 Web 相同（`registrations/page.tsx:44` 傳 `limit: 50`）。 */
const PAGE_SIZE = 50;

/**
 * 某場次的報名名冊（parity `sessions` 的名冊子頁）。
 *
 * 前端 counterpart：
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/sessions/[sessionId]/registrations/page.tsx`。
 *
 * ## 為什麼是獨立一頁而不是在場次列表展開
 *
 * Web 也是獨立一頁（有自己的標題、出席彙總與分頁）。名冊會長到幾十上百列，
 * 塞進列表卡片會讓「這一場幾個人」變成一個要滑很久才會看到的答案。
 *
 * ## 為什麼路由叫 `session-roster` 而不是 `sessions/[sessionId]/registrations`
 *
 * expo-router 的目錄結構在這個 repo 已有慣例：動態詳情頁放在**獨立資料夾**
 * （`registrant/[registrationId].tsx`），不與同名的清單頁
 * （`registrations.tsx`）放在一起。`sessions.tsx` 已經是檔案路由，
 * 再開一個 `sessions/` 目錄會讓「`sessions` 這條路由指向哪裡」變得曖昧。
 * 對外的資料契約仍是同一個端點，路徑命名不影響對等性。
 *
 * ## 後端權限
 *
 * 這條端點的路由層**沒有** role gate（`sessions-polls.routes.ts:29-33`），
 * 但 controller 自己查 `getEventOperatorAccess`
 * （`EventSessionController:76-84`）：非 OPERATOR 以上回
 * `403 INSUFFICIENT_PERMISSION`。所以 403 是正常可預期的回應，
 * 由 `getApiErrorMessage` 分類呈現，不是「載入失敗」的泛用訊息。
 */
export default function SessionRosterScreen() {
  const insets = useSafeAreaInsets();
  // 頁面參數同時包含 `eventId`（外層 `[eventId]`）與 `sessionId`（本層動態段）。
  const { eventId, sessionId } = useLocalSearchParams<{
    eventId: string;
    sessionId: string;
  }>();

  const [data, setData] = useState<SessionRegistrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  /**
   * 重新載入的觸發計數器（與 `polls.tsx` / `sessions.tsx` 同一個理由）。
   *
   * 標頭的重新整理鈕不能在 effect 外直接呼叫會 `setState` 的載入函式
   * （`react-hooks/set-state-in-effect`），所以把「重載」表達成「把 key 加一」。
   * 注意**不能**寫成 `setPage(page)`——同一個值不會觸發 effect，按了會沒反應。
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!eventId || !sessionId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const result = await sessionService.listSessionRegistrations(
          eventId,
          sessionId,
          { page, limit: PAGE_SIZE },
        );
        if (!active) return;
        setData(result);
      } catch (error) {
        if (!active) return;
        setData(null);
        setLoadError(
          getRosterErrorMessage(error, copy.sessions.registrations.loadError),
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [eventId, sessionId, page, reloadKey]);

  const showSkeleton = loading && data == null;
  const attendees = data?.registrations ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.sessions.registrations.title}
        subtitle={data?.session.title}
        leading="back"
        backFallbackPath="/(auth)/home"
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
          <InlineBanner compact tone="danger" message={loadError} />
        ) : null}

        {data ? (
          <Card>
            <Text style={styles.sessionTitle}>{data.session.title}</Text>
            <Text style={styles.meta}>
              {formatDateTime(data.session.startDate)}
              {data.session.location ? ` · ${data.session.location}` : ""}
            </Text>
            <Text style={styles.count}>
              {copy.sessions.registeredCount(
                data.session.registeredCount,
                data.session.capacity != null
                  ? String(data.session.capacity)
                  : copy.sessions.unlimited,
              )}
            </Text>
          </Card>
        ) : null}

        {/*
          `attendance` 只有新版後端會回。舊版沒有這個區塊時整段不出現——
          這是 Web 也在做的退化（`registrations/page.tsx:129`），
          不是 App 的額外取捨。
        */}
        {data?.attendance ? (
          <View style={styles.summaryRow}>
            <SummaryChip
              label={copy.sessions.registrations.summaryAttended(
                data.attendance.attended,
              )}
              tone={semantic.status.success}
              testID="roster-summary-attended"
            />
            <SummaryChip
              label={copy.sessions.registrations.summaryRegistered(
                data.attendance.registered,
              )}
              tone={semantic.status.neutral}
              testID="roster-summary-registered"
            />
            <SummaryChip
              label={copy.sessions.registrations.summaryNoShow(
                data.attendance.noShow,
              )}
              tone={semantic.status.danger}
              testID="roster-summary-no-show"
            />
          </View>
        ) : null}

        {showSkeleton ? (
          <View
            style={styles.skeletonGroup}
            testID="roster-skeleton"
            accessible
            accessibilityLabel={copy.sessions.loading}
            accessibilityState={{ busy: true }}
          >
            <Skeleton height={96} radius={radius.lg} />
            <Skeleton height={96} radius={radius.lg} />
            <Skeleton height={96} radius={radius.lg} />
          </View>
        ) : null}

        {!showSkeleton && !loadError && attendees.length === 0 ? (
          <EmptyState
            kind="first-use"
            title={copy.sessions.registrations.empty}
            headingLevel={2}
            testID="roster-empty"
          />
        ) : null}

        {attendees.length > 0 ? (
          <View style={styles.list}>
            {attendees.map((item) => (
              <AttendeeCard key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {data && totalPages > 1 ? (
          <View style={styles.pagination}>
            <Text style={styles.pageInfo}>
              {copy.sessions.registrations.pageInfo(
                data.pagination.page,
                totalPages,
                data.pagination.total,
              )}
            </Text>
            <View style={styles.pageButtons}>
              <Button
                label={copy.sessions.registrations.prev}
                variant="secondary"
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                fullWidth={false}
                testID="roster-prev"
              />
              <Button
                label={copy.sessions.registrations.next}
                variant="secondary"
                onPress={() => setPage((current) => current + 1)}
                disabled={page >= totalPages || loading}
                fullWidth={false}
                testID="roster-next"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * 名冊的一列。
 *
 * Web 是 `<table>`；手機上是卡片。欄位順序照 Web 的表頭
 * （姓名 → 電郵 → 報名碼 → 票種 → 報名時間 → 出席），但用堆疊而非橫向捲動——
 * 六欄在手機上橫向捲動等於每一列都要左右拉，讀不完一列。
 */
function AttendeeCard({ item }: { item: SessionRegistrationAttendee }) {
  const state = resolveAttendanceState(item);
  const tone = attendanceTone(state);
  const ticket = item.registration.ticketType?.displayName;

  return (
    <Card testID={`roster-row-${item.id}`}>
      <View style={styles.rowHeader}>
        <Text style={styles.name}>
          {formatPersonName(
            item.registration.firstName,
            item.registration.lastName,
            item.registration.email,
          )}
        </Text>
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
            {attendanceLabel(state)}
          </Text>
        </View>
      </View>

      {item.registration.company ? (
        <Text style={styles.company}>{item.registration.company}</Text>
      ) : null}

      <Text style={styles.meta}>{item.registration.email}</Text>
      <Text style={styles.meta}>{item.registration.registrationCode}</Text>
      <Text style={styles.meta}>
        {copy.sessions.registrations.ticket}：{ticket ?? copy.event.dash}
      </Text>
      <Text style={styles.meta}>
        {copy.sessions.registrations.registeredAt}：
        {formatDateTime(item.createdAt)}
      </Text>
    </Card>
  );
}

/** 出席彙總的一顆標籤。 */
function SummaryChip({
  label,
  tone,
  testID,
}: {
  label: string;
  tone: { fg: string; bg: string; border: string };
  testID: string;
}) {
  return (
    <View
      style={[
        styles.summaryChip,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
      testID={testID}
    >
      <Text
        style={[type.badge, { color: tone.fg }]}
        maxFontSizeMultiplier={layout.maxFontScaleFixed}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * 三態出席，**舊後端退化**：沒有 `attendanceState` 時只看 `attendedAt`。
 *
 * 逐字照 Web 的 `resolveAttendanceState`
 * （`registrations/page.tsx:22-27`）——同一個退化規則只留一份定義，
 * 否則兩個呼叫點遲早分岔。注意退化後**永遠不會是 `NO_SHOW`**：
 * 「未出席」需要場次結束時間才能判斷，那只有後端算得出來。
 */
function resolveAttendanceState(item: {
  attendanceState?: SessionAttendanceState;
  attendedAt?: string | null;
}): SessionAttendanceState {
  return item.attendanceState ?? (item.attendedAt ? "ATTENDED" : "REGISTERED");
}

/** 狀態 → 文案。`REGISTERED` 用「待出席」，與 Web 的 `awaiting` 同義。 */
function attendanceLabel(state: SessionAttendanceState): string {
  if (state === "ATTENDED") return copy.sessions.registrations.attended;
  if (state === "NO_SHOW") return copy.sessions.registrations.noShow;
  return copy.sessions.registrations.awaiting;
}

/** 狀態 → `semantic.status` token（與 `polls.tsx` 的狀態徽章同一套）。 */
function attendanceTone(state: SessionAttendanceState) {
  if (state === "ATTENDED") return semantic.status.success;
  if (state === "NO_SHOW") return semantic.status.danger;
  return semantic.status.neutral;
}

/**
 * 名冊的錯誤訊息。
 *
 * 與其他頁面的 `getApiErrorMessage` 用法一致，但這裡**先**判斷是不是
 * `403`：後端在非 OPERATOR 時回 `INSUFFICIENT_PERMISSION`
 * （`EventSessionController:78-84`），把它顯示成「載入失敗」會讓人以為是網路問題。
 * 這裡只是把分類講清楚，不改任何權限行為。
 */
function getRosterErrorMessage(error: unknown, fallback: string): string {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;
  if (status === 403) return copy.sessions.registrations.forbidden;
  // 其餘一律交給共用分類（`utils/api-error.ts`），不自行解析 envelope。
  return getApiErrorMessage(error, fallback);
}

/**
 * ISO → 本地時間字串。與 `sessions.tsx` / `bank-transfers.tsx` 同一個行為。
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
  sessionTitle: { ...type.body, color: semantic.text.primary },
  meta: { ...type.caption, color: semantic.text.muted, marginTop: space[1] },
  count: {
    ...type.caption,
    color: semantic.text.secondary,
    marginTop: space[2],
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  summaryChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
  },
  name: { ...type.body, flex: 1, color: semantic.text.primary },
  company: {
    ...type.caption,
    color: semantic.text.secondary,
    marginTop: space[1],
  },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  pagination: {
    gap: spacing.gap,
    marginTop: space[2],
  },
  pageInfo: { ...type.caption, color: semantic.text.muted },
  pageButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space[2],
  },
});
