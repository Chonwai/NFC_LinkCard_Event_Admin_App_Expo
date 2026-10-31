import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldInput } from "@/components/ui/FieldInput";
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
import type {
  PageSection,
  PageSectionCard,
  PageSectionGridColumns,
} from "@/types/api.types";
import { getApiErrorMessage } from "@/utils/api-error";
import {
  SECTION_DESCRIPTION_MAX,
  SECTION_GRID_COLUMN_OPTIONS,
  SECTION_TITLE_MAX,
  type SectionFormState,
  toSectionFormState,
  toSectionPayload,
} from "@/utils/page-content-payload";

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

        {eventId
          ? sections.map((section) => (
              <SectionBlock
                key={section.id}
                eventId={eventId}
                section={section}
                onChanged={() => setReloadKey((key) => key + 1)}
              />
            ))
          : null}
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

/** `ChoiceChips` 是字串型別（`T extends string`），欄數在這裡只是它的選項值。 */
type ColumnOption = "1" | "2" | "3";

const COLUMN_OPTIONS: ColumnOption[] = SECTION_GRID_COLUMN_OPTIONS.map(
  (value) => String(value) as ColumnOption,
);

/**
 * 區塊。唯讀時是摘要列（標題／說明／欄數／發布狀態），按「編輯」展開成四個
 * 欄位；儲存後重新載入整份清單。
 *
 * ## 為什麼每次進入編輯都重新初始化表單
 * 外層在存檔後會重載（`onChanged`），所以 `section` prop 才是最滾的來源。
 * 若沿用 mount 時的 state，第二次編輯看到的會是上次的舊值——這種 bug 不會
 * 報錯，只會默默把舊資料存回去。`startEditing` 因此每次都重新取一次。
 */
function SectionBlock({
  eventId,
  section,
  onChanged,
}: {
  eventId: string;
  section: PageSection;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SectionFormState>(() =>
    toSectionFormState(section),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 刪除前的二次確認。Web 用 `confirm()`，App 用同語意的 Modal。 */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** 新增卡片中。與 `saving` 分開，免得「新增卡片」把「儲存」的四字換成「儲存中…」。 */
  const [addingCard, setAddingCard] = useState(false);

  function startEditing() {
    setForm(toSectionFormState(section));
    setError(null);
    setEditing(true);
  }

  function patch(next: Partial<SectionFormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await contentService.updateSection(
        eventId,
        section.id,
        toSectionPayload(form),
      );
      setEditing(false);
      onChanged();
    } catch (caught) {
      setError(getApiErrorMessage(caught, copy.content.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  /**
   * 刪除區塊。後端 `deleteSection` 會連同底下的卡片一起刪（外鍵 cascade），
   * 所以確認文案要先把後果講清楚——Web 的 `deleteSectionConfirm` 就是那句話。
   */
  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await contentService.deleteSection(eventId, section.id);
      setConfirmingDelete(false);
      onChanged();
    } catch (caught) {
      setConfirmingDelete(false);
      setError(getApiErrorMessage(caught, copy.content.deleteFailed));
    } finally {
      setSaving(false);
    }
  }

  /**
   * 新增卡片。
   *
   * 與 Web 同一招：先建一張只有標題的卡片（預設「新卡片」、已發布），再就地
   * 編輯（`content/page.tsx:145-150`）。 `isPublished: true` 是 Web 的選擇，
   * 不是後端預設——後端 `createCard` 的 `isPublished ?? true` 剛好也是 true，
   * 但送出來才是兩邊一致。
   */
  async function addCard() {
    setAddingCard(true);
    setError(null);
    try {
      await contentService.createCard(eventId, section.id, {
        title: copy.content.newCard,
        isPublished: true,
      });
      onChanged();
    } catch (caught) {
      setError(getApiErrorMessage(caught, copy.content.addFailed));
    } finally {
      setAddingCard(false);
    }
  }

  return (
    <Card padding={spacing.card} testID={`content-section-${section.id}`}>
      <View style={styles.sectionBody}>
        {editing ? (
          <>
            <FieldInput
              label={copy.content.sectionTitle}
              placeholder={copy.content.sectionTitle}
              value={form.title}
              onChangeText={(title) => patch({ title })}
              maxLength={SECTION_TITLE_MAX}
              testID="content-section-title"
            />
            <FieldInput
              label={copy.content.sectionDescription}
              value={form.description}
              onChangeText={(description) => patch({ description })}
              maxLength={SECTION_DESCRIPTION_MAX}
              multiline
              testID="content-section-description"
            />
            <ChoiceChips
              label={copy.content.columnsLabel}
              options={COLUMN_OPTIONS}
              value={String(form.gridColumns) as ColumnOption}
              labelFor={(value) => copy.content.columns(Number(value))}
              onSelect={(value) =>
                patch({ gridColumns: Number(value) as PageSectionGridColumns })
              }
              testID="content-section-columns"
            />
            <PublishCheckbox
              value={form.isPublished}
              onToggle={() => patch({ isPublished: !form.isPublished })}
              testID="content-section-published"
            />

            {error ? (
              <InlineBanner compact tone="danger" message={error} />
            ) : null}

            <Button
              label={saving ? copy.content.saving : copy.content.save}
              loading={saving}
              onPress={() => void save()}
              testID="content-section-save"
            />
            <Button
              label={copy.content.cancel}
              variant="secondary"
              onPress={() => setEditing(false)}
              disabled={saving}
              testID="content-section-cancel"
            />
          </>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text
                style={[
                  type.h3,
                  styles.grow,
                  section.title ? null : styles.muted,
                ]}
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

            <View style={styles.metaRow}>
              <Text
                style={[type.micro, styles.muted]}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {copy.content.columns(section.gridColumns ?? 2)}
              </Text>
              <View style={styles.metaActions}>
                <TextButton
                  label={copy.content.edit}
                  onPress={startEditing}
                  testID={`content-section-edit-${section.id}`}
                />
                <TextButton
                  label={copy.content.delete}
                  tone="danger"
                  onPress={() => setConfirmingDelete(true)}
                  testID={`content-section-delete-${section.id}`}
                />
              </View>
            </View>
          </>
        )}

        {/* 沒有卡片時不畫任何佔位文字：Web 的空區塊也只剩「新增卡片」按鈕，
            用一句「尚無卡片」反而會讓空區塊看起來像壞掉。 */}
        {section.cards.length > 0 ? (
          <View style={styles.cardList}>
            {section.cards.map((card) => (
              <CardRow key={card.id} card={card} />
            ))}
          </View>
        ) : null}

        <Button
          label={copy.content.addCard}
          variant="secondary"
          icon={<Icon name="plus" size="sm" color={semantic.icon.default} />}
          onPress={() => void addCard()}
          loading={addingCard}
          disabled={addingCard || saving}
          testID={`content-card-add-${section.id}`}
        />
      </View>

      <ConfirmDialog
        visible={confirmingDelete}
        title={copy.content.delete}
        message={copy.content.deleteSectionConfirm}
        busy={saving}
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingDelete(false)}
        testID={`content-section-delete-confirm-${section.id}`}
      />
    </Card>
  );
}

/**
 * 二次確認框。
 *
 * 為什麼不用 RN 的 `Alert.alert`：這個 repo 全案沒有用過它（`src/` 搜不到
 * 任何一處），既有的兩個確認面板（名單管理、批次寄信）都是自繪 `Modal`。
 * Web 這邊用的是瀏覽器原生 `confirm()`，語意上就是「取消／確定」兩顆，
 * 這裡把它搬成同形狀的 Modal，並把後果寫在訊息裡。
 */
function ConfirmDialog({
  visible,
  title,
  message,
  busy,
  tone,
  onConfirm,
  onCancel,
  testID,
}: {
  visible: boolean;
  title: string;
  message: string;
  busy: boolean;
  tone: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  testID: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID={testID}>
          <Text style={type.h3}>{title}</Text>
          <Text
            style={[type.body, styles.muted]}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {message}
          </Text>
          <Button
            label={copy.content.delete}
            variant={tone === "danger" ? "dangerSolid" : "primary"}
            loading={busy}
            onPress={onConfirm}
            testID={`${testID}-confirm`}
          />
          <Button
            label={copy.content.cancel}
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
            testID={`${testID}-cancel`}
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * 發不發布的勾選框。
 *
 * 形狀照搬 `profile.tsx` 的「公開活動」勾選框（同樣是 `Pressable` +
 * `accessibilityRole="checkbox"`），不另外做一個通用元件——目前就這兩頁在用。
 */
function PublishCheckbox({
  value,
  onToggle,
  testID,
}: {
  value: boolean;
  onToggle: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.checkboxRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={copy.content.published}
      testID={testID}
    >
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value ? (
          <Icon name="check" size={14} color={semantic.text.onPrimary} />
        ) : null}
      </View>
      <Text
        style={[type.body, styles.checkboxLabel]}
        maxFontSizeMultiplier={layout.maxFontScaleBody}
      >
        {copy.content.published}
      </Text>
    </Pressable>
  );
}

/**
 * 行內文字動作（編輯／刪除）。
 *
 * 不用 `Button`：`Button` 最小高度 48、全寬、帶底色，塞在卡片內會把區塊
 * 撐成兩倍高。但觸控目標仍須 ≥ 48，所以用 `minHeight: layout.touchMin` +
 * `hitSlop`，而不是只縮字。
 */
function TextButton({
  label,
  tone = "default",
  onPress,
  testID,
}: {
  label: string;
  tone?: "default" | "danger";
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
    >
      <Text
        style={[
          type.label,
          tone === "danger" ? styles.textButtonDanger : styles.textButtonLabel,
        ]}
        maxFontSizeMultiplier={layout.maxFontScaleFixed}
      >
        {label}
      </Text>
    </Pressable>
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
  sectionBody: { gap: space[2] },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  metaActions: { flexDirection: "row", alignItems: "center" },
  backdrop: {
    flex: 1,
    backgroundColor: semantic.bg.overlay,
    justifyContent: "center",
    padding: spacing.screen,
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    padding: spacing.card,
    gap: space[3],
  },
  cardList: { gap: space[2] },
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
  textButton: {
    minHeight: layout.touchMin,
    justifyContent: "center",
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
  },
  textButtonLabel: { color: semantic.text.link },
  textButtonDanger: { color: semantic.text.danger },
  pressed: { opacity: 0.72 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: layout.touchMin,
  },
  checkboxLabel: { flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: semantic.border.interactive,
    borderRadius: 4,
    backgroundColor: semantic.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: semantic.action.primary,
    backgroundColor: semantic.action.primary,
  },
});
