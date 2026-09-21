import { Platform } from "react-native";

import { WEB_BASE_URL } from "@/constants/config";

/**
 * ⚠️ Web-safe NFC 工具層
 *
 * `react-native-nfc-manager` 只能在 native 端載入——在 web 的 top-level import 會
 * 崩潰（`Cannot read properties of undefined (reading 'onDiscoverTag')`）。
 * 因此所有 NfcManager / Ndef / NfcTech 都以 **dynamic import** 惰性載入，
 * 並先以 `Platform.OS === 'web'` 短路（web 不具備 NFC 能力）。
 */

const isNative = Platform.OS !== "web";

type NfcManagerModule = typeof import("react-native-nfc-manager");
type NfcManagerModuleType = Awaited<Promise<NfcManagerModule>>;

export type NfcFlowErrorKind =
  | "unsupported"
  | "invalid-uid"
  | "write-failed"
  | "uri-mismatch";

/** 寫卡階段的可分類錯誤。後端 bind 失敗不走這裡。 */
export class NfcFlowError extends Error {
  readonly kind: NfcFlowErrorKind;

  constructor(kind: NfcFlowErrorKind, message: string) {
    super(message);
    this.name = "NfcFlowError";
    this.kind = kind;
  }
}

async function loadNfcManager(): Promise<NfcManagerModuleType> {
  if (!isNative) {
    throw new NfcFlowError("unsupported", "NFC is not supported on web");
  }
  return import("react-native-nfc-manager");
}

/** 4 / 7 / 10 byte UID，允許稍長的廠商格式；拒絕空值與奇數長度。 */
export function isValidTagUid(tagUid: string): boolean {
  return /^[0-9A-F]{8,32}$/.test(tagUid) && tagUid.length % 2 === 0;
}

/** 參加者頁網址。registrationId 不做 encode，避免把 UUID 的連字號轉義。 */
export function buildRegistrationProfileUrl(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new NfcFlowError("write-failed", "missing registration id");
  }
  return `${WEB_BASE_URL}/u/${id}`;
}

function urlsMatch(expected: string, actual: string): boolean {
  const norm = (value: string) => value.trim().replace(/\/$/, "").toLowerCase();
  const left = norm(expected);
  const right = norm(actual);
  if (left === right) return true;
  try {
    const path = new URL(expected).pathname.replace(/\/$/, "").toLowerCase();
    return path.length > 1 && right.endsWith(path);
  } catch {
    return false;
  }
}

/** Build a URI NDEF message pointing to a profile URL */
export async function buildUriNdefMessage(url: string): Promise<number[]> {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new NfcFlowError("write-failed", `Invalid profile URL: ${url}`);
  }
  const { Ndef } = await loadNfcManager();
  return Ndef.encodeMessage([Ndef.uriRecord(url)]);
}

/** 將不同來源的 UID 格式收斂為可比對的 canonical hex 字串 */
export function normalizeTagUid(tagUid: string): string {
  return tagUid.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/**
 * 寫入 URI 後立刻讀回。讀回不符或沒有 UID 時拋錯，呼叫端不得接著 bind。
 */
export async function writeUriToCard(
  url: string,
): Promise<{ tagUid: string; writtenUri: string }> {
  const { default: NfcManager, NfcTech, Ndef } = await loadNfcManager();
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const tag = await NfcManager.getTag();
    const tagUid = tag?.id ? normalizeTagUid(tag.id) : "";
    if (!isValidTagUid(tagUid)) {
      throw new NfcFlowError("invalid-uid", tagUid || "missing");
    }

    const bytes = await buildUriNdefMessage(url);
    await NfcManager.ndefHandler.writeNdefMessage(bytes, {
      reconnectAfterWrite: true,
    });

    const readBack = await NfcManager.ndefHandler.getNdefMessage();
    const payload = readBack?.ndefMessage?.[0]?.payload;
    if (!payload || payload.length === 0) {
      throw new NfcFlowError("write-failed", "empty read-back");
    }
    const writtenUri = Ndef.uri.decodePayload(Uint8Array.from(payload));
    if (!urlsMatch(url, writtenUri)) {
      throw new NfcFlowError("uri-mismatch", writtenUri);
    }
    return { tagUid, writtenUri };
  } catch (error) {
    if (error instanceof NfcFlowError) throw error;
    const message = error instanceof Error ? error.message : "write failed";
    throw new NfcFlowError("write-failed", message);
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

/**
 * 只讀取卡片硬體 UID（不寫入、不綁定）。
 * 優先 Ndef，並相容僅有 NfcA 的空白卡。
 */
export async function readTagUid(): Promise<string> {
  const { default: NfcManager, NfcTech } = await loadNfcManager();
  const techs = [NfcTech.Ndef, NfcTech.NfcA].filter(Boolean);
  await NfcManager.requestTechnology(techs);
  try {
    const tag = await NfcManager.getTag();
    const tagUid = tag?.id ? normalizeTagUid(tag.id) : "";
    if (!isValidTagUid(tagUid)) {
      throw new NfcFlowError("invalid-uid", tagUid || "missing");
    }
    return tagUid;
  } catch (error) {
    if (error instanceof NfcFlowError) throw error;
    const message = error instanceof Error ? error.message : "read failed";
    throw new NfcFlowError("write-failed", message);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // session closing race 不阻斷主流程
    }
  }
}
