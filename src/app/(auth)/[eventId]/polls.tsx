import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
import { pollService } from "@/services/poll.service";
import type { EventPoll } from "@/types/poll.types";

/**
 * 投票管理（parity `polls`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * ## 清單是唯一一次讀取
 *
 * Web 只打一條 `GET …/polls`，結果是**在 client 端數**回傳的 `votes[]` 算出來的
 * （`computeResults`，為的是避開「每個投票各打一次 results」的 N+1）。
 * App 照同一條路：畫面上所有數字都來自這次列表回應，不再補打
 * `GET …/polls/:pollId/results`。這一點由 `tests/poll-contract.test.mjs` 的
 * 範圍鎖釘住——`polls.tsx` 只能呼叫四個 service 方法其中的幾個，多一個就紅。
 *
 * ## 為什麼失敗要講出來
 *
 * Web 的 `loadPolls` 是 `catch { setPolls([]) }`：請求失敗時畫面收成一個
 * 「尚未建立任何投票」的空狀態——**看起來跟真的沒有投票一模一樣**。
 * App 不接受這種把失敗偽裝成空的情形，所以分成兩條：載入失敗給橫幅
 * （`loadError`），查無資料才給 EmptyState。這是 App 唯一「比 Web 多做」的地方，
 * 理由是不講話的失敗在現場無法診斷。
 *
 * ## 為什麼重新整理走 `reloadKey`
 *
 * 與 `content.tsx` / `profile.tsx` 同一個理由：標頭的重新整理鈕不能在 effect 外
 * 直接呼叫會 `setState` 的載入函式（`react-hooks/set-state-in-effect`），
 * 所以把「重載」表達成「把 key 加一」，由 effect 自己監聽。載入邏輯只留一份。
 */
export default function EventPollsScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [polls, setPolls] = useState<EventPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  /**
   * 重新載入的觸發計數器（見檔頭）。
   *
   * 後續的「建立／啟用／關閉」都會在成功後把它加一：與 Web 的
   * `await loadPolls()` 同義，但不在 handler 內直接呼叫載入函式——
   * 這樣載入路徑永遠只有 effect 那一份。
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!eventId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const res = await pollService.listPolls(eventId);
        if (!active) return;
        setPolls(res.polls);
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

  /** 已有資料時不重畫骨架，避免重新整理把清單閃成空白（同 `content.tsx`）。 */
  const showSkeleton = loading && polls.length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.polls.title}
        subtitle={copy.polls.subtitle}
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
          <InlineBanner compact tone="danger" message={copy.polls.loadError} />
        ) : null}

        {!showSkeleton && !loadError ? (
          <Text style={styles.sectionLabel}>{copy.polls.listHeading}</Text>
        ) : null}

        {showSkeleton ? (
          <View
            style={styles.skeletonGroup}
            testID="polls-skeleton"
            accessible
            accessibilityLabel={copy.polls.loading}
            accessibilityState={{ busy: true }}
          >
            <Skeleton height={96} radius={radius.lg} />
            <Skeleton height={96} radius={radius.lg} />
          </View>
        ) : null}

        {!showSkeleton && !loadError && polls.length === 0 ? (
          <EmptyState
            kind="first-use"
            title={copy.polls.empty}
            headingLevel={2}
            testID="polls-empty"
          />
        ) : null}

        {!showSkeleton && polls.length > 0 ? (
          <View style={styles.list}>
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * 一個投票。
 *
 * 現階段只有題目與狀態；開關按鈕與計票結果由後續 commit 補上，
 * 但**卡片外框在這裡就定案**——Web 也是一張卡包含題目、狀態、開關與統計，
 * 先分好容器，後面就不會為了塞按鈕而重排版面。
 *
 * ## 顏色為什麼不是照 Web 的 `green-50/gray-100`
 *
 * Web 用 tailwind 的 `bg-green-50 text-green-700` 表達「進行中」、
 * `bg-gray-100 text-gray-500` 表達「已關閉」。後者在白底上的對比只有約 4.0:1，
 * 而且灰字讀起來像「停用」而不是「已結束」。App 走既有的
 * `semantic.status`（`success` / `neutral`），與其他畫面的狀態徽章同一套 token、
 * 同一組對比保證（`theme.ts` 已凍結，不新增色票）。
 */
function PollCard({ poll }: { poll: EventPoll }) {
  return (
    <Card testID={`poll-card-${poll.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.question}>{poll.question}</Text>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: statusTone(poll.isActive).bg,
              borderColor: statusTone(poll.isActive).border,
            },
          ]}
        >
          <Text
            style={[type.badge, { color: statusTone(poll.isActive).fg }]}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {poll.isActive ? copy.polls.statusActive : copy.polls.statusClosed}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** 狀態 → `semantic.status` token。進行中＝成功綠，已關閉＝中性灰。 */
function statusTone(isActive: boolean) {
  return isActive ? semantic.status.success : semantic.status.neutral;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  sectionLabel: { ...type.label, color: semantic.text.secondary },
  skeletonGroup: { gap: spacing.gap },
  list: { gap: spacing.gap },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
  },
  question: { ...type.body, flex: 1, color: semantic.text.primary },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
});
