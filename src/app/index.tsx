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

import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldInput } from "@/components/ui/FieldInput";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
import { Logo } from "@/components/ui/Logo";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import {
  getApiErrorCode,
  getApiErrorStatus,
  isNetworkError,
  isServerError,
} from "@/utils/api-error";
import { PromoterAccessError } from "@/utils/login-error";
import {
  type SessionNotice,
  clearSessionNotice,
  useSessionNotice,
} from "@/utils/session-notice";
import { isValidEmail } from "@/utils/validation";

/** 行內錯誤（取代中斷式系統彈窗的流程） */
interface LoginBanner {
  tone: InlineBannerTone;
  message: string;
  actionLabel?: string;
}

/**
 * `hydrate()` 終止憑證後留下的通知 → 登入頁橫幅。
 * 帳號停用（suspended）與登入狀態過期（expired）是不同訊息。
 */
const SESSION_NOTICE_BANNERS: Record<SessionNotice, LoginBanner> = {
  expired: { tone: "warning", message: copy.auth.sessionExpired },
  suspended: { tone: "danger", message: copy.auth.errorSuspended },
};

/**
 * 登入頁
 *
 * - 錯誤一律走 `InlineBanner`（不中斷流程）
 * - `Logo` mark 補上品牌識別
 * - 錯誤分類依 HTTP 狀態與網路特徵（401 / 網路 / 5xx）
 */
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<LoginBanner | null>(null);
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessionNotice = useSessionNotice();

  const classifyLoginError = (error: unknown): LoginBanner => {
    const status = getApiErrorStatus(error);
    const code = getApiErrorCode(error);

    if (
      error instanceof PromoterAccessError ||
      code === "PROMOTER_ACCESS_REQUIRED"
    ) {
      return { tone: "danger", message: copy.auth.errorNoPromoterAccess };
    }

    if (code === "PROMOTER_SUSPENDED") {
      return { tone: "danger", message: copy.auth.accountSuspended };
    }

    // 401 = 帳號或密碼錯誤
    if (status === 401) {
      return { tone: "danger", message: copy.auth.loginFailed };
    }

    // 403 = 帳號停用
    if (status === 403) {
      return { tone: "danger", message: copy.auth.accountSuspended };
    }

    if (status === 429) {
      return { tone: "warning", message: copy.auth.errorRateLimited };
    }

    if (isNetworkError(error)) {
      return { tone: "warning", message: copy.auth.errorNetwork };
    }

    if (isServerError(error)) {
      return { tone: "danger", message: copy.auth.errorServer(status) };
    }

    return { tone: "danger", message: copy.auth.errorUnknown };
  };

  const displayedBanner: LoginBanner | null =
    banner ??
    (sessionNotice != null ? SESSION_NOTICE_BANNERS[sessionNotice] : null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setBanner({ tone: "danger", message: copy.auth.errorEmpty });
      return;
    }

    if (!isValidEmail(email.trim())) {
      setBanner({ tone: "danger", message: copy.auth.errorEmail });
      return;
    }

    setBanner(null);
    setLoading(true);

    try {
      const data = await authService.login(email.trim(), password);
      await setAuth(data.token, data.user);
      clearSessionNotice();
      router.replace("/(auth)/home");
    } catch (error) {
      setBanner(classifyLoginError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.group },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Logo size="lg" withWordmark direction="column" />

        <Text
          style={styles.title}
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={layout.maxFontScaleFixed}
        >
          {copy.auth.loginButton}
        </Text>
        <Text
          style={styles.subtitle}
          numberOfLines={2}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          {copy.app.tagline}
        </Text>

        <Card padding={space[5]} style={styles.card}>
          <FieldInput
            label={copy.auth.emailLabel}
            value={email}
            onChangeText={setEmail}
            placeholder={copy.auth.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            required
            style={styles.field}
          />

          <FieldInput
            label={copy.auth.passwordLabel}
            value={password}
            onChangeText={setPassword}
            placeholder={copy.auth.passwordPlaceholder}
            editable={!loading}
            required
            secureTextEntry
            revealable
            style={styles.field}
          />

          {displayedBanner != null ? (
            <InlineBanner
              tone={displayedBanner.tone}
              message={displayedBanner.message}
              actionLabel={displayedBanner.actionLabel}
              onAction={
                displayedBanner.actionLabel != null
                  ? () => void handleLogin()
                  : undefined
              }
            />
          ) : null}

          <View
            accessible={false}
            accessibilityState={{ busy: loading }}
            aria-busy={loading}
          >
            <Button
              label={loading ? copy.auth.loginLoading : copy.auth.loginButton}
              onPress={() => void handleLogin()}
              size="lg"
              loading={loading}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.safeFooter,
    alignItems: "center",
  },
  title: {
    ...type.h1,
    color: semantic.text.primary,
    marginTop: spacing.section,
  },
  subtitle: {
    ...type.body,
    color: semantic.text.secondary,
    marginTop: space[2],
    textAlign: "center",
  },
  card: { alignSelf: "stretch", marginTop: spacing.section },
  field: { marginBottom: spacing.gap },
});
