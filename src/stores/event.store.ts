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
    /**
     * 請求世代計數器（**不**對外暴露給畫面）。
     *
     * N1：`loadEvents()` 是非同步的，回應回來時 store 可能已經被 `clear()`
     * 重置（登出 / 401 強制登出）。若不做世代比對，**舊帳號的 in-flight 回應
     * 會在 resolve 後無條件寫回 `events`** → 新帳號看到前一帳號的活動清單。
     *
     * 每次 `clear()` 遞增；`loadEvents()` 在寫入前比對自己出發時的世代，
     * 不符則丟棄回應。
     */
    requestId: number;
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
    requestId: 0,

    async loadEvents() {
        if (get().loading) return;
        const requestId = get().requestId;
        // L3：世代比對抽成單一述詞，避免 try/catch 兩處重複同一條件。
        const isCurrent = () => get().requestId === requestId;
        set({ loading: true, error: null });
        try {
            const { events } = await eventService.getMyManagedEvents({ limit: 100 });
            // N1：世代不符 = 期間發生過 `clear()`（登出）→ 丟棄這個回應，
            // 否則會把前一帳號的活動寫回 store。
            if (!isCurrent()) return;
            set({ events, loading: false });
        } catch (err) {
            if (!isCurrent()) return;
            set({ loading: false, error: getApiErrorMessage(err, copy.home.loadFailed) });
        }
    },

    dismissError() {
        set({ error: null });
    },

    clear() {
        // F1 + N1：必須一併重置 `loading` **並**遞增 `requestId`。
        //
        // `loadEvents()` 開頭有 `if (get().loading) return;` 的 re-entrancy guard；
        // 若登出時前一帳號的請求仍在 in-flight（timeout 15s，慢網窗口達秒級），
        // 只清 `events` 會讓 `loading` 卡在 true → 新帳號的首次載入被 guard 直接
        // return（no-op）。
        //
        // 但只重置 `loading` 仍不夠：舊請求 resolve 後會無條件 `set({ events })`，
        // 把前一帳號的活動寫回。因此同時遞增 `requestId`，讓舊回應在寫入前失效。
        set((state) => ({
            events: [],
            error: null,
            loading: false,
            requestId: state.requestId + 1,
        }));
    },
}));
