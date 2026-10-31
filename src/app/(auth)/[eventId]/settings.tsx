import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
import { FieldInput } from "@/components/ui/FieldInput";
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
import type { EventDetail } from "@/types/api.types";
import { getApiErrorMessage } from "@/utils/api-error";
import {
  buildConfigWithBankDetails,
  buildConfigWithTheme,
  isValidHexColor,
  toBankDetailsForm,
  toThemeForm,
  type BankDetailsForm,
  type ThemeForm,
} from "@/utils/event-settings-config";

/**
 * 活動設定（parity `settings`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/settings/page.tsx`。
 *
 * ## 這頁與 `(auth)/settings.tsx` 是兩件不同的事
 * `app/(auth)/settings.tsx` 是**登入者**的帳號與 App 偏好；這一頁改的是
 * **活動**的 `configJson`。兩者中文都叫「設定」，但寫入的對象完全不同——
 * 合併會讓「登出」與「改收款帳戶」住在同一個畫面。
 *
 * ## 兩段式儲存不是偷懶
 * Web 也是兩顆獨立的儲存鈕（`handleSaveBankDetails` / `handleSaveTheme`），
 * 各自把 `{ ...configJson, 該區塊 }` 整包送 `PATCH`。合成一顆會讓「只改顏色」
 * 也一併重寫付款指示，萬一那段載入有問題就把好資料蓋掉。
 *
 * ⚠️ 後端 `configJson` 是**整包覆蓋**：只送 `{ bankDetails }` 會把 `theme`
 * 刪掉。合併邏輯在 `@/utils/event-settings-config`，那裡有測試釘住。
 */
const DARK_MODE_OPTIONS = ["off", "on"] as const;

/**
 * 顏色預覽色塊。
 *
 * 只在 `#rgb` / `#rrggbb` 時上色——React Native 對它認不得的顏色字串會丟
 * `Invalid color`，而使用者打的字是自由的。**這不是驗證閘門**：無法預覽
 * 的值照樣存得下去（Web 也不擋），只是沒有色塊可看，並用一行字說明原因。
 */
function ColorPreview({ value }: { value: string }) {
  const usable = isValidHexColor(value);
  return (
    <View style={styles.previewRow}>
      <View
        style={[
          styles.swatch,
          usable ? { backgroundColor: value.trim() } : styles.swatchUnavailable,
        ]}
        accessibilityLabel={copy.eventSettings.colorPreviewLabel}
        testID="settings-theme-swatch"
      />
      {usable ? null : (
        <Text
          style={[type.body, styles.muted]}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          {copy.eventSettings.colorPreviewUnavailable}
        </Text>
      )}
    </View>
  );
}

export default function EventSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [bank, setBank] = useState<BankDetailsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankMessage, setBankMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [theme, setTheme] = useState<ThemeForm | null>(null);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
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
        setBank(toBankDetailsForm(res.event.configJson));
        setTheme(toThemeForm(res.event.configJson));
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

  /** 編輯即清掉上一次的儲存結果，避免「已更新」跟著新輸入一起跑。 */
  function patchBank(next: Partial<BankDetailsForm>) {
    setBankMessage(null);
    setBank((current) => (current ? { ...current, ...next } : current));
  }

  function patchTheme(next: Partial<ThemeForm>) {
    setThemeMessage(null);
    setTheme((current) => (current ? { ...current, ...next } : current));
  }

  async function saveBank() {
    if (!eventId || !bank || !event) return;
    setBankSaving(true);
    setBankMessage(null);
    try {
      const configJson = buildConfigWithBankDetails(event.configJson, bank);
      const res = await eventService.updateEvent(eventId, { configJson });
      setEvent(res.event);
      setBank(toBankDetailsForm(res.event.configJson));
      setBankMessage({
        tone: "success",
        text: copy.eventSettings.bankSaveSuccess,
      });
    } catch (error) {
      setBankMessage({
        tone: "danger",
        text: getApiErrorMessage(error, copy.eventSettings.bankSaveFailed),
      });
    } finally {
      setBankSaving(false);
    }
  }

  async function saveTheme() {
    if (!eventId || !theme || !event) return;
    setThemeSaving(true);
    setThemeMessage(null);
    try {
      const configJson = buildConfigWithTheme(event.configJson, theme);
      const res = await eventService.updateEvent(eventId, { configJson });
      setEvent(res.event);
      setTheme(toThemeForm(res.event.configJson));
      setThemeMessage({
        tone: "success",
        text: copy.eventSettings.themeSaveSuccess,
      });
    } catch (error) {
      setThemeMessage({
        tone: "danger",
        text: getApiErrorMessage(error, copy.eventSettings.themeSaveFailed),
      });
    } finally {
      setThemeSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.eventSettings.title}
        subtitle={copy.eventSettings.subtitle}
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
              message={copy.eventSettings.loadFailed}
            />
          ) : null}

          {loading && !event ? (
            <Text style={[type.body, styles.muted]}>
              {copy.eventSettings.loading}
            </Text>
          ) : null}

          {event ? (
            <>
              {/* 基本資訊（唯讀）：與 Web 同一組欄位 */}
              <Card padding={space[4]} testID="settings-basic-info">
                <Text
                  style={[type.h3, styles.sectionTitle]}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {copy.eventSettings.basicInfoTitle}
                </Text>
                <View style={styles.infoRow}>
                  <Text
                    style={[type.body, styles.infoLabel]}
                    maxFontSizeMultiplier={layout.maxFontScaleBody}
                  >
                    {copy.eventSettings.eventIdLabel}
                  </Text>
                  <Text
                    style={[type.body, styles.infoValue]}
                    maxFontSizeMultiplier={layout.maxFontScaleBody}
                  >
                    {event.id}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text
                    style={[type.body, styles.infoLabel]}
                    maxFontSizeMultiplier={layout.maxFontScaleBody}
                  >
                    Slug
                  </Text>
                  <Text
                    style={[type.body, styles.infoValue]}
                    maxFontSizeMultiplier={layout.maxFontScaleBody}
                  >
                    {event.slug}
                  </Text>
                </View>
                <Text
                  style={[type.body, styles.muted]}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.eventSettings.slugHint}
                </Text>
              </Card>

              {/* 銀行轉賬資料 */}
              <Card padding={space[4]} testID="settings-bank">
                <Text
                  style={[type.h3, styles.sectionTitle]}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {copy.eventSettings.bankTitle}
                </Text>
                <Text
                  style={[type.body, styles.muted]}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.eventSettings.bankHint}
                </Text>

                {bankMessage ? (
                  <InlineBanner
                    compact
                    tone={bankMessage.tone}
                    message={bankMessage.text}
                  />
                ) : null}

                {bank ? (
                  <>
                    <FieldInput
                      label={copy.eventSettings.bankAccountName}
                      value={bank.accountName}
                      onChangeText={(accountName) => patchBank({ accountName })}
                      testID="settings-bank-account-name"
                    />
                    <FieldInput
                      label={copy.eventSettings.bankName}
                      value={bank.bankName}
                      onChangeText={(bankName) => patchBank({ bankName })}
                      testID="settings-bank-name"
                    />
                    <FieldInput
                      label={copy.eventSettings.bankAccountNumber}
                      value={bank.accountNumber}
                      onChangeText={(accountNumber) =>
                        patchBank({ accountNumber })
                      }
                      /**
                       * 帳號預設遮蔽：這個欄位會被旁人看到（現場櫃檯、共用
                       * 平板），而帳號本身就是轉賬憑證。眼睛鈕可暫時顯示，
                       * 標籤不沿用密碼那組字串（讀屏會念錯東西）。
                       */
                      secureTextEntry
                      revealable
                      revealLabel={copy.common.revealAccountNumber}
                      hideLabel={copy.common.hideAccountNumber}
                      placeholder={copy.eventSettings.bankAccountNumberHint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      testID="settings-bank-account-number"
                    />
                    <FieldInput
                      label={copy.eventSettings.bankInstructionsZh}
                      value={bank.instructionsZh}
                      onChangeText={(instructionsZh) =>
                        patchBank({ instructionsZh })
                      }
                      multiline
                      testID="settings-bank-instructions-zh"
                    />
                    <FieldInput
                      label={copy.eventSettings.bankInstructionsEn}
                      value={bank.instructionsEn}
                      onChangeText={(instructionsEn) =>
                        patchBank({ instructionsEn })
                      }
                      multiline
                      autoCapitalize="sentences"
                      testID="settings-bank-instructions-en"
                    />
                    <Button
                      label={
                        bankSaving
                          ? copy.eventSettings.saving
                          : copy.eventSettings.save
                      }
                      loading={bankSaving}
                      onPress={() => void saveBank()}
                      testID="settings-bank-save"
                    />
                  </>
                ) : null}
              </Card>

              {/* 品牌主題設定 */}
              <Card padding={space[4]} testID="settings-theme">
                <Text
                  style={[type.h3, styles.sectionTitle]}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {copy.eventSettings.themeTitle}
                </Text>
                <Text
                  style={[type.body, styles.muted]}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.eventSettings.themeHint}
                </Text>

                {themeMessage ? (
                  <InlineBanner
                    compact
                    tone={themeMessage.tone}
                    message={themeMessage.text}
                  />
                ) : null}

                {theme ? (
                  <>
                    {/*
                     * 顏色輸入不用 Web 的 `<input type="color">`：那是桌面瀏覽器
                     * 的原生色票，React Native 沒有對應元件。改成「純 hex 輸入
                     * ＋ 色塊預覽」，功能等價（打得進去的都能存），而且色塊讓
                     * 使用者不必把色碼記在腦子裡。
                     */}
                    <FieldInput
                      label={copy.eventSettings.primaryColorLabel}
                      value={theme.primaryColor}
                      onChangeText={(primaryColor) =>
                        patchTheme({ primaryColor })
                      }
                      placeholder="#7c3aed"
                      autoCapitalize="none"
                      autoCorrect={false}
                      testID="settings-theme-primary"
                    />
                    <ColorPreview value={theme.primaryColor} />
                    <Text
                      style={[type.body, styles.muted]}
                      maxFontSizeMultiplier={layout.maxFontScaleBody}
                    >
                      {copy.eventSettings.primaryColorHint}
                    </Text>

                    <FieldInput
                      label={copy.eventSettings.hoverColorLabel}
                      value={theme.primaryHoverColor}
                      onChangeText={(primaryHoverColor) =>
                        patchTheme({ primaryHoverColor })
                      }
                      placeholder="#6d28d9"
                      autoCapitalize="none"
                      autoCorrect={false}
                      testID="settings-theme-hover"
                    />
                    <ColorPreview value={theme.primaryHoverColor} />

                    <ChoiceChips
                      label={copy.eventSettings.darkModeLabel}
                      options={DARK_MODE_OPTIONS}
                      value={theme.darkMode ? "on" : "off"}
                      labelFor={(option) =>
                        option === "on"
                          ? copy.eventSettings.darkModeOn
                          : copy.eventSettings.darkModeOff
                      }
                      onSelect={(option) =>
                        patchTheme({ darkMode: option === "on" })
                      }
                      testID="settings-theme-dark-mode"
                    />

                    <Button
                      label={
                        themeSaving
                          ? copy.eventSettings.saving
                          : copy.eventSettings.save
                      }
                      loading={themeSaving}
                      onPress={() => void saveTheme()}
                      testID="settings-theme-save"
                    />
                  </>
                ) : null}
              </Card>
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
  sectionTitle: { marginBottom: space[2] },
  infoRow: { flexDirection: "row", gap: space[2] },
  infoLabel: {
    width: 92,
    color: semantic.text.muted,
  },
  infoValue: {
    flex: 1,
    color: semantic.text.secondary,
    fontWeight: "600",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  swatchUnavailable: {
    backgroundColor: semantic.bg.surfaceSunken,
  },
});
