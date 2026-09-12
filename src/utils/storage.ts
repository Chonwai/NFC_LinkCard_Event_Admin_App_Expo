import { Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform token storage.
 * - iOS/Android: expo-secure-store (Keychain/Keystore encrypted)
 * - Web: localStorage fallback (SecureStore is a native-only module)
 */
const webStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            return globalThis.localStorage?.getItem(key) ?? null;
        } catch {
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        try {
            globalThis.localStorage?.setItem(key, value);
        } catch {
            // ignore quota/security errors on web
        }
    },
    async deleteItem(key: string): Promise<void> {
        try {
            globalThis.localStorage?.removeItem(key);
        } catch {
            // ignore
        }
    },
};

const nativeStorage = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    deleteItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const tokenStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
