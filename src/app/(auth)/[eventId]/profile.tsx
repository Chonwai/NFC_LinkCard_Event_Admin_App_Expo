import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { FieldInput } from "@/components/ui/FieldInput";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { eventService } from "@/services/event.service";
import type {
  EventDetail,
  EventLandingPageMode,
  EventStatus,
  EventType,
  UpdateEventPayload,
} from "@/types/api.types";
import {
  hasEventProfileErrors,
  PROFILE_DESCRIPTION_MAX,
  PROFILE_NAME_MAX,
  validateEventProfile,
  type EventProfileErrors,
} from "@/utils/event-profile-validation";
import { EVENT_STATUS_LABEL } from "@/utils/event-status";
import { getApiErrorMessage } from "@/utils/api-error";

/**
 * 活動資料（parity `profile`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/profile/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * ## 為什麼欄位是這九個
 * Web 的 `FormState` 就是這九個，而且**沒有時間欄位**——`Event.startDate /
 * endDate` 只在「建立活動」時寫一次，Web 後台之後改不到。App 若「順手」補上
 * 時間欄位，等於多開一條 Web 沒有的寫入路徑，兩邊行為就分岔了。
 *
 * ## 為什麼清空要送 `null` 而不是 `""`
 * 後端 `UpdateEventDto.externalLandingUrl` 是 `@IsUrl()`，空字串會被
 * class-validator 擋成 400；`null` 則被 `@IsOptional()` 跳過。`toPayload`
 * 因此逐欄用 `form.x || null`，與 Web 一字不差。
 */
interface ProfileForm {
  name: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  venueName: string;
  venueAddress: string;
  isPublic: boolean;
  landingPageMode: EventLandingPageMode;
  externalLandingUrl: string;
}

/**
 * 後端 `/by-id/:eventId` 回的 `status` 在型別上是 `EventStatus | string`
 * （後端 enum 若有新值，App 不該因此炸掉）。但表單是**受控**的：選中值必須是
 * 清單內的一員，否則晶片會全部沒選中、使用者看起來像「狀態不見了」。
 *
 * 因此未知值退回 `DRAFT`（後端第一項），並保留原值於 `EVENT_STATUS_LABEL`
 * 的顯示映射——不吞資訊，只是不把非法值送出去。
 */
const STATUS_OPTIONS: EventStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

const EVENT_TYPE_OPTIONS: EventType[] = [
  "EXHIBITION",
  "CONFERENCE",
  "WORKSHOP_SERIES",
  "MEETUP",
  "OTHER",
];

const LANDING_MODE_OPTIONS: EventLandingPageMode[] = [
  "BUILT_IN",
  "EXTERNAL",
  "NONE",
];

function toStatus(value: EventStatus | string): EventStatus {
  return STATUS_OPTIONS.includes(value as EventStatus)
    ? (value as EventStatus)
    : "DRAFT";
}

function toFormState(event: EventDetail): ProfileForm {
  return {
    name: event.name,
    description: event.description ?? "",
    eventType: event.eventType,
    status: toStatus(event.status),
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    isPublic: event.isPublic,
    landingPageMode: event.landingPageMode,
    externalLandingUrl: event.externalLandingUrl ?? "",
  };
}

/**
 * 表單 → PATCH body。與 Web `handleSave` 的 `payload` 逐欄對應。
 *
 * 空白字串一律轉 `null`：送 `""` 到 `@IsUrl()`／未來可能收緊的字串欄位
 * 都會變成 400，而 `null` 在 `@IsOptional()` 下是合法的「清空」。
 */
function toPayload(form: ProfileForm): UpdateEventPayload {
  return {
    name: form.name,
    description: form.description || null,
    eventType: form.eventType,
    status: form.status,
    venueName: form.venueName || null,
    venueAddress: form.venueAddress || null,
    isPublic: form.isPublic,
    landingPageMode: form.landingPageMode,
    externalLandingUrl: form.externalLandingUrl || null,
  };
}

export default function EventProfileScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EventProfileErrors>({});
  const [saved, setSaved] = useState(false);
  /**
   * 重新載入的觸發計數器。
   *
   * 標頭那顆「重新整理」鈕不能在 effect 內直接呼叫會 `setState` 的函式
   * （`react-hooks/set-state-in-effect`），因此把「重載」表達成「把 key 加一」，
   * 由 effect 自己監聽。載入邏輯只留一份，不必為了重整再寫一遍。
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!eventId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const res = await eventService.getEventById(eventId);
        if (!active) return;
        setEvent(res.event);
        setForm(toFormState(res.event));
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

  /**
   * 任何一次編輯都要清掉「已儲存」提示，否則使用者會以為新改動也存好了。
   *
   * 不清 `saveError`：Web 的 `message` 也只在送出時才更新，停在原地不動。
   * 但**要清該欄位的錯誤**——使用者正在修的那一格不該繼續紅著，那不是
   * Web 的行為（瀏覽器會在 `input` 事件後重新驗證該欄位）。
   */
  function patch(next: Partial<ProfileForm>) {
    setSaved(false);
    setFieldErrors((current) => {
      const keys = Object.keys(next) as (keyof EventProfileErrors)[];
      if (!keys.some((key) => current[key] != null)) return current;
      const nextErrors = { ...current };
      for (const key of keys) delete nextErrors[key];
      return nextErrors;
    });
    setForm((current) => (current ? { ...current, ...next } : current));
  }

  async function save() {
    if (!eventId || !form) return;

    /**
     * 先跑與 Web 相同的三個規則；有任何一格沒過就不送出。
     * Web 靠瀏覽器原生的 `required` / `maxLength` / `type=url` 在送出前就擋，
     * 這裡只是把那道閘門搬到 App。
     */
    const errors = validateEventProfile(form);
    setFieldErrors(errors);
    if (hasEventProfileErrors(errors)) {
      setSaveError(null);
      setSaved(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await eventService.updateEvent(eventId, toPayload(form));
      // 後端回傳整筆活動，直接覆蓋本地狀態（與 Web 的 setEvent(updated) 相同）。
      setEvent(res.event);
      setForm(toFormState(res.event));
      setSaved(true);
    } catch (error) {
      /**
       * 與 Web 一致：伺服器訊息優先。後端會回中文（例如
       * `活動名稱不能超過 120 個字符`），照樣端給使用者；沒有訊息才用泛用文案。
       */
      setSaveError(getApiErrorMessage(error, copy.profile.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.profile.title}
        subtitle={copy.profile.subtitle}
        leading="back"
        backFallbackPath="/(auth)/[eventId]/overview"
        onRefresh={() => setReloadKey((key) => key + 1)}
        isRefreshing={loading}
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
          {loadError ? (
            <InlineBanner
              compact
              tone="danger"
              message={copy.profile.loadFailed}
            />
          ) : null}

          {saved ? (
            <InlineBanner compact tone="success" message={copy.profile.saved} />
          ) : null}
          {saveError ? (
            <InlineBanner compact tone="danger" message={saveError} />
          ) : null}

          {loading && !form ? (
            <Text style={[type.body, styles.muted]}>
              {copy.profile.loading}
            </Text>
          ) : null}

          {form && event ? (
            <>
              <View style={styles.slugBox} testID="profile-slug">
                <Text
                  style={[type.body, styles.muted]}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.profile.slugLabel}：
                  <Text style={styles.slugValue}>{event.slug}</Text>
                  {"　"}
                  {copy.profile.slugReadOnly}
                </Text>
              </View>

              <FieldInput
                label={copy.profile.nameLabel}
                value={form.name}
                onChangeText={(name) => patch({ name })}
                error={fieldErrors.name}
                maxLength={PROFILE_NAME_MAX}
                required
                testID="profile-name"
              />

              <FieldInput
                label={copy.profile.descriptionLabel}
                value={form.description}
                onChangeText={(description) => patch({ description })}
                placeholder={copy.profile.descriptionPlaceholder}
                error={fieldErrors.description}
                maxLength={PROFILE_DESCRIPTION_MAX}
                multiline
                testID="profile-description"
              />

              <ChoiceChips
                label={copy.profile.eventTypeLabel}
                options={EVENT_TYPE_OPTIONS}
                value={form.eventType}
                labelFor={(value) => copy.profile.eventType[value]}
                onSelect={(eventType) => patch({ eventType })}
                testID="profile-event-type"
              />

              <ChoiceChips
                label={copy.profile.statusLabel}
                options={STATUS_OPTIONS}
                value={form.status}
                labelFor={(value) => EVENT_STATUS_LABEL[value] ?? value}
                onSelect={(status) => patch({ status })}
                testID="profile-status"
              />

              <FieldInput
                label={copy.profile.venueNameLabel}
                value={form.venueName}
                onChangeText={(venueName) => patch({ venueName })}
                placeholder={copy.profile.venueNamePlaceholder}
                testID="profile-venue-name"
              />

              <FieldInput
                label={copy.profile.venueAddressLabel}
                value={form.venueAddress}
                onChangeText={(venueAddress) => patch({ venueAddress })}
                placeholder={copy.profile.venueAddressPlaceholder}
                testID="profile-venue-address"
              />

              <ChoiceChips
                label={copy.profile.landingModeLabel}
                options={LANDING_MODE_OPTIONS}
                value={form.landingPageMode}
                labelFor={(value) => copy.profile.landingMode[value]}
                onSelect={(landingPageMode) => patch({ landingPageMode })}
                testID="profile-landing-mode"
              />

              {/* 與 Web 相同：只有 EXTERNAL 才顯示網址欄位，但送出時一律帶上 */}
              {form.landingPageMode === "EXTERNAL" ? (
                <FieldInput
                  label={copy.profile.externalUrlLabel}
                  value={form.externalLandingUrl}
                  onChangeText={(externalLandingUrl) =>
                    patch({ externalLandingUrl })
                  }
                  placeholder={copy.profile.externalUrlPlaceholder}
                  error={fieldErrors.externalLandingUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="profile-external-url"
                />
              ) : null}

              <Pressable
                onPress={() => patch({ isPublic: !form.isPublic })}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.isPublic }}
                testID="profile-is-public"
              >
                <View
                  style={[styles.checkbox, form.isPublic && styles.checkboxOn]}
                >
                  {form.isPublic ? (
                    <Icon
                      name="check"
                      size={14}
                      color={semantic.action.onPrimary}
                    />
                  ) : null}
                </View>
                <Text
                  style={[type.body, styles.checkboxLabel]}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.profile.isPublicLabel}
                </Text>
              </Pressable>

              <Button
                label={saving ? copy.profile.saving : copy.profile.save}
                loading={saving}
                onPress={() => void save()}
                testID="profile-save"
              />
            </>
          ) : null}
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
  muted: { color: semantic.text.muted },
  slugBox: {
    backgroundColor: semantic.bg.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  slugValue: { color: semantic.text.secondary, fontWeight: "600" },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    paddingVertical: space[1],
  },
  checkboxLabel: { flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: semantic.border.interactive,
    borderRadius: 4,
    marginTop: 1,
    backgroundColor: semantic.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: semantic.action.primary,
    backgroundColor: semantic.action.primary,
  },
});
