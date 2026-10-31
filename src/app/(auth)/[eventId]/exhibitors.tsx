import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

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
import { exhibitorService } from "@/services/exhibitor.service";
import {
  EXHIBITOR_LIST_MAX_LIMIT,
  type Exhibitor,
  type ExhibitorStatus,
} from "@/types/exhibitor.types";
import {
  countForTab,
  emptyMergedExhibitors,
  exhibitorsForTab,
  EXHIBITOR_STATUSES,
  EXHIBITOR_TABS,
  mergeExhibitorBuckets,
  type ExhibitorTab,
} from "@/utils/exhibitor-list";

/**
 * 參展廠商管理（parity `exhibitors`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/exhibitors/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * ## 與 Web 不同的地方只有一處，而且是為了不丟資料
 *
 * Web 打一條「不帶 `limit`、不帶 `status`」的列表請求，再在本地切分頁。
 * 後端對這兩個缺席的參數各有預設值，兩個都無聲：
 *
 * - `limit` 預設 **20** ⇒ 第 21 家廠商不存在於畫面上。
 * - `status` 缺席時被**強制**成 `ACTIVE` ⇒ 「全部」分頁看不到待審批的廠商。
 *
 * 所以這裡對四個狀態**各打一次**（每次都帶 `EXHIBITOR_LIST_MAX_LIMIT`），
 * 合併後才切分頁。這讓 Web 那個叫「全部」的分頁真的等於全部，也讓分頁上的
 * 數字等於後端的 `pagination.total`。代價是進頁面要四個請求（Web 是一個），
 * 換來的是切分頁零請求、而且數字是對的。理由與邊界見
 * `src/utils/exhibitor-list.ts`。
 *
 * ## 為什麼四個請求是 `Promise.all` 而不是 `allSettled`
 *
 * 「全部」的數字是四個狀態的和。任何一個狀態查不到，那個和就是錯的——而且
 * 錯得沒有痕跡（少一個桶只會讓數字變小，畫面看起來完全正常）。所以只要有一
 * 個失敗就整頁報錯、給重新整理，不拼出一份「看起來可以但少了一角」的清單。
 *
 * ## 為什麼重新整理走 `reloadKey`
 *
 * 與 `content.tsx` / `polls.tsx` 同一個理由：標頭的重新整理鈕不能在 effect 外
 * 直接呼叫會 `setState` 的載入函式（`react-hooks/set-state-in-effect`），
 * 所以把「重載」表達成「把 key 加一」，由 effect 自己監聽。載入邏輯只留一份。
 */
export default function EventExhibitorsScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [data, setData] = useState(emptyMergedExhibitors);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<ExhibitorTab>("ALL");

  /**
   * 重新載入的觸發計數器（見檔頭）。
   *
   * 寫入成功後把它加一：與 Web 的 `await load()` 同義，但不在 handler 內直接
   * 呼叫載入函式——載入路徑永遠只有 effect 那一份。
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!eventId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const buckets = await Promise.all(
          EXHIBITOR_STATUSES.map(async (status) => {
            const res = await exhibitorService.listExhibitors(eventId, {
              status,
              limit: EXHIBITOR_LIST_MAX_LIMIT,
            });
            return {
              status,
              exhibitors: res.exhibitors,
              total: res.pagination.total,
            };
          }),
        );
        if (!active) return;
        setData(mergeExhibitorBuckets(buckets));
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
  const showSkeleton = loading && data.total === 0;

  const rows = exhibitorsForTab(data, tab);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.exhibitors.title}
        subtitle={copy.exhibitors.subtitle}
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
            message={copy.exhibitors.loadError}
          />
        ) : null}

        {/* 分頁籤：順序照 Web 的 STATUS_TABS，數字取自後端 pagination.total */}
        <View style={styles.tabs}>
          {EXHIBITOR_TABS.map((value) => {
            const selected = value === tab;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.tab, selected && styles.tabSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tabLabel(value)}
                testID={`exhibitors-tab-${value}`}
              >
                <Text
                  style={[type.label, selected && styles.tabLabelSelected]}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {tabLabel(value)}
                </Text>
                <Text
                  style={styles.tabCount}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {countForTab(data, value)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/*
         * 截斷說明。只在真的有桶被 100 筆上限切到時出現——Web 從不說明它只顯示
         * 20 筆，那正是這一條存在的理由。
         */}
        {data.truncated ? (
          <InlineBanner
            compact
            tone="warning"
            message={copy.exhibitors.truncated}
          />
        ) : null}

        {showSkeleton ? (
          <View
            style={styles.skeletonGroup}
            testID="exhibitors-skeleton"
            accessible
            accessibilityLabel={copy.exhibitors.loading}
            accessibilityState={{ busy: true }}
          >
            <Skeleton height={88} radius={radius.lg} />
            <Skeleton height={88} radius={radius.lg} />
          </View>
        ) : null}

        {!showSkeleton && !loadError && rows.length === 0 ? (
          <EmptyState
            /*
             * `first-use` 只用在「這個活動真的一筆都沒有」；切到某個狀態卻是空的
             * 是 `filtered`（`EmptyState` 的凍結規則：filtered 語氣中立、不給
             * 主要 CTA）。用錯 kind 會讓「待審批 0 筆」看起來像「還沒開始用」。
             */
            kind={tab === "ALL" ? "first-use" : "filtered"}
            title={
              tab === "ALL"
                ? copy.exhibitors.empty
                : copy.exhibitors.emptyForStatus
            }
            headingLevel={2}
            testID="exhibitors-empty"
          />
        ) : null}

        {!showSkeleton && rows.length > 0 ? (
          <View style={styles.list}>
            {rows.map((exhibitor) => (
              <ExhibitorRow key={exhibitor.id} exhibitor={exhibitor} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** 分頁籤的顯示文字。`ALL` 走 `exhibitors.all`，其餘走 `exhibitors.status.*`。 */
function tabLabel(tab: ExhibitorTab): string {
  return tab === "ALL" ? copy.exhibitors.all : copy.exhibitors.status[tab];
}

/**
 * 一家廠商。
 *
 * 版面順序照 Web 的列表列：**名稱＋狀態徽章 → 類型＋攤位**。Web 最右側還有一排
 * 入口連結（編輯／公開頁／門戶），那些連到的是展商入口與公開頁——不是這個
 * 能力的一部分，App 這裡不放（見 `src/services/exhibitor.service.ts` 的
 * 「為什麼只有六支」）。
 *
 * ## 顏色為什麼不是照 Web 的 tailwind 色票
 *
 * Web 用 `bg-yellow-100 text-yellow-700` ↔ `待審批`、`bg-red-100 text-red-600`
 * ↔ `已停用`。App 走既有的 `semantic.status`（`warning` / `success` /
 * `danger` / `neutral`），與其他畫面的狀態徽章同一套 token、同一組已量測的
 * 對比（`theme.ts` 已凍結，不新增色票）。
 */
function ExhibitorRow({ exhibitor }: { exhibitor: Exhibitor }) {
  const tone = statusTone(exhibitor.status);
  const detail = [
    exhibitor.exhibitorType,
    exhibitor.boothNumber ? copy.exhibitors.booth(exhibitor.boothNumber) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card testID={`exhibitor-row-${exhibitor.id}`}>
      <View style={styles.rowHeader}>
        <Text style={styles.companyName} numberOfLines={2}>
          {exhibitor.companyName}
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
            {copy.exhibitors.status[exhibitor.status]}
          </Text>
        </View>
      </View>

      {detail.length > 0 ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </Card>
  );
}

/** 狀態 → `semantic.status` token。四態各自一個語意，不共用。 */
function statusTone(status: ExhibitorStatus) {
  switch (status) {
    case "PENDING_APPROVAL":
      return semantic.status.warning;
    case "ACTIVE":
      return semantic.status.success;
    case "SUSPENDED":
      return semantic.status.danger;
    case "COMPLETED":
      return semantic.status.neutral;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  /**
   * 分頁籤列。
   *
   * Web 是底線式（border-bottom + 白色 active tab）；手機上底線在深色模式或
   * 大字号時最容易糊掉，所以走既有的 chip 語彙（`ChoiceChips` 的選中態
   * 是同一組 token）。
   */
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: semantic.bg.surface,
    minHeight: layout.touchMin,
  },
  tabSelected: {
    borderColor: semantic.border.interactiveSelected,
    backgroundColor: semantic.bg.brandSoft,
  },
  tabLabelSelected: { color: semantic.text.primary, fontWeight: "600" },
  tabCount: { ...type.caption, color: semantic.text.muted },
  skeletonGroup: { gap: spacing.gap },
  list: { gap: spacing.gap },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
  },
  companyName: { ...type.body, flex: 1, color: semantic.text.primary },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  detail: {
    ...type.caption,
    color: semantic.text.muted,
    marginTop: space[2],
  },
});
