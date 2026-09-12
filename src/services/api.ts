import { create } from 'axios';

import { API_BASE_URL, API_TIMEOUT_MS, TOKEN_STORAGE_KEY } from '@/constants/config';
// Import via lazy getter to avoid circular dep at module init time
import { useAuthStore } from '@/stores/auth.store';
import { getTerminalAuthReason } from '@/utils/api-error';
import { setSessionNotice } from '@/utils/session-notice';
import { tokenStorage } from '@/utils/storage';

export const apiClient = create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
apiClient.interceptors.request.use(async config => {
    const token = await tokenStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle terminal auth failures globally: clear token and let router redirect.
// Skip the login endpoint — a 401 there means bad credentials, not an expired session.
apiClient.interceptors.response.use(
    res => res,
    async error => {
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        const terminalReason = isLoginRequest ? null : getTerminalAuthReason(error);
        const auth = useAuthStore.getState();
        const alreadyTerminated = auth.isHydrated && auth.token == null;

        if (terminalReason != null && !alreadyTerminated) {
            setSessionNotice(terminalReason);
            auth.logout().catch(() => undefined);
        }

        return Promise.reject(error as Error);
    }
);
