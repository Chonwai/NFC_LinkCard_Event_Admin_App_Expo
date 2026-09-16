import { create } from 'zustand';

import { copy } from '@/constants/copy.zh-TW';
import type { ManagedEventItem } from '@/types/api.types';
import { getApiErrorMessage } from '@/utils/api-error';

import { eventService } from '@/services/event.service';

interface EventState {
    events: ManagedEventItem[];
    loading: boolean;
    /**
     * 載入失敗訊息（`null` = 無錯誤）——**唯一來源**。
     *
     * A1 決策 (b)：不在 store 內 rethrow，改由畫面（`home.tsx`）解構本欄位並渲染
     * `InlineBanner`。錯誤文案在此處就轉成使用者可見文字（後端訊息優先，否則退回
     * `copy.home.loadFailed`），避免畫面直接顯示 axios 的英文原始訊息。
     */
    error: string | null;
    loadEvents: () => Promise<void>;
    /** 關閉錯誤橫幅（`InlineBanner` 的 `onDismiss`）；`loadEvents` 開頭亦會重置 */
    dismissError: () => void;
    /** 清空活動快取（登出 / 401 強制登出時由 `auth.store` 呼叫） */
    clear: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
    events: [],
    loading: false,
    error: null,

    async loadEvents() {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
            const { events } = await eventService.getMyManagedEvents({ limit: 100 });
            set({ events, loading: false });
        } catch (err) {
            set({ loading: false, error: getApiErrorMessage(err, copy.home.loadFailed) });
        }
    },

    dismissError() {
        set({ error: null });
    },

    clear() {
        set({ events: [], error: null });
    },
}));