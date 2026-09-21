import { create } from "zustand";

import { copy } from "@/constants/copy.zh-TW";
import type { ManagedEventItem } from "@/types/api.types";

import { eventService } from "@/services/event.service";

interface EventState {
  events: ManagedEventItem[];
  currentEventId: string | null;
  loading: boolean;
  error: string | null;
  loadEvents: () => Promise<void>;
  selectEvent: (id: string) => void;
  clear: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  currentEventId: null,
  loading: false,
  error: null,

  async loadEvents() {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const { events } = await eventService.getMyManagedEvents({ limit: 100 });
      set({ events, loading: false });
    } catch (err) {
      set({
        loading: false,
        /**
         * 這是使用者可見文字（列表頁的錯誤橫幅會有同樣一句），因此走 `copy`。
         * 沿用 `copy.home.loadFailed` 的同一個鍵，不在此另立一份重複字串；
         * 畫面自己 catch 時也拿同一個鍵（`NEW-D2-04`）。
         */
        error: err instanceof Error ? err.message : copy.home.loadFailed,
      });
    }
  },

  selectEvent(id: string) {
    set({ currentEventId: id });
  },

  clear() {
    set({ events: [], currentEventId: null, error: null });
  },
}));
