import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { useFocusRing } from "@/components/ui/useFocusRing";
import { layout, radius, semantic, space, type } from "@/constants/theme";

/** 與 `semantic.status` 對齊；原本的 `error` 更名為 `danger` */
export type InlineBannerTone = "danger" | "warning" | "success" | "info";

export interface InlineBannerProps {
  message: string;
  tone?: InlineBannerTone;
  /** 較長訊息時使用的標題 */
  title?: string;
  /** 行內動作（如「重試」「重新整理」） */
  actionLabel?: string;
  onAction?: () => void;
  /** 可關閉 */
  dismissible?: boolean;
  onDismiss?: () => void;
  testID?: string;
}

/**
 * tone → `semantic.status` 對照。
 *
 * 凍結的 token 系統沒有獨立的 `info` key，因此 `info` 明確 alias 到
 * `status.available`（紫字 on 淺紫底＝6.02 ✅）——
 * **不另創 hex**（鐵律 6），也不新增 token（`theme.ts` 已凍結）。
 */
const TONE_TOKENS = {
  danger: semantic.status.danger,
  warning: semantic.status.warning,
  success: semantic.status.success,
  info: semantic.status.available,
} as const;

const TONE_ICONS: Record<InlineBannerTone, IconName> = {
  danger: "alert-circle",
  warning: "alert-triangle",
  success: "check-circle",
  info: "information-circle",
};

/** 行內動作與關閉鈕的觸控目標（WCAG 2.5.5，≥ 48） */
const TOUCH_TARGET = layout.touchMin;

/**
 * 行內橫幅（**取代**舊版 OCR 錯誤橫幅的 2-tone 限制；舊檔已於 **C12** 刪除）
 * - 4 種 tone（danger / warning / success / info），皆走 `semantic.status`
 * - 可帶行內動作、可關閉（關閉鈕為 48×48）
 * - `danger` 使用 `accessibilityRole="alert"` + assertive live region；
 *   其餘為 `text` + polite（避免非緊急訊息搶奪讀屏焦點）
 */
export function InlineBanner({
  message,
  tone = "info",
  title,
  actionLabel,
  onAction,
  dismissible = false,
  onDismiss,
  testID,
}: InlineBannerProps) {
  const toneToken = TONE_TOKENS[tone];
  const isDanger = tone === "danger";
  /**
   * **M-5 家族**：動作與關閉鈕也是可 Tab 到的 `Pressable`。這裡只補上有品牌色的
   * 聚焦環（`useFocusRing`），不動尺寸與色票——不改 `semantic.status` 的 tone 文字色。
   */
  const actionRing = useFocusRing();
  const dismissRing = useFocusRing();

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: toneToken.bg, borderColor: toneToken.border },
      ]}
      testID={testID}
      accessible={false}
      accessibilityRole={isDanger ? "alert" : "text"}
      accessibilityLiveRegion={isDanger ? "assertive" : "polite"}
    >
      <Icon
        name={TONE_ICONS[tone]}
        size="sm"
        color={toneToken.fg}
        style={styles.icon}
      />

      <View style={styles.content}>
        {title != null ? (
          <Text
            style={[styles.title, { color: toneToken.fg }]}
            numberOfLines={2}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {title}
          </Text>
        ) : null}

        <Text
          style={[styles.message, { color: toneToken.fg }]}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          {message}
        </Text>

        {actionLabel != null && onAction != null ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={[styles.action, actionRing.focusRingStyle]}
            {...actionRing.focusRingProps}
          >
            <Text
              style={[styles.actionLabel, { color: toneToken.fg }]}
              numberOfLines={1}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {dismissible ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="關閉提示"
          style={[styles.dismiss, dismissRing.focusRingStyle]}
          {...dismissRing.focusRingProps}
        >
          <Icon name="close" size="md" color={toneToken.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "stretch",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    marginBottom: space[4],
  },
  /** icon 不壓縮；與文字第一行的光學對齊由 marginTop 微調 */
  icon: { marginTop: space[1] },
  /** 文字區 `flexShrink: 1` 讓長訊息換行而不推擠右側動作 */
  content: { flex: 1, flexShrink: 1, marginLeft: space[2] },
  title: { ...type.label },
  message: { ...type.body },
  action: {
    alignSelf: "flex-start",
    minHeight: TOUCH_TARGET,
    /** 保證 2 字以下的短動作標籤仍滿足 48×48 */
    minWidth: TOUCH_TARGET,
    justifyContent: "center",
    paddingRight: space[4],
  },
  actionLabel: { ...type.label, fontWeight: "600" },
  dismiss: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: space[2],
    marginTop: -space[2],
  },
});
