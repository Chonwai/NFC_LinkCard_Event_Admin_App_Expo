import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

/** Build a URI NDEF message pointing to a profile URL */
export function buildUriNdefMessage(url: string): number[] {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        throw new Error(`Invalid profile URL for NFC write: ${url}`);
    }
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
 */
export async function writeUriToCard(url: string): Promise<{ tagUid: string | null }> {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    try {
        const tag = await NfcManager.getTag();
        const bytes = buildUriNdefMessage(url);
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

/** 檢查裝置是否支援 NFC */
export async function isNfcSupported(): Promise<boolean> {
    try {
        return await NfcManager.isSupported();
    } catch {
        return false;
    }
}

/** 初始化 NFC manager */
export async function startNfc(): Promise<void> {
    await NfcManager.start();
}