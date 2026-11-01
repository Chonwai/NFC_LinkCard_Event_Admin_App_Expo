import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router } from "expo-router";

import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { FieldInput } from "@/components/ui/FieldInput";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { eventService } from "@/services/event.service";
import { useEventStore } from "@/stores/event.store";
import { getApiErrorMessage } from "@/utils/api-error";
import {
  CREATE_EVENT_DESCRIPTION_MAX,
  CREATE_EVENT_NAME_MAX,
  CREATE_EVENT_TIMEZONES,
  CREATE_EVENT_TYPES,
  emptyCreateEventForm,
  slugFromName,
  toCreateEventPayload,
  type CreateEventFormInput,
} from "@/utils/event-create-form";

/**
 * 建立活動（parity `events-list` 的另一半）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/events/page.tsx`
 * 的 `CreateEventModal`。Web 把它做成清單頁上的對話框；App 做成獨立一頁，
 * 因為七個欄位裡有一個 500 字的說明框，在手機的對話框裡是折磨。
 * **欄位、預設值、送出的 body 與成功後去哪一頁，四者都與 Web 相同。**
 *
 * ## 成功後為什麼是 replace 到「活動資料」
 * Web 的 `onCreated` 是 `router.push('/manage/{eventId}/profile')`
 * ——剛建立的活動是 `DRAFT`、沒有任何報名，所以下一步一定是補資料。
 * App 對應 `/(auth)/[eventId]/profile`。用 `replace` 而不是 `push`：
 * 建立完再按返回，回到一張「建立活動」的空表單並不會發生任何好事
 * （重按一次就會建出第二個活動）。
 *
 * ## 為什麼送出前先刷新清單
 * `home.tsx` 的清單來自 `event.store`，它只在 mount 與手動重整時載入。
 * 不刷新的話，使用者建立完按返回會看到一份**沒有新活動**的清單，
 * 看起來像建立失敗。`loadEvents()` 會覆蓋 store，因此不會出現重複項。
 */
export default function NewEventScreen() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<CreateEventFormInput>(emptyCreateEventForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * 改名稱時同步重算 slug——照 Web `handleNameChange`
   * （`manage/events/page.tsx:60-67`）。使用者在 slug 欄位手動改過的內容
   * 會被下一次改名覆蓋，Web 也是這個行為。
   */
  function handleNameChange(name: string) {
    setForm((current) => ({ ...current, name, slug: slugFromName(name) }));
    setSubmitError(null);
  }

  async function submit() {
    const payload = toCreateEventPayload(form);
    if (payload == null) {
      // 時間欄位還不能解析。1c 會把這裡換成逐欄位訊息；此刻只確保
      // **不會送出一個後端必定 400 的請求**。
      setSubmitError(copy.createEvent.errors.createFailed);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const { event } = await eventService.createEvent(payload);
      const store = useEventStore.getState();
      store.selectEvent(event.id);
      await store.loadEvents();
      router.replace({
        pathname: "/(auth)/[eventId]/profile",
        params: { eventId: event.id },
      });
    } catch (error) {
      /**
       * 與 Web 一致：伺服器訊息優先。後端會回中文
       * （例如 `活動標識符已存在，請使用其他 slug`），照樣端給使用者；
       * 沒有訊息才用 Web 的泛用文案 `建立失敗，請稍後重試`。
       */
      setSubmitError(
        getApiErrorMessage(error, copy.createEvent.errors.createFailed),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.createEvent.title}
        subtitle={copy.createEvent.subtitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + spacing.safeFooter },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {submitError ? (
            <InlineBanner compact tone="danger" message={submitError} />
          ) : null}

          <FieldInput
            label={copy.createEvent.nameLabel}
            value={form.name}
            onChangeText={handleNameChange}
            placeholder="StartupFest 2026"
            maxLength={CREATE_EVENT_NAME_MAX}
            required
            testID="new-event-name"
          />

          <View style={styles.slugBlock}>
            <FieldInput
              label={copy.createEvent.slugLabel}
              value={form.slug}
              onChangeText={(slug) =>
                setForm((current) => ({
                  ...current,
                  slug: slug.toLowerCase(),
                }))
              }
              autoCapitalize="none"
              autoCorrect={false}
              required
              testID="new-event-slug"
            />
            <Text
              style={styles.hint}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.createEvent.slugPrefix}
              {form.slug || "…"}
            </Text>
            <Text
              style={styles.hint}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.createEvent.slugHint}
            </Text>
          </View>

          <FieldInput
            label={copy.createEvent.startDateLabel}
            value={form.startDate}
            onChangeText={(startDate) =>
              setForm((current) => ({ ...current, startDate }))
            }
            placeholder="2026-11-01 09:00"
            autoCapitalize="none"
            autoCorrect={false}
            required
            testID="new-event-start-date"
          />

          <FieldInput
            label={copy.createEvent.endDateLabel}
            value={form.endDate}
            onChangeText={(endDate) =>
              setForm((current) => ({ ...current, endDate }))
            }
            placeholder="2026-11-02 18:00"
            autoCapitalize="none"
            autoCorrect={false}
            required
            testID="new-event-end-date"
          />

          <Text
            style={styles.hint}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {copy.createEvent.dateHint}
          </Text>

          <ChoiceChips
            label={copy.createEvent.eventTypeLabel}
            options={CREATE_EVENT_TYPES}
            value={form.eventType}
            labelFor={(value) => copy.profile.eventType[value] ?? value}
            onSelect={(eventType) =>
              setForm((current) => ({ ...current, eventType }))
            }
            testID="new-event-type"
          />

          <ChoiceChips
            label={copy.createEvent.timezoneLabel}
            options={CREATE_EVENT_TIMEZONES}
            value={form.timezone}
            labelFor={(value) => value}
            onSelect={(timezone) =>
              setForm((current) => ({ ...current, timezone }))
            }
            testID="new-event-timezone"
          />

          <FieldInput
            label={copy.createEvent.descriptionLabel}
            value={form.description}
            onChangeText={(description) =>
              setForm((current) => ({ ...current, description }))
            }
            placeholder={copy.createEvent.descriptionPlaceholder}
            maxLength={CREATE_EVENT_DESCRIPTION_MAX}
            multiline
            testID="new-event-description"
          />

          <Button
            label={
              submitting ? copy.createEvent.creating : copy.createEvent.create
            }
            loading={submitting}
            onPress={() => void submit()}
            testID="new-event-submit"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[3],
    gap: space[3],
  },
  slugBlock: { gap: space[2] },
  hint: {
    ...type.caption,
    color: semantic.text.muted,
  },
});
