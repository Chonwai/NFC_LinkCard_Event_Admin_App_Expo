import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
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
import { contentService } from "@/services/content.service";
import type { PageSection, PageSectionCard } from "@/types/api.types";
import { getApiErrorMessage } from "@/utils/api-error";

/**
 * 區塊數上限。
 *
 * 這個 6 **只存在於 Web 的畫面**（`content/page.tsx:22` 的 `MAX_SECTIONS`），
 * 後端 `createSection` 沒有這條限制。照抄的理由是「不增不減」：Web 的使用者
 * 最多就是建 6 個，App 不該多給。少了它，手機反而變成一個 Web 沒有的後門。
 */
const MAX_SECTIONS = 6;

/**
 * 落地頁內容（parity `content`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/content/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。兩層結構照抄 Web：
 * **section（區塊）→ card（卡片）**，兩層一次讀完（`GET …/page-sections` 的
 * 回應就把 `cards` 包在每個 section 裡），與 Web 的 `loadSections()` 相同。
 *
 * ## 為什麼每個區塊的輸入框不是「一向都開著」
 * Web 的 `SectionEditor` 把標題／欄數／發布狀態的 input 一直攤在畫面上，
 * 因為桌機版面寬、一頁能看到六個區塊。手機上一頁只放得下一個半區塊，若照抄
 * 「全部攤開」，要改第三個區塊得先滑過兩組輸入框。因此 App 用「摘要列 +
 * 就地展開」——這正是 Web **卡片**編輯器（`CardEditor` 的 `editing` 狀態）
 * 已經在用的模式，不是新發明。能力面完全一致：同樣的欄位、同樣的儲存。
 *
 * ## 為什麼載入用 Skeleton 而不是一行灰字
 * `components/ui/Skeleton.tsx` 記載的凍結規則：載入一律用 Skeleton，
 * EmptyState 不得用來表示載入中。Web 這頁也是骨架（`animate-pulse` 兩塊）。
 *
 * ## 失敗要講出來
 * Web 的 `handleSave` / `handleDelete` / `handleAddCard` 都是
 * `try { … } finally { … }`——**沒有 catch**，請求失敗時畫面靜止不動，使用者
 * 只看到按鈕彈回來。App 多一條橫幅顯示後端訊息（`getApiErrorMessage` 優先），
 * 這是 App 唯一「比 Web 多做」的地方，理由是不講話的失敗在現場無法診斷。
 */
export default function EventContentScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  /** 新增／儲存／刪除進行中（同一時間只會有一個動作在跑） */
  const [busy, setBusy] = useState(false);
  /** 寫入失敗的橫幅。Web 的寫入路徑沒有 catch，App 多這一條（見檔頭）。 */
  const [actionError, setActionError] = useState<string | null>(null);
  /**
   * 重新載入的觸發計數器。
   *
   * 與 `profile.tsx` 同一個理由：標頭的「重新整理」鈕不能在 effect 外直接呼叫
   * 會 `setState` 的載入函式（`react-hooks/set-state-in-effect`），所以把
   * 「重載」表達成「把 key 加一」，由 effect 自己監聽。載入邏輯只留一份。
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!eventId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const res = await contentService.listSections(eventId);
        if (!active) return;
        setSections(res.sections);
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

  const showSkeleton = loading && sections.length === 0;
  const maxed = sections.length >= MAX_SECTIONS;

  /**
   * 新增區塊。
   *
   * 與 Web 完全相同的一步：先建一個空區塊，再就地編輯。標題預設「新區塊」、
   * 2 欄、不發布——三個值逐字對齊 `content/page.tsx:71-75`。不先跳一張「請輸入
   * 標題」的表單：那會在 Web 的流程上多插一步。
   */
  async function addSection() {
    if (!eventId) return;
    setBusy(true);
    setActionError(null);
    try {
      await contentService.createSection(eventId, {
        title: copy.content.newSection,
        gridColumns: 2,
        isPublished: false,
      });
      // 建完重新載入整份清單（Web 也是 `onUpdate()` → `loadSections()`），
      // 不自行把新區塊拼進本地陣列：`displayOrder` 由後端決定。
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, copy.content.addFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.content.title}
        subtitle={copy.content.subtitle}
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
            message={copy.content.loadError}
          />
        ) : null}

        {actionError ? (
          <InlineBanner
            compact
            tone="danger"
            message={actionError}
            dismissible
            onDismiss={() => setActionError(null)}
          />
        ) : null}

        {!showSkeleton ? (
          <Button
            label={
              maxed
                ? `${copy.content.addSection}${copy.content.maxReached}`
                : copy.content.addSection
            }
            variant="secondary"
            icon={<Icon name="plus" size="sm" color={semantic.icon.default} />}
            onPress={() => void addSection()}
            loading={busy}
            disabled={maxed}
            testID="content-add-section"
          />
        ) : null}

        {showSkeleton ? (
          <View
            style={styles.skeletonGroup}
            testID="content-skeleton"
            accessible
            accessibilityLabel={copy.content.loading}
            accessibilityState={{ busy: true }}
          >
            <Skeleton height={96} radius={radius.lg} />
            <Skeleton height={96} radius={radius.lg} />
          </View>
        ) : null}

        {!showSkeleton && !loadError && sections.length === 0 ? (
          <EmptyState
            kind="first-use"
            title={copy.content.empty}
            headingLevel={2}
            testID="content-empty"
          />
        ) : null}

        {sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * 發布狀態徽章。
 *
 * 顏色走 `semantic.status`（已發布綠／草稿中性），與其他畫面的狀態徽章同一套
 * token；Web 用 `text-green-600` / `text-gray-400`，其中灰在淺底上只有 2.5:1
 * 左右，App 改用 `status.neutral`（9.24:1），意思不變、可讀性更好。
 */
function PublishBadge({ isPublished }: { isPublished: boolean }) {
  const tone = isPublished ? semantic.status.success : semantic.status.neutral;
  return (
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
        {isPublished ? copy.content.published : copy.content.draft}
      </Text>
    </View>
  );
}

/** 一張卡片（唯讀列）。 */
function CardRow({ card }: { card: PageSectionCard }) {
  return (
    <View style={styles.cardRow} testID={`content-card-${card.id}`}>
      <Text
        style={[type.body, styles.grow]}
        numberOfLines={2}
        maxFontSizeMultiplier={layout.maxFontScaleBody}
      >
        {card.title}
      </Text>
      <PublishBadge isPublished={card.isPublished} />
    </View>
  );
}

/** 一個區塊，含底下的卡片清單。 */
function SectionBlock({ section }: { section: PageSection }) {
  return (
    <Card padding={spacing.card} testID={`content-section-${section.id}`}>
      <View style={styles.sectionHead}>
        <Text
          style={[type.h3, styles.grow, section.title ? null : styles.muted]}
          numberOfLines={2}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          {section.title || copy.content.untitledSection}
        </Text>
        <PublishBadge isPublished={section.isPublished} />
      </View>

      {section.description ? (
        <Text
          style={[type.caption, styles.muted]}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          {section.description}
        </Text>
      ) : null}

      <Text
        style={[type.micro, styles.muted]}
        maxFontSizeMultiplier={layout.maxFontScaleFixed}
      >
        {copy.content.columns(section.gridColumns ?? 2)}
      </Text>

      {/* 空區塊什麼都不顯示：Web 在沒有卡片時也只剩「新增卡片」按鈕，
          而那個按鈕屬於後續 commit，這裡不先用文字填空。 */}
      {section.cards.length > 0 ? (
        <View style={styles.cardList}>
          {section.cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[3],
    gap: space[3],
  },
  skeletonGroup: { gap: space[3] },
  muted: { color: semantic.text.muted },
  grow: { flex: 1, minWidth: 0 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
  },
  cardList: { gap: space[2], marginTop: space[2] },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    backgroundColor: semantic.bg.surfaceSunken,
  },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
});
