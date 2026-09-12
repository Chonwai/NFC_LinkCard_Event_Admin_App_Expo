import { create } from 'zustand';

import type { ManagedEventItem } from '@/types/api.types';

import { eventService } from '@/services/event.service';

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
            set({ loading: false, error: err instanceof Error ? err.message : '載入活動失敗' });
        }
    },

    selectEvent(id: string) {
        set({ currentEventId: id });
    },

    clear() {
        set({ events: [], currentEventId: null, error: null });
    },
}));