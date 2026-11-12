import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import {
  hairline,
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { leaderboardService } from "@/services/leaderboard.service";
import type { LeaderboardResponse } from "@/types/leaderboard.types";
import {
  buildBelowThresholdRows,
  buildLeaderboardQuery,
  buildLeaderboardRows,
  classifyLeaderboardError,
  excludedGroups,
  excludedItemViews,
  formatAsOf,
  methodologyNotes,
  resolveLeaderboardScreen,
  type LeaderboardErrorKind,
  type LeaderboardRowBar,
  type LeaderboardRowView,
  type LeaderboardScope,
} from "@/utils/leaderboard-display";

/**
 * 活動社交排行榜（主辦方看榜）。
 *
 * 設計來源：`docs/analysis/nfc-tap-attribution/20261107_Leaderboard_Design.md`
 * §8（頁規格）。後端：`GET /api/v1/events/:eventId/taps/leaderboard`。
 *
 * ## 進入點只有一個
 *
 * `overview` 頁的快速動作（設計 §8.1 明訂「單一方案」）。刻意**不做**標頭
 * overflow menu 的第二入口——雙入口要多維護一份 `backFallbackPath`，而兩者
 * 行為差異沒有任何產品意義。
 *
 * ## 版面照 `polls.tsx`，但清單用 `FlatList`
 *
 * `ScreenHeader` ＋ `InlineBanner` 的橫幅堆疊與 `polls.tsx` 同一套（含
 * `reloadKey` 計數器、`showSkeleton` 的「重新整理不閃骨架」規則）。差別是這裡的
 * 主體是長清單加兩段摺疊區，設計 §8.2 指定用 `FlatList` 的三段式
 * （`ListHeaderComponent` / `ListEmptyComponent` / `ListFooterComponent`）。
 *
 * ## 狀態矩陣全部走一支純函式
 *
 * S1–S14 的判定在 `resolveLeaderboardScreen`（`utils/leaderboard-display.ts`）。
 * 畫面只負責把布林接到元件上——原因是矩陣裡有三條**優先序**靠肉眼寫必定出錯：
 * 追蹤未啟用優先於空狀態（S11 > S6/S7）、`forbidden` 不給重試（S5）、
 * `error` 不出現空狀態（S4）。
 *
 * ## `rank: null` 的唯一出口
 *
 * 名次文字一律來自 `row.rankLabel`，而它只有一個產生點
 * （`rankBadgeLabel`，`null` ⇒ `—`）。**這個檔案裡沒有 `{row.rank}`**——
 * `tests/leaderboard-contract.test.mjs` 會從原始碼掃這件事，因為那是設計 §8.3
 * 點名的頭號實作陷阱（直接渲染會得到空白或字串 `null`）。
 */
/** 口徑型別的唯一來源在 display 層（連同 `buildLeaderboardQuery`）。 */
type ScopeValue = LeaderboardScope;

/** 身分口徑（設計 §8.2）。7 值全列，不引入 `ALL` sentinel。 */
const SCOPE_OPTIONS = ["attendees", "exhibitors", "all"] as const;

/** chip 標籤：三個口徑各一個 copy key（`Record` 缺一鍵就編譯紅，不用三元）。 */
const SCOPE_LABELS: Record<ScopeValue, string> = {
  attendees: copy.leaderboard.scopeAttendees,
  exhibitors: copy.leaderboard.scopeExhibitors,
  all: copy.leaderboard.scopeAll,
};

export default function EventLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [response, setResponse] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<LeaderboardErrorKind>("none");
  const [cohortTooLargeCount, setCohortTooLargeCount] = useState<number | null>(
    null,
  );
  const [scope, setScope] = useState<ScopeValue>("attendees");

  /**
   * 重新載入的觸發計數器。
   *
   * 與 `polls.tsx` 同一個理由：標頭的重新整理鈕與下拉刷新都不能在 handler 內
   * 直接呼叫會 `setState` 的載入函式（`react-hooks/set-state-in-effect`），
   * 所以把「重載」表達成「把 key 加一」，由 effect 自己監聽。載入邏輯只留一份。
   */
  const [reloadKey, setReloadKey] = useState(0);

  /** 目前展開複核資訊的那一列（`row.key`）；同時只能有一列展開。 */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  /** 三個摺疊區塊的開合狀態（預設全收合：主辦方先看名次，細節再展開）。 */
  const [sections, setSections] = useState({
    below: false,
    excluded: false,
    methodology: false,
  });

  /**
   * S12 橫幅可在本次瀏覽關閉，但**每次進入頁面重現**（設計 §8.4）。
   * 用 component state 表達「本次瀏覽」，不寫入 storage——寫進去就等於永久關閉
   * 一則「這個數字不是活動歸因」的誠實揭露。
   */
  const [attributionDismissed, setAttributionDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!eventId) return;
      setLoading(true);
      setErrorKind("none");
      setCohortTooLargeCount(null);
      try {
        const data = await leaderboardService.getLeaderboard(
          eventId,
          buildLeaderboardQuery(scope),
        );
        if (!active) return;
        setResponse(data);
        setExpandedKey(null);
      } catch (error) {
        if (!active) return;
        const failure = classifyLeaderboardError(error);
        // 失敗時清空榜單：留著上一次的數字配一條錯誤橫幅，會讓人以為那是即時值。
        setResponse(null);
        setErrorKind(failure.kind);
        setCohortTooLargeCount(failure.cohort);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [eventId, reloadKey, scope]);

  const rows = useMemo(
    () => (response ? buildLeaderboardRows(response) : []),
    [response],
  );
  const belowRows = useMemo(
    () => (response ? buildBelowThresholdRows(response) : []),
    [response],
  );
  const excludedGroupViews = useMemo(
    () => (response ? excludedGroups(response) : []),
    [response],
  );
  const excludedItems = useMemo(
    () => (response ? excludedItemViews(response) : []),
    [response],
  );
  const notes = useMemo(
    () =>
      response
        ? methodologyNotes(response.methodology.registrantTypesIncluded)
        : [],
    [response],
  );
  const screen = useMemo(
    () =>
      resolveLeaderboardScreen({
        loading,
        errorKind,
        cohortTooLargeCount,
        response,
      }),
    [loading, errorKind, cohortTooLargeCount, response],
  );

  /** 需要人工複核的列數（Phase 1 恆 0，見 `methodology.riskFlagsActive`）。 */
  const riskRowCount = rows.filter((row) => row.integrityFlagCount > 0).length;

  function requestReload() {
    setReloadKey((key) => key + 1);
  }

  function toggleSection(key: keyof typeof sections) {
    setSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleRow(key: string) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  const asOfText = response ? formatAsOf(response.asOf) : null;

  const header = (
    <View style={styles.header}>
      {screen.showTrackingDisabled ? (
        <InlineBanner
          compact
          tone="warning"
          message={copy.leaderboard.trackingDisabled}
          testID="leaderboard-tracking-disabled"
        />
      ) : null}

      {screen.errorKind === "cohortTooLarge" ? (
        <InlineBanner
          compact
          tone="danger"
          message={
            screen.cohortTooLargeCount === null
              ? copy.leaderboard.cohortTooLargeUnknown
              : copy.leaderboard.cohortTooLarge(screen.cohortTooLargeCount)
          }
          testID="leaderboard-cohort-too-large"
        />
      ) : null}

      {screen.errorKind === "forbidden" ? (
        <InlineBanner
          compact
          tone="danger"
          message={copy.leaderboard.forbidden}
          testID="leaderboard-forbidden"
        />
      ) : null}

      {screen.errorKind === "load" ? (
        <InlineBanner
          compact
          tone="danger"
          message={copy.leaderboard.loadError}
          actionLabel={copy.leaderboard.retry}
          onAction={requestReload}
          testID="leaderboard-load-error"
        />
      ) : null}

      {screen.staleTone !== "none" ? (
        <InlineBanner
          compact
          tone={screen.staleTone === "warning" ? "warning" : "info"}
          message={
            asOfText === null
              ? copy.leaderboard.staleWarning
              : copy.leaderboard.staleInfo(asOfText)
          }
          testID="leaderboard-stale"
        />
      ) : null}

      {screen.showAttributionNotice && !attributionDismissed ? (
        <InlineBanner
          compact
          tone="info"
          message={copy.leaderboard.attributionTimeWindow}
          dismissible
          onDismiss={() => setAttributionDismissed(true)}
          testID="leaderboard-attribution"
        />
      ) : null}

      {riskRowCount > 0 ? (
        <InlineBanner
          compact
          tone="warning"
          title={copy.leaderboard.riskBanner(riskRowCount)}
          message={copy.leaderboard.riskBannerHint}
          testID="leaderboard-risk"
        />
      ) : null}

      {screen.showSummary && response ? (
        <Card>
          <View style={styles.summaryMetrics}>
            <View style={styles.summaryBlock}>
              <Text
                style={styles.summaryValue}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {response.totals.totalUniqueVisitors}
              </Text>
              <Text style={styles.summaryLabel}>
                {copy.leaderboard.metricLabel}
              </Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text
                style={styles.summaryValue}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {response.totals.totalLeadsCaptured}
              </Text>
              <Text style={styles.summaryLabel}>
                {copy.leaderboard.secondaryMetricLabel}
              </Text>
            </View>
          </View>

          {/*
            主指標的白話定義常駐。這一句是派發硬約束指定的措辭
            （「N 位不同訪客開啟過名片（同日同裝置算一位）」），不在這裡
            出現的話，上面的數字就會被讀成「開啟次數」。
          */}
          <Text style={styles.summaryDefinition}>
            {copy.leaderboard.visitorDefinition(
              response.totals.totalUniqueVisitors,
            )}
          </Text>

          <View style={styles.summaryCounts}>
            <Text style={styles.summaryCount}>
              {copy.leaderboard.summaryCohort(response.totals.cohort)}
            </Text>
            <Text style={styles.summaryCount}>
              {copy.leaderboard.summaryRanked(response.totals.ranked)}
            </Text>
            <Text style={styles.summaryCount}>
              {copy.leaderboard.summaryBelowThreshold(
                response.totals.belowThreshold,
              )}
            </Text>
          </View>
        </Card>
      ) : null}

      <ChoiceChips
        label={copy.leaderboard.scopeLabel}
        options={SCOPE_OPTIONS}
        value={scope}
        labelFor={(value) => SCOPE_LABELS[value]}
        onSelect={setScope}
        testID="leaderboard-scope"
      />

      {rows.length > 0 ? (
        <View style={styles.columnHeader}>
          <Text style={[styles.columnLabel, styles.columnRank]}>
            {copy.leaderboard.columnRank}
          </Text>
          <Text style={[styles.columnLabel, styles.columnName]}>
            {copy.leaderboard.columnName}
          </Text>
          <Text style={[styles.columnLabel, styles.columnMetrics]}>
            {copy.leaderboard.columnVisitors}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const empty = screen.showSkeleton ? (
    <View
      style={styles.skeletonGroup}
      testID="leaderboard-skeleton"
      accessible
      accessibilityLabel={copy.leaderboard.loading}
      accessibilityState={{ busy: true }}
    >
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Skeleton
          key={`leaderboard-skeleton-${index}`}
          height={72}
          radius={radius.lg}
        />
      ))}
    </View>
  ) : screen.emptyKind === "noCohort" ? (
    <EmptyState
      kind="first-use"
      title={
        scope === "exhibitors"
          ? copy.leaderboard.emptyNoCohortExhibitors
          : copy.leaderboard.emptyNoCohort
      }
      headingLevel={2}
      testID="leaderboard-empty"
    />
  ) : screen.emptyKind === "belowThresholdOnly" && response ? (
    <EmptyState
      kind="no-results"
      title={
        scope === "exhibitors"
          ? copy.leaderboard.emptyBelowThresholdExhibitors(
              response.methodology.threshold.applied,
              response.totals.cohort,
            )
          : copy.leaderboard.emptyBelowThreshold(
              response.methodology.threshold.applied,
              response.totals.cohort,
            )
      }
      headingLevel={2}
      testID="leaderboard-empty-below-threshold"
    />
  ) : null;

  const footer = response ? (
    <View style={styles.footer}>
      {screen.showBelowThresholdSection ? (
        <CollapsibleSection
          title={copy.leaderboard.belowThresholdHeading(
            response.totals.belowThreshold,
          )}
          open={sections.below}
          onToggle={() => toggleSection("below")}
          testID="leaderboard-below-threshold"
        >
          <Text style={styles.sectionHint}>
            {copy.leaderboard.belowThresholdHint(
              response.methodology.threshold.applied,
            )}
          </Text>
          {response.belowThresholdTruncated ? (
            <Text style={styles.sectionHint}>
              {copy.leaderboard.belowThresholdTruncated(
                belowRows.length,
                response.totals.belowThreshold,
              )}
            </Text>
          ) : null}
          <View style={styles.sectionList}>
            {belowRows.map((row) => (
              <LeaderboardRow
                key={row.key}
                row={row}
                expanded={expandedKey === row.key}
                onToggle={() => toggleRow(row.key)}
              />
            ))}
          </View>
        </CollapsibleSection>
      ) : null}

      {screen.showExcludedSection ? (
        <CollapsibleSection
          title={copy.leaderboard.excludedHeading(response.excluded.total)}
          open={sections.excluded}
          onToggle={() => toggleSection("excluded")}
          testID="leaderboard-excluded"
        >
          <View style={styles.excludedGroups}>
            {excludedGroupViews.map((group) => (
              <View key={group.reason} style={styles.excludedRow}>
                <Text style={styles.excludedLabel}>{group.label}</Text>
                <Text
                  style={styles.excludedCount}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {group.count}
                </Text>
              </View>
            ))}
          </View>

          {excludedItems.length > 0 ? (
            <View style={styles.excludedItems}>
              {excludedItems.map((item) => (
                <Text key={item.key} style={styles.excludedItem}>
                  {item.displayName} · {item.reasonLabel}
                </Text>
              ))}
            </View>
          ) : null}

          {response.excluded.truncated ? (
            <Text style={styles.sectionHint}>
              {copy.leaderboard.excludedTruncated(excludedItems.length)}
            </Text>
          ) : null}
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title={copy.leaderboard.methodologyTitle}
        open={sections.methodology}
        onToggle={() => toggleSection("methodology")}
        testID="leaderboard-methodology"
      >
        {notes.map((note) => (
          <Text key={note} style={styles.methodologyNote}>
            {note}
          </Text>
        ))}
        {/* S13：異常標記尚未啟用時只說一句，不畫一個永遠空的 ⚠ 區塊。 */}
        {screen.showRiskFlagsInactive ? (
          <Text style={styles.methodologyNote}>
            {copy.leaderboard.riskFlagsInactive}
          </Text>
        ) : null}
      </CollapsibleSection>

      {rows.some((row) => row.visitorAsterisk) ? (
        <Text style={styles.asteriskNote}>
          {copy.leaderboard.sampleAsteriskNote}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.leaderboard.title}
        subtitle={copy.leaderboard.subtitle}
        leading="back"
        backFallbackPath="/(auth)/[eventId]/overview"
        onRefresh={requestReload}
        isRefreshing={loading}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <LeaderboardRow
            row={item}
            expanded={expandedKey === item.key}
            onToggle={() => toggleRow(item.key)}
          />
        )}
        ItemSeparatorComponent={RowGap}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        refreshControl={
          <RefreshControl
            refreshing={screen.refreshing}
            onRefresh={requestReload}
            tintColor={semantic.icon.brand}
          />
        }
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
        testID="leaderboard-list"
      />
    </View>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

/**
 * 一段可摺疊的區塊（樣本不足／未列入計算／方法論註記共用）。
 *
 * 為什麼不用 `Card` 的 `onPress` 版本：`Card` 的可點版本要求
 * `accessibilityLabel` 為必填、並且會加一條 chevron，語意是「點這張卡去別處」。
 * 這裡是**就地展開**，語意是 `expanded`，所以用 Pressable 當標頭、`Card` 當外框。
 */
function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
  testID,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  testID: string;
}) {
  return (
    <Card tone="sunken">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open
            ? copy.leaderboard.sectionCollapse(title)
            : copy.leaderboard.sectionExpand(title)
        }
        style={styles.sectionHeader}
        testID={testID}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size="sm"
          color={semantic.icon.default}
        />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </Card>
  );
}

/**
 * 一列（榜上與樣本不足共用，設計 §8.3）。
 *
 * 四個 below-threshold 差異全部來自 `row` 的既有欄位，這個元件**不看**
 * `sampleQuality` 或 `uniqueVisitors` 決定分流：
 *
 * | 元素 | 有名次 | `rank === null` |
 * |---|---|---|
 * | 名次徽章 | `rank` 數字 | `row.rankLabel` ＝ `—` |
 * | 裁決序 | 並列時顯示 | `row.tieBreakLabel === null` ⇒ 不顯示 |
 * | 比較條 | `row.bar` | `row.bar === null` ⇒ 不畫 |
 * | 列背景 | 前 3 名強調色 | `rowBelowThreshold`（opacity 0.85，**不用 danger 色**） |
 */
function LeaderboardRow({
  row,
  expanded,
  onToggle,
}: {
  row: LeaderboardRowView;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={[styles.row, row.belowThreshold && styles.rowBelowThreshold]}
      testID={`leaderboard-row-${row.key}`}
    >
      <View style={styles.rowTop}>
        <View
          style={[
            styles.rankBadge,
            row.rankTone === "top" && styles.rankBadgeTop,
            row.rankTone === "placeholder" && styles.rankBadgePlaceholder,
          ]}
          accessible
          accessibilityLabel={row.rankAccessibilityLabel}
          testID={`leaderboard-rank-${row.key}`}
        >
          <Text
            style={[
              styles.rankText,
              row.rankTone === "top" && styles.rankTextTop,
              row.rankTone === "placeholder" && styles.rankTextPlaceholder,
            ]}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {row.rankLabel}
          </Text>
        </View>

        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded
              ? copy.leaderboard.collapseDetails(row.displayName)
              : copy.leaderboard.expandDetails(row.displayName)
          }
          style={styles.rowMain}
          testID={`leaderboard-row-toggle-${row.key}`}
        >
          <View style={styles.nameLine}>
            <Text numberOfLines={1} style={styles.name}>
              {row.displayName}
            </Text>
            {row.integrityFlagCount > 0 ? (
              <Icon
                name="alert-triangle"
                size="sm"
                color={semantic.icon.danger}
              />
            ) : null}
          </View>

          {row.company ? (
            <Text numberOfLines={1} style={styles.company}>
              {row.company}
            </Text>
          ) : null}

          {row.tieBreakLabel ? (
            <Text style={styles.tieBreak}>{row.tieBreakLabel}</Text>
          ) : null}

          {row.bar ? <LeaderboardBar bar={row.bar} /> : null}

          {row.sampleQualityLabel ? (
            <Text style={styles.sampleLabel}>{row.sampleQualityLabel}</Text>
          ) : null}
        </Pressable>

        <View style={styles.metrics}>
          <Text
            style={styles.metricValue}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {row.uniqueVisitors}
            {row.visitorAsterisk ? "*" : null}
          </Text>
          {/*
            標籤必須是**次指標的前綴**，不能夾在兩個數字中間。

            舊版把 `聯絡` 放在 uv 與 leads 兩個數字之間，視覺上會被讀成「在標註上面
            那個數字」——也就是把 leads 的標籤貼在訪客數上。兩個指標去重單位不同（設計
            §2.5 明文不得合成一個「互動數」），貼錯標籤等於讓主辦方拿錯的口徑去解釋名次。
          */}
          <View style={styles.metricSecondaryLine}>
            <Text
              style={styles.metricCaption}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {copy.leaderboard.columnLeads}
            </Text>
            <Text
              style={styles.metricSecondary}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {row.leadsCaptured}
            </Text>
          </View>
        </View>
      </View>

      {expanded ? (
        <View style={styles.details} testID={`leaderboard-details-${row.key}`}>
          <Text style={styles.detailsHeading}>
            {copy.leaderboard.detailHeading}
          </Text>
          <DetailLine
            label={copy.leaderboard.detailEarliestDay}
            value={row.earliestAchievedDay ?? copy.leaderboard.detailNone}
          />
          <DetailLine
            label={copy.leaderboard.detailFirstLeadAt}
            value={
              row.firstLeadAt === null
                ? copy.leaderboard.detailNone
                : (formatAsOf(row.firstLeadAt) ?? row.firstLeadAt)
            }
          />
          <DetailLine
            label={copy.leaderboard.detailFlaggedTaps}
            value={String(row.flaggedTaps)}
          />
          <DetailLine
            label={copy.leaderboard.detailDataQuality}
            value={
              row.dataQualityFlags.length === 0
                ? copy.leaderboard.detailNone
                : row.dataQualityFlags.join(", ")
            }
          />
          {row.dataQualityFlags.length > 0 ? (
            <Text style={styles.detailsNote}>
              {copy.leaderboard.dataQualityNote}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * 比較條。
 *
 * RN 沒有百分比寬度，所以照 `polls.tsx` 的 `PollBar` 用 flex 權重表達同一件事：
 * 內條 `flex: percent`、剩餘空白 `flex: 100 - percent`。`percent === 0` 直接回
 * 純軌道，避免某些 RN 版本把兩個 flex 都算成 0 讓整條消失。
 *
 * 虛線（`dashed`）代表「樣本較小」：長條長度是相對關係，不是精確比例。
 */
function LeaderboardBar({ bar }: { bar: LeaderboardRowBar }) {
  return (
    <View
      style={[styles.barTrack, bar.dashed && styles.barTrackDashed]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: bar.percent }}
    >
      {bar.percent > 0 ? (
        <>
          <View
            style={[
              styles.barFill,
              bar.dashed && styles.barFillDashed,
              { flex: bar.percent },
            ]}
          />
          <View style={{ flex: 100 - bar.percent }} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  header: { gap: spacing.gap },
  rowGap: { height: space[2] },
  footer: { gap: spacing.gap, marginTop: spacing.gap },

  summaryMetrics: { flexDirection: "row", gap: space[5] },
  summaryBlock: { flex: 1, gap: space[1] },
  summaryValue: { ...type.h2, color: semantic.text.primary },
  summaryLabel: { ...type.caption, color: semantic.text.muted },
  summaryDefinition: {
    ...type.caption,
    color: semantic.text.secondary,
    marginTop: space[3],
  },
  summaryCounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[3],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: hairline,
    borderTopColor: semantic.border.decorative,
  },
  summaryCount: { ...type.micro, color: semantic.text.muted },

  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[1],
  },
  columnLabel: { ...type.micro, color: semantic.text.muted },
  columnRank: { width: layout.touchMin },
  columnName: { flex: 1 },
  columnMetrics: {
    width: 56,
    textAlign: "right",
  },

  skeletonGroup: { gap: spacing.gap },

  row: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: semantic.border.decorative,
    padding: spacing.card,
  },
  /**
   * 低於門檻的列。
   *
   * 只降透明度，**不改色票**：低於門檻不是錯誤，用 danger 色會讓主辦方把它讀成
   * 「這幾個人有問題」（設計 §8.3 明文禁止）。
   */
  rowBelowThreshold: { opacity: 0.85 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: space[3] },
  rankBadge: {
    width: layout.touchMin,
    height: layout.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: semantic.bg.surfaceSunken,
  },
  /** 前 3 名：品牌淺紫底（`status.pending`，6.02 對比），不硬寫 hex。 */
  rankBadgeTop: { backgroundColor: semantic.status.pending.bg },
  rankBadgePlaceholder: { backgroundColor: semantic.bg.surfaceSunken },
  rankText: { ...type.label, color: semantic.text.secondary },
  rankTextTop: { color: semantic.status.pending.fg },
  rankTextPlaceholder: { color: semantic.text.muted },
  rowMain: { flex: 1, gap: space[1] },
  nameLine: { flexDirection: "row", alignItems: "center", gap: space[2] },
  name: { ...type.body, flexShrink: 1, color: semantic.text.primary },
  company: { ...type.caption, color: semantic.text.muted },
  tieBreak: { ...type.micro, color: semantic.text.muted },
  sampleLabel: { ...type.micro, color: semantic.text.muted },
  metrics: { alignItems: "flex-end", minWidth: 56 },
  /** 次指標一行：`聯絡 12`。標籤與數字必須黏在一起，中間不得夾主指標。 */
  metricSecondaryLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space[1],
  },
  metricValue: { ...type.h2, color: semantic.text.primary },
  metricCaption: { ...type.micro, color: semantic.text.muted },
  metricSecondary: { ...type.label, color: semantic.text.secondary },

  barTrack: {
    flexDirection: "row",
    height: 8,
    marginTop: space[2],
    borderRadius: radius.full,
    overflow: "hidden",
    backgroundColor: semantic.bg.surfaceSunken,
  },
  barTrackDashed: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: semantic.border.interactive,
  },
  barFill: {
    backgroundColor: semantic.action.primary,
    borderRadius: radius.full,
  },
  barFillDashed: {
    backgroundColor: semantic.border.interactive,
  },

  details: {
    marginTop: space[3],
    paddingTop: space[3],
    gap: space[2],
    borderTopWidth: hairline,
    borderTopColor: semantic.border.decorative,
  },
  detailsHeading: { ...type.caption, color: semantic.text.muted },
  detailsNote: { ...type.micro, color: semantic.text.secondary },
  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space[3],
  },
  detailLabel: { ...type.caption, color: semantic.text.muted },
  detailValue: {
    ...type.caption,
    flexShrink: 1,
    textAlign: "right",
    color: semantic.text.secondary,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.touchMin,
    gap: space[2],
  },
  sectionTitle: { ...type.label, flexShrink: 1, color: semantic.text.primary },
  sectionBody: { gap: space[2], marginTop: space[2] },
  sectionHint: { ...type.caption, color: semantic.text.muted },
  sectionList: { gap: space[2], marginTop: space[1] },

  excludedGroups: { gap: space[2] },
  excludedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
  },
  excludedLabel: {
    ...type.caption,
    flexShrink: 1,
    color: semantic.text.secondary,
  },
  excludedCount: { ...type.caption, color: semantic.text.muted },
  excludedItems: { gap: space[1], marginTop: space[1] },
  excludedItem: { ...type.micro, color: semantic.text.muted },

  methodologyNote: { ...type.caption, color: semantic.text.secondary },
  asteriskNote: {
    ...type.micro,
    color: semantic.text.muted,
    marginTop: space[1],
  },
});
