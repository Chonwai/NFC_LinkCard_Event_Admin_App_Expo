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

import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
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
import { sessionService } from "@/services/session.service";
import type { EventSession, EventSessionType } from "@/types/session.types";
import { getApiErrorMessage } from "@/utils/api-error";
import {
  emptySessionForm,
  sessionFormError,
  sessionFormFrom,
  toSessionPayload,
  type SessionFormErrorKey,
  type SessionFormInput,
} from "@/utils/session-form";

/**
 * 表單的類型選項，順序照 Web 的 `SESSION_TYPES`（`sessions/page.tsx:22-30`）。
 *
 * 七個值全部來自 Prisma `enum EventSessionType`
 * （`schema.prisma:917-925`）。少一個就會讓某一種場次在手機上建不出來。
 */
const SESSION_TYPES: readonly EventSessionType[] = [
  "WORKSHOP",
  "CONFERENCE",
  "KEYNOTE",
  "PARTY",
  "MEDIA_DAY",
  "PRODUCT_LAUNCH",
  "NETWORKING",
];

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

  /** 新增／編輯表單是否打開。與 Web 一樣是「按了才出現」，預設關著。 */
  const [formOpen, setFormOpen] = useState(false);

  /**
   * 正在編輯的場次；`null` ＝新增。
   *
   * 與 Web 的 `editing` state（`sessions/page.tsx:335`）同一個角色：
   * 開表單時一起決定「這是建立還是編輯」，關表單時一起清掉。
   * 若只靠 `formOpen`，關掉再開會沿用上一次編輯的資料——那是一個很難查的 bug。
   */
  const [editing, setEditing] = useState<EventSession | null>(null);

  /** 寫入結果橫幅（目前只有建立成功會用到；編輯會在同一個位置報結果）。 */
  const [feedback, setFeedback] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);

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
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.sessions.add}
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            style={styles.headerAction}
            testID="sessions-add"
          >
            <Icon name="plus" size="md" color={semantic.action.primary} />
          </Pressable>
        }
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

        {feedback ? (
          <InlineBanner
            compact
            tone={feedback.tone}
            message={feedback.message}
            dismissible
            onDismiss={() => setFeedback(null)}
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
              <SessionCard
                key={session.id}
                session={session}
                onOpenRoster={() => {
                  router.push({
                    pathname:
                      "/(auth)/[eventId]/session-roster/[sessionId]" as never,
                    params: { eventId, sessionId: session.id },
                  });
                }}
                onEdit={() => {
                  setEditing(session);
                  setFormOpen(true);
                }}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {formOpen && eventId ? (
        <SessionFormModal
          eventId={eventId}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={(mode) => {
            setFormOpen(false);
            setEditing(null);
            setFeedback({
              tone: "success",
              message:
                mode === "create"
                  ? copy.sessions.createSuccess
                  : copy.sessions.updateSuccess,
            });
            // 整份重載，不把變更自己拼進本地陣列：`updatedAt` 與排序都在後端。
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
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
function SessionCard({
  session,
  onOpenRoster,
  onEdit,
}: {
  session: EventSession;
  onOpenRoster: () => void;
  onEdit: () => void;
}) {
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

      <View style={styles.cardActions}>
        <Button
          label={copy.sessions.viewRegistrations}
          variant="secondary"
          onPress={onOpenRoster}
          fullWidth={false}
          testID={`session-roster-${session.id}`}
        />
        <Button
          label={copy.sessions.editAction}
          variant="secondary"
          onPress={onEdit}
          fullWidth={false}
          testID={`session-edit-${session.id}`}
        />
      </View>
    </Card>
  );
}

/**
 * 新增／編輯場次的表單。
 *
 * ## 為什麼是自繪 `Modal` 而不是新開一頁
 *
 * 與 `ticket-types.tsx` 的 `TicketTypeFormModal` 同一個理由：這個 repo
 * 全案沒有用過 `Alert.alert`，既有的表單與確認面板都是自繪 `Modal`。
 * 另一個更實際的理由是 Web 也是 modal（`sessions/page.tsx:103-320`），
 * 而且「新增完就立刻在清單看到它」這個流程不需要離開原頁。
 *
 * ## 為什麼錯誤只在第一次送出後才顯示
 *
 * 一打開就滿江紅會讓人以為自己填錯了。`submitted` 之前不顯示錯誤，
 * 之後每一格即時更新——這是 `ticket-types` 之後這個 repo 的既有做法。
 *
 * ## 為什麼時間是文字輸入而不是日期選擇器
 *
 * Web 的 `<input type="datetime-local">` 由瀏覽器提供日曆。RN 沒有內建
 * date picker，而本輪**不加依賴**（Quality Contract）。所以是嚴格格式的
 * 文字欄位，並由 `parseLocalDateTime` 明確擋掉不存在的日期
 * （`2026-02-30` 不會靜默變成 `2026-03-02`）。
 * 這是**輸入方式**的差異，不是能力的差異：送出的資料形狀完全相同。
 */
function SessionFormModal({
  eventId,
  editing,
  onClose,
  onSaved,
}: {
  eventId: string;
  /** `null` ＝新增；有值 ＝編輯該場次（回填的來源）。 */
  editing: EventSession | null;
  onClose: () => void;
  onSaved: (mode: "create" | "update") => void;
}) {
  const [form, setForm] = useState<SessionFormInput>(() =>
    editing ? sessionFormFrom(editing) : emptySessionForm(),
  );
  /** 是否已經按過一次「建立」——之前不顯示任何欄位錯誤。 */
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function update<K extends keyof SessionFormInput>(
    key: K,
    value: SessionFormInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const errorKey = submitted ? sessionFormError(form) : null;
  const errorFor = (key: SessionFormErrorKey): string | null =>
    errorKey === key ? copy.sessions.errors[key] : null;

  async function submit() {
    setSubmitted(true);
    setFailure(null);

    const payload = toSessionPayload(form);
    // 不合法就不送出——錯誤已由上面的 errorKey 顯示在各欄位上。
    if (payload == null) return;

    setSubmitting(true);
    try {
      if (editing) {
        // PATCH 送的是**完整** payload（見 `SessionCreatePayload` 的 `X | null` 段）：
        // 後端是 `!== undefined` 語意，省略的欄位不會被改，而空字串已經在
        // `toSessionPayload` 轉成 `null`，所以「清空主講人」是真的清空。
        await sessionService.updateSession(eventId, editing.id, payload);
        onSaved("update");
      } else {
        await sessionService.createSession(eventId, payload);
        onSaved("create");
      }
    } catch (error) {
      setFailure(getApiErrorMessage(error, copy.sessions.actionError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID="session-form">
          <Text style={type.h3}>
            {editing ? copy.sessions.edit : copy.sessions.add}
          </Text>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formBody}
            keyboardShouldPersistTaps="handled"
          >
            {failure ? (
              <InlineBanner compact tone="danger" message={failure} />
            ) : null}

            <FieldInput
              label={copy.sessions.titleField}
              value={form.title}
              onChangeText={(text) => update("title", text)}
              required
              error={errorFor("titleRequired")}
              testID="session-form-title"
            />

            <ChoiceChips<EventSessionType>
              label={copy.sessions.type}
              options={SESSION_TYPES}
              value={form.sessionType}
              labelFor={(value) => copy.sessions.sessionType[value]}
              onSelect={(value) => update("sessionType", value)}
              testID="session-form-type"
            />

            <FieldInput
              label={copy.sessions.startTime}
              value={form.startDate}
              onChangeText={(text) => update("startDate", text)}
              placeholder={copy.sessions.dateTimePlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              required
              error={errorFor("timeRequired") ?? errorFor("timeInvalid")}
              testID="session-form-start"
            />

            <FieldInput
              label={copy.sessions.endTime}
              value={form.endDate}
              onChangeText={(text) => update("endDate", text)}
              placeholder={copy.sessions.dateTimePlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              required
              error={errorFor("timeRequired") ?? errorFor("timeInvalid")}
              testID="session-form-end"
            />

            <Text style={styles.formHint}>{copy.sessions.dateTimeHint}</Text>

            <FieldInput
              label={copy.sessions.location}
              value={form.location}
              onChangeText={(text) => update("location", text)}
              placeholder={copy.sessions.locationPlaceholder}
              testID="session-form-location"
            />

            <FieldInput
              label={copy.sessions.speaker}
              value={form.speakerName}
              onChangeText={(text) => update("speakerName", text)}
              testID="session-form-speaker"
            />

            <FieldInput
              label={copy.sessions.capacity}
              value={form.capacity}
              onChangeText={(text) => update("capacity", text)}
              placeholder={copy.sessions.unlimited}
              keyboardType="number-pad"
              error={errorFor("capacityInvalid")}
              testID="session-form-capacity"
            />

            <FieldInput
              label={copy.sessions.price}
              value={form.price}
              onChangeText={(text) => update("price", text)}
              keyboardType="decimal-pad"
              error={errorFor("priceInvalid")}
              testID="session-form-price"
            />

            <FieldInput
              label={copy.sessions.tokenCost}
              value={form.tokenCost}
              onChangeText={(text) => update("tokenCost", text)}
              keyboardType="number-pad"
              error={errorFor("tokenCostInvalid")}
              testID="session-form-token-cost"
            />

            <FieldInput
              label={copy.sessions.description}
              value={form.description}
              onChangeText={(text) => update("description", text)}
              multiline
              testID="session-form-description"
            />
          </ScrollView>

          <View style={styles.formActions}>
            <Button
              label={copy.sessions.cancel}
              variant="secondary"
              onPress={onClose}
              disabled={submitting}
              fullWidth={false}
              testID="session-form-cancel"
            />
            <Button
              label={
                submitting
                  ? copy.sessions.saving
                  : editing
                    ? copy.sessions.saveChanges
                    : copy.sessions.create
              }
              onPress={() => void submit()}
              loading={submitting}
              testID="session-form-submit"
            />
          </View>
        </View>
      </View>
    </Modal>
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
  /**
   * 標頭右側的新增鈕。
   *
   * 尺寸走 `layout.touchMin`（48）：標頭上的圖示鈕小於 44pt 就是誤觸製造機。
   */
  headerAction: {
    width: layout.touchMin,
    height: layout.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: semantic.bg.scrim,
    justifyContent: "center",
    padding: spacing.screen,
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    padding: spacing.screen,
    gap: spacing.gap,
    maxHeight: "88%",
  },
  formScroll: { flexGrow: 0 },
  formBody: { gap: spacing.gap, paddingBottom: space[2] },
  formHint: { ...type.caption, color: semantic.text.muted },
  /**
   * 卡片內的動作列。
   *
   * 靠右、帶上分隔線：手機上標題與按鈕之間沒有卡片邊界，不加線會看起來
   * 像按鈕屬於標題本身（與 `polls.tsx` 的 `cardActions` 同一個理由）。
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
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space[2],
  },
});
