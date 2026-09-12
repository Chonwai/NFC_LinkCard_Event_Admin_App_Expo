/**
 * Session Notice — useSyncExternalStore pattern (matches Promoter App)
 *
 * Provides a lightweight signal for auth state transitions (expired/suspended)
 * that hydrate() or the api interceptor can broadcast, and the login screen
 * can consume without adding to the zustand auth store's scope.
 */
import { useSyncExternalStore } from 'react';

import type { TerminalAuthReason } from '@/utils/api-error';

export type SessionNotice = TerminalAuthReason;

let notice: SessionNotice | null = null;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach(listener => listener());
}

export function setSessionNotice(next: SessionNotice): void {
    if (notice === next) return;
    notice = next;
    emit();
}

export function clearSessionNotice(): void {
    if (notice === null) return;
    notice = null;
    emit();
}

export function getSessionNotice(): SessionNotice | null {
    return notice;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function useSessionNotice(): SessionNotice | null {
    return useSyncExternalStore(subscribe, getSessionNotice, getSessionNotice);
}
