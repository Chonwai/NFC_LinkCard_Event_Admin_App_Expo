import { create } from 'zustand';

import { TOKEN_STORAGE_KEY } from '@/constants/config';
import type { AuthUser } from '@/types/api.types';
import { getTerminalAuthReason } from '@/utils/api-error';
import { setSessionNotice } from '@/utils/session-notice';
import { tokenStorage } from '@/utils/storage';

interface AuthState {
    token: string | null;
    user: AuthUser | null;
    isAuthenticated: boolean;
    isHydrated: boolean;
    setAuth: (token: string, user: AuthUser) => Promise<void>;
    logout: () => Promise<void>;
    hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
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

        if (token == null || token === '') {
            set({ token: null, user: null, isAuthenticated: false, isHydrated: true });
            return;
        }

        try {
            const { authService } = await import('@/services/auth.service');
            const user = await authService.me();
            set({ token, user, isAuthenticated: true, isHydrated: true });
        } catch (error) {
            const terminalReason = getTerminalAuthReason(error);

            if (terminalReason != null) {
                await tokenStorage.deleteItem(TOKEN_STORAGE_KEY);
                setSessionNotice(terminalReason);
                set({ token: null, user: null, isAuthenticated: false, isHydrated: true });
                return;
            }

            set({ token, user: null, isAuthenticated: true, isHydrated: true });
        }
    },
}));