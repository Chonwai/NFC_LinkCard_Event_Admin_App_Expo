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
  | "uri-mismatch"
  | "timeout"
  | "cancelled";

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

/** 參加者名片網址（C-1）。slug 不做 encode，避免把連字號轉義。 */
export function buildRegistrationProfileUrl(slug: string): string {
  const id = String(slug ?? "").trim();
  if (!id || id === "null" || id === "undefined") {
    throw new NfcFlowError("write-failed", "missing profile slug");
  }
  return `${WEB_BASE_URL}/p/${id}`;
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
 * 寫卡（含讀回驗證）的總逾時（`CRA-V1-009`／§7 `R-10`）。
 *
 * 放在本模組而非 `constants/config.ts`：這是**裝置互動**的上限，不是 API 設定，
 * 且只有 `writeUriToCard` 一個讀者。20 秒＝「貼卡 → 寫入 → 讀回」的正常上限；
 * 超過就是卡沒貼好或讀寫器卡住，不該讓畫面永遠停在「寫入中」。
 */
export const NFC_WRITE_TIMEOUT_MS = 20000;

/**
 * 寫入 URI 後立刻讀回。讀回不符或沒有 UID 時拋錯，呼叫端不得接著 bind。
 *
 * **讀回驗證是刻意保留的設計**（稽核 §6.5 #7 明列為正向設計）：只寫不讀會讓
 * 「寫壞的卡」到閘口才被發現。逾時與取消只是外面多一層上限與出口，
 * 不改變驗證流程本身。
 *
 * 逾時／取消會以 `NfcFlowError` 拋出。
 *
 * **讀取器的釋放責任在外層**（`F-01`）：內層的 `cancelTechnologyRequest()`
 * 只在內層操作 settle 時才會跑，而逾時之所以存在，正是因為內層可能**永不
 * settle**——那種情況下讀取器被永久佔住，Android 上後續 `requestTechnology`
 * 全部失敗，現場整個場次再也寫不了卡。因此外層 `finally` 另做一次 best-effort
 * 釋放；正常路徑會變成**第二次** cancel，其例外一律吞掉（沒開的／已關的 session
 * 會 reject，那不是呼叫端該看到的事）。
 */
export async function writeUriToCard(
  url: string,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<{ tagUid: string; writtenUri: string }> {
  const { default: NfcManager, NfcTech, Ndef } = await loadNfcManager();
  const timeoutMs = options?.timeoutMs ?? NFC_WRITE_TIMEOUT_MS;
  const signal = options?.signal;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let abortListener: (() => void) | null = null;

  const interruption = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new NfcFlowError("timeout", `NFC write timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);

    if (signal) {
      abortListener = () => {
        reject(new NfcFlowError("cancelled", "NFC write cancelled"));
      };
      if (signal.aborted) {
        abortListener();
      } else {
        signal.addEventListener("abort", abortListener, { once: true });
      }
    }
  });

  const write = (async (): Promise<{
    tagUid: string;
    writtenUri: string;
  }> => {
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
  })();

  // 輸掉 race 之後 write 仍可能以 rejection 收尾（例如逾時後才讀寫失敗）；
  // 先掛一個處理器，避免 unhandled rejection 在 RN 上變成紅屏雜訊。
  void write.catch(() => undefined);

  try {
    return await Promise.race([write, interruption]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
    /**
     * best-effort 釋放（`F-01`）。逾時／取消時內層 `write` 可能永不 settle，
     * 內層 `finally` 因此永遠不會執行 —— 這裡是那種情境下**唯一**的釋放點。
     * 成功路徑則是第二次 cancel，失敗一律吞掉。
     */
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // 已完成或未啟用的 session 會 reject；不改變主流程的結果。
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
