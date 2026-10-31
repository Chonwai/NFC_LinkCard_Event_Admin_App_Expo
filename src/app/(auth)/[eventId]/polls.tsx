import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldInput } from "@/components/ui/FieldInput";
import { Icon } from "@/components/ui/Icon";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
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
import { getApiErrorMessage } from "@/utils/api-error";
import {
  canAddPollOption,
  canRemovePollOption,
  toPollPayload,
} from "@/utils/poll-form";

/**
 * 投票管理（parity `polls`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * 版面順序照抄 Web：**建立投票**在上、**投票列表**在下，同一頁，
 * 不是兩個分頁。理由與 Web 相同——建完就要立刻看到它出現在清單裡。
 *
 * ## 清單是唯一一次讀取
 *
 * Web 只打一條 `GET …/polls`，結果是**在 client 端數**回傳的 `votes[]` 算出來的
 * （`computeResults`，為的是避開「每個投票各打一次 results」的 N+1）。
 * App 照同一條路：畫面上所有數字都來自這次列表回應，不再補打
 * `GET …/polls/:pollId/results`。範圍由 `tests/poll-contract.test.mjs` 釘住。
 *
 * ## 為什麼失敗要講出來
 *
 * Web 的 `loadPolls` 是 `catch { setPolls([]) }`：請求失敗時畫面收成一個
 * 「尚未建立任何投票」的空狀態——**看起來跟真的沒有投票一模一樣**。
 * App 不接受這種把失敗偽裝成空的情形，所以分成兩條：載入失敗給橫幅
 * （`loadError`），查無資料才給 EmptyState。寫入失敗（建立／啟用／關閉）另外
 * 給一條 `feedback` 橫幅，訊息優先取後端回的 `error.message`
 * （`getApiErrorMessage`）。這是 App 唯一「比 Web 多做」的地方，
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

  /** 建立表單。起始兩格空選項與 Web 的 `useState(['', ''])` 相同。 */
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [creating, setCreating] = useState(false);

  /** 寫入結果橫幅（建立／啟用／關閉共用一條）。 */
  const [feedback, setFeedback] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);

  /**
   * 正在啟用／關閉的那一筆。同 Web 的 `actingPollId`：
   * 只有被按下去的那一張卡的按鈕進 loading，其他卡片照常可按。
   */
  const [actingPollId, setActingPollId] = useState<string | null>(null);

  /**
   * 重新載入的觸發計數器（見檔頭）。
   *
   * 寫入成功後把它加一：與 Web 的 `await loadPolls()` 同義，
   * 但不在 handler 內直接呼叫載入函式——載入路徑永遠只有 effect 那一份。
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

  /** 目前表單是否可送出。`null` ＝ 題目空白或有效選項不足兩個。 */
  const payload = toPollPayload(question, options);

  async function create() {
    if (!eventId) return;
    const body = toPollPayload(question, options);
    if (!body) return;

    setCreating(true);
    setFeedback(null);
    try {
      await pollService.createPoll(eventId, body);
      // 表單歸零、重新載入整份清單（Web 也是 `setQuestion('')` +
      // `setOptions(['', ''])` + `await loadPolls()`）。
      // 不自行把新投票拼進本地陣列：`createdAt` 由後端決定，排序也在後端。
      setQuestion("");
      setOptions(["", ""]);
      setFeedback({ tone: "success", message: copy.polls.createSuccess });
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: getApiErrorMessage(error, copy.polls.actionError),
      });
    } finally {
      setCreating(false);
    }
  }

  function updateOption(index: number, text: string) {
    setOptions((current) =>
      current.map((option, i) => (i === index ? text : option)),
    );
  }

  /**
   * 啟用一筆投票。
   *
   * 後端 `PATCH …/polls/:pollId/activate` 只認路徑上的 pollId，不帶 body。
   * 成功後重新載入整份清單（Web 的 `await loadPolls()`），不自己改本地
   * `isActive`：`startedAt` 也是後端寫的，本地改一半只會對不上。
   */
  async function activate(poll: EventPoll) {
    if (!eventId) return;
    setActingPollId(poll.id);
    setFeedback(null);
    try {
      await pollService.activatePoll(eventId, poll.id);
      setFeedback({ tone: "success", message: copy.polls.activateSuccess });
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: getApiErrorMessage(error, copy.polls.actionError),
      });
    } finally {
      setActingPollId(null);
    }
  }

  /**
   * 關閉一筆投票。與 `activate` 對稱：不帶 body、成功後整份重載。
   *
   * 失敗時（例如後端回 `POLL_NOT_FOUND`，表示別人已經刪了這一筆）
   * 一樣重載清單嗎？**不**。Web 也不重載——它只把錯誤訊息顯示出來。
   * 這裡照抄：使用者看到「投票不存在」，按重新整理就會看到真相，
   * 比自動把畫面換掉更能讓人看懂剛剛發生了什麼。
   */
  async function close(poll: EventPoll) {
    if (!eventId) return;
    setActingPollId(poll.id);
    setFeedback(null);
    try {
      await pollService.closePoll(eventId, poll.id);
      setFeedback({ tone: "success", message: copy.polls.closeSuccess });
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: getApiErrorMessage(error, copy.polls.actionError),
      });
    } finally {
      setActingPollId(null);
    }
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index));
  }

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
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? (
          <InlineBanner compact tone="danger" message={copy.polls.loadError} />
        ) : null}

        {feedback ? (
          <InlineBanner
            compact
            tone={feedback.tone}
            message={feedback.message}
            dismissible
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        {/* 建立投票 */}
        <Card>
          <Text style={styles.sectionLabel}>{copy.polls.createHeading}</Text>

          <FieldInput
            label={copy.polls.questionLabel}
            value={question}
            onChangeText={setQuestion}
            testID="poll-question"
          />

          <View style={styles.optionsGroup}>
            <Text style={styles.sectionLabel}>{copy.polls.optionsLabel}</Text>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <View style={styles.optionField}>
                  <FieldInput
                    label={copy.polls.optionPlaceholder(index + 1)}
                    value={option}
                    onChangeText={(text) => updateOption(index, text)}
                    testID={`poll-option-${index}`}
                  />
                </View>
                {canRemovePollOption(options) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copy.polls.removeOption}
                    onPress={() => removeOption(index)}
                    style={styles.removeOption}
                    testID={`poll-option-remove-${index}`}
                  >
                    <Icon
                      name="close"
                      size="sm"
                      color={semantic.icon.default}
                    />
                  </Pressable>
                ) : null}
              </View>
            ))}

            {canAddPollOption(options) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOptions((current) => [...current, ""])}
                style={styles.addOption}
                testID="poll-add-option"
              >
                <Text style={styles.addOptionLabel}>
                  {copy.polls.addOption}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Button
            label={copy.polls.createButton}
            onPress={() => void create()}
            loading={creating}
            disabled={payload == null}
            testID="poll-create"
          />
        </Card>

        {/* 投票列表 */}
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
              <PollCard
                key={poll.id}
                poll={poll}
                busy={actingPollId === poll.id}
                onActivate={() => void activate(poll)}
                onClose={() => void close(poll)}
              />
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
 * 現階段是題目 + 狀態徽章 + 一顆開關按鈕；計票結果由後續 commit 補在最下面
 * （Web 的卡片同樣是「上半：題目／狀態／開關，下半：統計」）。
 *
 * ## 顏色為什麼不是照 Web 的 `green-50/gray-100`
 *
 * Web 用 tailwind 的 `bg-green-50 text-green-700` 表達「進行中」、
 * `bg-gray-100 text-gray-500` 表達「已關閉」。後者在白底上的對比只有約 4.0:1，
 * 而且灰字讀起來像「停用」而不是「已結束」。App 走既有的 `semantic.status`
 * （`success` / `neutral`），與其他畫面的狀態徽章同一套 token、同一組對比保證
 * （`theme.ts` 已凍結，不新增色票）。
 *
 * ## 開關按鈕是**二選一**，不是並排兩顆
 *
 * Web 的邏輯是 `!poll.isActive ? 「啟動」: 「關閉」`——同一時間只會出現一顆。
 * 這不是版面妥協：兩個方向同時可按會讓人「先按錯再按回來」，
 * 而啟動一個已結束的投票在後端是合法的（它只改 `isActive`），
 * 錯按就會真的重開一場已經結算的投票。App 照抄二選一。
 */
function PollCard({
  poll,
  busy,
  onActivate,
  onClose,
}: {
  poll: EventPoll;
  /** 這一張卡正在送出啟用／關閉請求 */
  busy: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const tone = statusTone(poll.isActive);
  return (
    <Card testID={`poll-card-${poll.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.question}>{poll.question}</Text>
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
            {poll.isActive ? copy.polls.statusActive : copy.polls.statusClosed}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        {!poll.isActive ? (
          <Button
            label={copy.polls.activate}
            variant="secondary"
            onPress={onActivate}
            loading={busy}
            fullWidth={false}
            testID={`poll-activate-${poll.id}`}
          />
        ) : (
          <Button
            label={copy.polls.close}
            variant="secondary"
            onPress={onClose}
            loading={busy}
            fullWidth={false}
            testID={`poll-close-${poll.id}`}
          />
        )}
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
  optionsGroup: { gap: spacing.gap },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space[2],
  },
  optionField: { flex: 1 },
  /**
   * 移除選項的觸控目標。
   *
   * 用 `layout.touchMin`（48）而不是 Web 那種 24px 的小叉：手機上的目標
   * 小於 44pt 就是誤觸製造機。高度對齊 `FieldInput` 的輸入框，
   * 視覺上看起來像同一列的一部分。
   */
  removeOption: {
    width: layout.touchMin,
    height: layout.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  addOption: {
    minHeight: layout.touchMin,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
  },
  addOptionLabel: { ...type.label, color: semantic.text.link },
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
  /**
   * 卡片內動作列。
   *
   * 靠右、`flex-start`：與 Web 的 `flex shrink-0 gap-1.5` 同一個視覺結果，
   * 但留了一條上分隔線——手機上題目與按鈕之間沒有卡片邊界，
   * 不加線會看起來像按鈕屬於題目本身。
   */
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space[2],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
});
