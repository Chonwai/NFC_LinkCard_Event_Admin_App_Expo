import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  getApiErrorStatus,
  isNetworkError,
  isServerError,
} from "@/utils/api-error";
import {
  loadRememberedLogin,
  saveRememberedLogin,
} from "@/utils/remembered-login";
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
 * - 窄屏：較小 Logo、較緊間距，避免鍵盤彈起時表單被擠出可視區
 * - 成功登入後記住 Email／密碼，登出再進頁可預填
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
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 720;

  useEffect(() => {
    let active = true;
    void loadRememberedLogin().then((remembered) => {
      if (!active || remembered == null) return;
      setEmail((previous) =>
        previous.trim() === "" ? remembered.email : previous,
      );
      setPassword((previous) =>
        previous === "" ? remembered.password : previous,
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const classifyLoginError = (error: unknown): LoginBanner => {
    const status = getApiErrorStatus(error);

    // 401 = 帳號或密碼錯誤
    if (status === 401) {
      return { tone: "danger", message: copy.auth.loginFailed };
    }

    // 403 = 帳號停用
    if (status === 403) {
      return { tone: "danger", message: copy.auth.accountSuspended };
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
      const trimmedEmail = email.trim();
      const data = await authService.login(trimmedEmail, password);
      await setAuth(data.token, data.user);
      await saveRememberedLogin(trimmedEmail, password);
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
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (compact ? space[4] : space[6]),
            paddingBottom: Math.max(insets.bottom, space[4]) + space[4],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Logo
          size={compact ? "md" : "lg"}
          withWordmark
          direction="column"
        />

        <Text
          style={[styles.title, compact && styles.titleCompact]}
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

        <Card
          padding={compact ? space[4] : space[5]}
          style={[styles.card, compact && styles.cardCompact]}
        >
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
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    alignItems: "center",
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  title: {
    ...type.h1,
    color: semantic.text.primary,
    marginTop: space[5],
    textAlign: "center",
  },
  titleCompact: {
    ...type.h2,
    marginTop: space[4],
  },
  subtitle: {
    ...type.caption,
    color: semantic.text.secondary,
    marginTop: space[1],
    textAlign: "center",
  },
  card: {
    alignSelf: "stretch",
    marginTop: space[5],
    width: "100%",
  },
  cardCompact: {
    marginTop: space[4],
  },
  field: { marginBottom: space[3] },
});
