import { create } from "zustand";

import { TOKEN_STORAGE_KEY } from "@/constants/config";
import type { AuthUser } from "@/types/api.types";
import { getTerminalAuthReason } from "@/utils/api-error";
import { setSessionNotice } from "@/utils/session-notice";
import { tokenStorage } from "@/utils/storage";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/**
 * 清除活動快取（A4：登出後不得殘留前一帳號的活動清單）。
 *
 * ⚠️ **必須用 dynamic import**，不可寫成 top-level static import。
 *
 * 靜態相依會形成 cycle：`auth.store` → `event.store` → `event.service` →
 * `services/api.ts` → `auth.store`。在 ESM 的模組初始化順序下，該 cycle 會讓
 * 其中一端的綁定在初始化期間尚未賦值（TDZ／`undefined`），而 `api.ts` 是在
 * module scope 直接引用 `useAuthStore`。
 *
 * dynamic import 在「呼叫當下」才解析模組（此時所有 module 皆已初始化完成），
 * 因此靜態相依圖保持無環。這與 `hydrate()` 對 `auth.service` 採用 dynamic import
 * 是同一個既定模式（`api.ts` 的註解亦記載同一原因）。
 */
async function clearEventCache(): Promise<void> {
  try {
    const { useEventStore } = await import("@/stores/event.store");
    useEventStore.getState().clear();
  } catch {
    // 快取清除失敗不得阻斷登出：憑證已移除，cookie/token 失效才是安全邊界。
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: async (token, user) => {
    await tokenStorage.setItem(TOKEN_STORAGE_KEY, token);
    set({ token, user, isAuthenticated: true, isHydrated: true });
  },

  logout: async () => {
    await tokenStorage.deleteItem(TOKEN_STORAGE_KEY);
    // A4：清空活動快取，避免 B 帳號登入後看到 A 帳號的活動清單。
    // 401 強制登出（`api.ts` interceptor）同樣呼叫本方法，因此一併覆蓋。
    await clearEventCache();
    set({ token: null, user: null, isAuthenticated: false });
  },

  /**
   * 從持久化儲存還原登入狀態（App 啟動時由 `_layout.tsx` 呼叫一次）。
   *
   * 與 Promoter App 同 pattern：取得 token 後呼叫 `authService.me()` 還原 user。
   * 失敗時分流：401/403 終止態 → 清除憑證；其餘（網路錯誤/5xx）→ 保留 token，
   * 進入「已登入但身分未取得」的可重試態。
   */
  hydrate: async () => {
    const token = await tokenStorage.getItem(TOKEN_STORAGE_KEY);

    if (token == null || token === "") {
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
      return;
    }

    try {
      const { authService } = await import("@/services/auth.service");
      const user = await authService.me();
      set({ token, user, isAuthenticated: true, isHydrated: true });
    } catch (error) {
      const terminalReason = getTerminalAuthReason(error);

      if (terminalReason != null) {
        await tokenStorage.deleteItem(TOKEN_STORAGE_KEY);
        setSessionNotice(terminalReason);
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isHydrated: true,
        });
        return;
      }

      set({ token, user: null, isAuthenticated: true, isHydrated: true });
    }
  },
}));
