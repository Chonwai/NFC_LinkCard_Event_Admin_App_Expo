import { Platform } from 'react-native';

/**
 * ⚠️ Web-safe NFC 工具層
 *
 * `react-native-nfc-manager` 只能在 native 端載入——在 web 的 top-level import 會
 * 崩潰（`Cannot read properties of undefined (reading 'onDiscoverTag')`）。
 * 因此所有 NfcManager / Ndef / NfcTech 都以 **dynamic import** 惰性載入，
 * 並先以 `Platform.OS === 'web'` 短路（web 不具備 NFC 能力）。
 */

const isNative = Platform.OS !== 'web';

type NfcManagerModule = typeof import('react-native-nfc-manager');
type NfcManagerModuleType = Awaited<Promise<NfcManagerModule>>;

async function loadNfcManager(): Promise<NfcManagerModuleType> {
    if (!isNative) {
        throw new Error('NFC is not supported on web');
    }
    return import('react-native-nfc-manager');
}

/** Build a URI NDEF message pointing to a profile URL */
export async function buildUriNdefMessage(url: string): Promise<number[]> {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        throw new Error(`Invalid profile URL for NFC write: ${url}`);
    }
    const { Ndef } = await loadNfcManager();
    return Ndef.encodeMessage([Ndef.uriRecord(url)]);
}

/** 將不同來源的 UID 格式收斂為可比對的 canonical hex 字串 */
export function normalizeTagUid(tagUid: string): string {
    return tagUid.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/**
 * Perform a full write session:
 * 1. Request Ndef technology
 * 2. Write message
 * 3. Cancel technology
 *
 * ⚠️  iOS only supports NDEF-formatted tags. Ensure cards are pre-formatted.
 * ⚠️  Web 不支援（直接 throw）。
 */
export async function writeUriToCard(url: string): Promise<{ tagUid: string | null }> {
    const { default: NfcManager, NfcTech } = await loadNfcManager();
    await NfcManager.requestTechnology(NfcTech.Ndef);
    try {
        const tag = await NfcManager.getTag();
        const bytes = await buildUriNdefMessage(url);
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        return {
            tagUid: tag?.id ? normalizeTagUid(tag.id) : null,
        };
    } finally {
        try {
            await NfcManager.cancelTechnologyRequest();
        } catch {
            // session closing race 不阻斷主流程
        }
    }
}

/** 檢查裝置是否支援 NFC（web 恆為 false） */
export async function isNfcSupported(): Promise<boolean> {
    if (!isNative) return false;
    try {
        const { default: NfcManager } = await loadNfcManager();
        return await NfcManager.isSupported();
    } catch {
        return false;
    }
}

/** 初始化 NFC manager（web 直接 no-op 返回） */
export async function startNfc(): Promise<void> {
    if (!isNative) return;
    const { default: NfcManager } = await loadNfcManager();
    await NfcManager.start();
}