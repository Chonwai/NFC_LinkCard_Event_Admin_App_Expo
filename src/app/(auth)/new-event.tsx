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
import { getApiErrorCode, getApiErrorMessage } from "@/utils/api-error";
import {
  CREATE_EVENT_DESCRIPTION_MAX,
  CREATE_EVENT_NAME_MAX,
  CREATE_EVENT_TIMEZONES,
  CREATE_EVENT_TYPES,
  createEventFormErrors,
  emptyCreateEventForm,
  hasCreateEventErrors,
  slugFromName,
  toCreateEventPayload,
  type CreateEventErrorKey,
  type CreateEventField,
  type CreateEventFormErrors,
  type CreateEventFormInput,
} from "@/utils/event-create-form";

/**
 * 錯誤鍵 → 文案。Web 走 i18next，App 走 `copy`；指到的都是同一批句子。
 * 放在模組層級：它只依賴 `copy`，每次 render 重建一份沒有意義。
 */
const ERROR_COPY: Record<CreateEventErrorKey, string> = {
  nameMin: copy.createEvent.errors.nameMin,
  nameMax: copy.createEvent.errors.nameMax,
  slugRequired: copy.createEvent.errors.slugRequired,
  slugFormat: copy.createEvent.errors.slugFormat,
  startDateRequired: copy.createEvent.errors.startDateRequired,
  endDateRequired: copy.createEvent.errors.endDateRequired,
  endDateBeforeStart: copy.createEvent.errors.endDateBeforeStart,
  dateFormat: copy.createEvent.errors.dateFormat,
  slugConflict: copy.createEvent.errors.slugConflict,
};

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
  const [fieldErrors, setFieldErrors] = useState<CreateEventFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * 改某一格就抹掉那一格的舊錯誤（與 Web 每次 submit 重算 `errors` 等價，
   * 但使用者一改就看到紅字消失，不必再按一次）。
   */
  function patch(next: Partial<CreateEventFormInput>) {
    setForm((current) => ({ ...current, ...next }));
    setSubmitError(null);
    setFieldErrors((current) => {
      const touched = Object.keys(next).filter(
        (key) => key in current,
      ) as CreateEventField[];
      if (touched.length === 0) return current;
      const nextErrors = { ...current };
      for (const key of touched) delete nextErrors[key];
      return nextErrors;
    });
  }

  /**
   * 改名稱時同步重算 slug——照 Web `handleNameChange`
   * （`manage/events/page.tsx:60-67`）。使用者在 slug 欄位手動改過的內容
   * 會被下一次改名覆蓋，Web 也是這個行為。
   */
  function handleNameChange(name: string) {
    patch({ name, slug: slugFromName(name) });
  }

  async function submit() {
    /**
     * 先跑與 Web 同一組規則（`page.tsx:64-75`）；有任何一格沒過就不送出。
     * Web 靠這段自己算完再 `return`，App 照同一個順序。
     */
    const errors = createEventFormErrors(form);
    setFieldErrors(errors);
    if (hasCreateEventErrors(errors)) {
      setSubmitError(null);
      return;
    }

    const payload = toCreateEventPayload(form);
    if (payload == null) {
      // 理論上到不了：上方驗證已經把解析失敗的情況標成 `dateFormat`。
      // 留著是因為 `toCreateEventPayload` 的簽章允許 null，而「送一個
      // 必定 400 的請求」比「不送出」糟得多。
      setSubmitError(copy.createEvent.errors.dateFormat);
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
       * 與 Web 一致：slug 撞號打在 slug 欄位上（Web 把
       * `EVENT_SLUG_CONFLICT` 轉成 `errors.slug`），其餘用伺服器訊息當橫幅。
       *
       * 刻意不複製 Web 對 `VALIDATION_ERROR` 的處理：Web 寫的是
       * `Object.entries(err.details ?? {})`，假設 `details` 是物件；而後端
       * `ApiResponse.validationError`（`ApiResponse.ts:129-156`，422）回的是
       * `{ property, message }[]`。照抄會把陣列索引當欄位名（`errors["0"]`），
       * 畫面上一個字都不會出現。這裡改成直接把伺服器訊息顯示在橫幅。
       */
      if (getApiErrorCode(error) === "EVENT_SLUG_CONFLICT") {
        setFieldErrors({ slug: "slugConflict" });
        setSubmitError(null);
      } else {
        setSubmitError(
          getApiErrorMessage(error, copy.createEvent.errors.createFailed),
        );
      }
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
            error={fieldErrors.name ? ERROR_COPY[fieldErrors.name] : null}
            maxLength={CREATE_EVENT_NAME_MAX}
            required
            testID="new-event-name"
          />

          <View style={styles.slugBlock}>
            <FieldInput
              label={copy.createEvent.slugLabel}
              value={form.slug}
              onChangeText={(slug) => patch({ slug: slug.toLowerCase() })}
              error={fieldErrors.slug ? ERROR_COPY[fieldErrors.slug] : null}
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
            onChangeText={(startDate) => patch({ startDate })}
            placeholder="2026-11-01 09:00"
            error={
              fieldErrors.startDate ? ERROR_COPY[fieldErrors.startDate] : null
            }
            autoCapitalize="none"
            autoCorrect={false}
            required
            testID="new-event-start-date"
          />

          <FieldInput
            label={copy.createEvent.endDateLabel}
            value={form.endDate}
            onChangeText={(endDate) => patch({ endDate })}
            placeholder="2026-11-02 18:00"
            error={fieldErrors.endDate ? ERROR_COPY[fieldErrors.endDate] : null}
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
            onSelect={(eventType) => patch({ eventType })}
            testID="new-event-type"
          />

          <ChoiceChips
            label={copy.createEvent.timezoneLabel}
            options={CREATE_EVENT_TIMEZONES}
            value={form.timezone}
            labelFor={(value) => value}
            onSelect={(timezone) => patch({ timezone })}
            testID="new-event-timezone"
          />

          <FieldInput
            label={copy.createEvent.descriptionLabel}
            value={form.description}
            onChangeText={(description) => patch({ description })}
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
