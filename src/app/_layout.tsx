import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { semantic } from "@/constants/theme";
import { useAuthStore } from "@/stores/auth.store";

const WEB_VIEWPORT_STYLE_ID = "lc-admin-viewport-lock";

/**
 * 根佈局
 * - `SafeAreaProvider`：全域 safe-area 來源
 * - `Stack`：login / (auth) / (auth)/[eventId] 三個群組
 * - `StatusBar`：深色文字（淺色底）
 * - auth guard：未登入 → `/`；已登入且不在 (auth) → `/(auth)/home`
 */
export default function RootLayout() {
  const { isAuthenticated, isHydrated, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  /** Dev web 不會走 +html.tsx，執行期注入 100dvh，避免手機模式裁掉底部 Tab */
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById(WEB_VIEWPORT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = WEB_VIEWPORT_STYLE_ID;
    style.textContent = `
      html, body, #root {
        height: 100% !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        margin: 0;
        overflow: hidden !important;
      }
      #root { display: flex; }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && inAuthGroup) {
      router.replace("/");
    } else if (isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/home");
    }
  }, [isAuthenticated, isHydrated, segments, router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: semantic.bg.canvas,
            flex: 1,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
