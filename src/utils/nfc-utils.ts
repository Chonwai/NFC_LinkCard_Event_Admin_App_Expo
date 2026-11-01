import { Platform } from "react-native";

import { WEB_BASE_URL } from "@/constants/config";

import {
  NTAG_LAYOUTS,
  classifyPwdAuthResponse,
  classifyWriteAck,
  getVersionCommand,
  planLockWrites,
  pwdAuthCommand,
  readCommand,
  variantFromStorageByte,
  writeCommand,
  type LockWrite,
  type NtagLayout,
  type NtagVariant,
  type PwdAuthOutcome,
} from "./ntag-apdu";

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

/**
 * `INC-3`（Loop AF）：卡面 URL——`${WEB_BASE_URL}/t/{eventId}/{tagUid}`。
 *
 * 這是「寫進卡裡的 URL」的**唯一真實來源**（`nfc-bind` 以 `writeUriToCard` 的
 * builder 形式使用它：感應讀到 UID 後才組）。寫進卡的是**公開 URL**，
 * 不含 activation token 或任何憑證（任何人 tap 都能看到卡面內容）；
 * `tagUid` 是實體卡晶片本體識別，解析端（FE `/t/` → BE `nfc/lookup`）
 * 以它動態查詢目前狀態 ⇒ 先綁卡後建檔／激活會自動升級。
 *
 * ── 這是**保底**，不是主路徑（2026-10-30 二次定案）──────────────────────
 * 主路徑是 `chooseCardPayloadUrl()`：有公開名片就寫 `${WEB_BASE_URL}/p/{slug}`
 * （名片網址與他自己分享的逐字相同）。這裡只在**真的沒有公開名片**時用到——那時
 * 寫一張 `/p/` 只會 404，比多一跳更糟。
 */
export function buildCardPayloadUrl(eventId: string, tagUid: string): string {
  const event = String(eventId ?? "").trim();
  const uid = normalizeTagUid(String(tagUid ?? ""));
  if (!event || !isValidTagUid(uid)) {
    throw new NfcFlowError("write-failed", "missing eventId or tagUid");
  }
  return `${WEB_BASE_URL}/t/${encodeURIComponent(event)}/${encodeURIComponent(uid)}`;
}

/** 卡面 URL 的兩個家族——決定「這張卡什麼時候會壞」，不是實作細節。 */
export type CardPayloadFamily = "profile" | "event-tap";

/**
 * 從 BE 給的 `profileUrl` 取出 `/p/{slug}` 的 slug。
 *
 * ⚠️ 這支是 `LinkCard_Frontend:lib/nfc/cardPayloadUrl.ts` 同名函式的**孿生實作**：
 * 兩個 repo 沒有共用套件，所以同一條規則存在兩份。條件必須逐字一致——`tests/
 * card-payload-choice.test.mjs` 用同一組真值表鎖住；改一邊就要改另一邊。
 *
 * 只接受**恰好** `/p/{單一段}`：多段路徑、空 slug、或根本不是 `/p/`（例如 `/t/…`）
 * 一律回 `null`。寧可退回解析器，也不要把猜出來的路徑寫進一張實體卡——那張卡之後
 * 只會 404，而現場沒人有工具改它。
 *
 * query 與 hash 會被**丟棄**（不是拒收）：回收的是 slug，不是整個網址，所以
 * `?utm=…` 之類的東西不可能跟著進到卡片。相對路徑（`/p/{slug}`）也吃。
 */
export function slugFromProfileUrl(
  profileUrl: string | null | undefined,
): string | null {
  const raw = String(profileUrl ?? "").trim();
  if (raw === "") return null;

  const path = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? safePathname(raw) : raw;
  if (path === null) return null;

  const segments = path
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter((part) => part !== "");
  if (segments.length !== 2) return null;
  if (segments[0] !== "p") return null;

  return normalizeProfileSlug(segments[1]);
}

/**
 * slug 的白名單檢查——與 `LinkCard_Frontend:lib/nfc/cardPayloadUrl.ts` 的
 * `normalisePathSegment()` **逐字等價**。
 *
 * 為什麼孿生要連這裡都一樣（2026-10-30 QA 補）：原本這裡是 `segments[1] || null`，
 * 只擋「空」，不擋「語意」。於是同一個 `profileUrl` 在兩個 repo 會得到不同答案：
 *
 * | `profileUrl`   | FE（`chooseCardPayload`） | ADM（修前）          |
 * | -------------- | ------------------------- | -------------------- |
 * | `/p/mei-chen`  | 名片 `/p/mei-chen`        | 名片 `/p/mei-chen`   |
 * | `/p/..`        | `null` ⇒ 退回 `/t/`       | 名片 `/p/..`（死卡） |
 * | `/p/a b`       | `null` ⇒ 退回 `/t/`       | `/p/a%20b`（404）    |
 * | `/p/a%2Fb`     | `null` ⇒ 退回 `/t/`       | `/p/a%252Fb`（404）  |
 *
 * `encodeURIComponent` 只擋「字元」，不擋「語意」：`..` 編碼後仍然是 `..`，卡片會
 * 指到上一層。而實體卡寫進去之後，現場**沒有工具可以改**——所以寧可多一跳（`/t/`
 * 一定開得起來），也不要寫一條看起來正確的死連結。
 *
 * 白名單與 FE 相同：unreserved 字元（`A-Za-z0-9._~-`），並額外拒絕 `.` 與 `..`。
 */
function normalizeProfileSlug(raw: string | undefined): string | null {
  const slug = String(raw ?? "").trim();
  if (slug === "" || slug === "." || slug === "..") return null;
  return /^[A-Za-z0-9._~-]+$/.test(slug) ? slug : null;
}

/** 絕對網址取 pathname；不是合法網址回 `null`（不拋）。 */
function safePathname(absoluteUrl: string): string | null {
  try {
    return new URL(absoluteUrl).pathname;
  } catch {
    return null;
  }
}

/**
 * 決定「寫進卡裡的那一個網址」——**唯一決策點**。
 *
 * 名片優先、解析器保底：
 * - 有公開名片 ⇒ `${WEB_BASE_URL}/p/{slug}`
 *   卡片寫入後**無法遠端修改**，所以它只能依賴「只由這個人是誰決定」的東西。
 *   加任何參數都會讓「卡片能不能開」多一個與訪客無關的失敗原因（活動被刪、
 *   被改為不公開、eventId 打錯），而訪客要看的只是人。
 * - 沒有 ⇒ `/t/{eventId}/{tagUid}`，由 FE 動態解析（先綁卡後建檔也會自動升級）。
 *
 * 為什麼仍要保底：名片可能真的不存在（使用者把名片設為私人都算）。那時寫 `/p/`
 * 只會得到 404——比多一跳更糟。
 */
export function chooseCardPayloadUrl(input: {
  eventId: string;
  /** 感應當下讀到的 UID；選到 `profile` 家族時不會用到。 */
  tagUid: string;
  profileUrl?: string | null;
}): { url: string; family: CardPayloadFamily } {
  const slug = slugFromProfileUrl(input.profileUrl);
  if (slug) {
    return { url: buildRegistrationProfileUrl(slug), family: "profile" };
  }
  return {
    url: buildCardPayloadUrl(input.eventId, input.tagUid),
    family: "event-tap",
  };
}

/**
 * 確認畫面上要給操作員看的那一行字。
 *
 * 有名片 ⇒ 完整網址此刻就已確定，直接顯示實際會寫進卡裡的字；沒有 ⇒ 解析器的
 * tagUid 段要感應才讀得到，只能顯示模板（用 `…` 佔位，不要假裝知道）。
 *
 * 放在工具層而不是畫面裡：畫面一旦自己拼 origin，就會出現第二份「卡面 URL 長什麼
 * 樣子」的真相（X-23）。
 */
export function previewCardPayloadUrl(input: {
  eventId: string;
  profileUrl?: string | null;
}): string {
  const slug = slugFromProfileUrl(input.profileUrl);
  if (slug) {
    return buildRegistrationProfileUrl(slug);
  }
  const event = String(input.eventId ?? "").trim();
  return `${WEB_BASE_URL}/t/${encodeURIComponent(event)}/…`;
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
 * `url` 可為 builder（`(tagUid) => string`）：先讀 UID、再組最終 URL——
 * 卡面為解析器 URL 時需要（`INC-3`）；讀回比對以**解析後**的 URL 為準。
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
  url: string | ((tagUid: string) => string),
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

      // `INC-3`：builder 在讀到 UID 之後才組最終 URL；字串路徑逐字不變。
      const resolvedUrl = typeof url === "function" ? url(tagUid) : url;
      const bytes = await buildUriNdefMessage(resolvedUrl);
      await NfcManager.ndefHandler.writeNdefMessage(bytes, {
        reconnectAfterWrite: true,
      });

      const readBack = await NfcManager.ndefHandler.getNdefMessage();
      const payload = readBack?.ndefMessage?.[0]?.payload;
      if (!payload || payload.length === 0) {
        throw new NfcFlowError("write-failed", "empty read-back");
      }
      const writtenUri = Ndef.uri.decodePayload(Uint8Array.from(payload));
      if (!urlsMatch(resolvedUrl, writtenUri)) {
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

// ---------------------------------------------------------------------------
// 卡片上鎖（raw APDU）
// ---------------------------------------------------------------------------

/**
 * 上鎖相關的錯誤。
 *
 * 為什麼要另立一個類別而不是複用 `NfcFlowError`：上鎖**不可逆**。失敗時光說
 * 「寫入失敗」沒有用——操作員要知道的是**這張卡現在處於什麼狀態**：還是空白
 * 可寫、已經有密碼但沒保護、還是可能已經鎖上了。所以錯誤一定要帶 `stage`
 * （停在哪一步）與 `cardState`（卡片的實際狀態）。
 *
 * ⚠️ 訊息裡**永遠不會出現密碼**：它會進 log 與當機回報。
 */
export type NfcLockStage =
  "select" | "read-config" | "auth" | "write" | "verify";

export type NfcLockErrorKind =
  | "unsupported"
  | "timeout"
  | "cancelled"
  | "unreadable"
  | "no-response"
  | "sw-error"
  | "verify-failed";

export class NfcLockError extends Error {
  readonly kind: NfcLockErrorKind;
  readonly stage: NfcLockStage;
  /** 卡片現在實際處於什麼狀態（英文；給操作員的中文走 `copy.zh-TW.ts`）。 */
  readonly cardState: string;
  /** 出錯的那一頁（非寫入階段為 `null`）。 */
  readonly page: number | null;
  /** 已經成功寫入的頁，按順序。 */
  readonly written: readonly string[];

  constructor(
    kind: NfcLockErrorKind,
    stage: NfcLockStage,
    cardState: string,
    details?: {
      message?: string;
      page?: number | null;
      written?: readonly string[];
      cause?: unknown;
    },
  ) {
    super(details?.message ?? kind);
    this.name = "NfcLockError";
    this.kind = kind;
    this.stage = stage;
    this.cardState = cardState;
    this.page = details?.page ?? null;
    this.written = details?.written ?? [];
    if (details?.cause !== undefined) {
      (this as { cause?: unknown }).cause = details.cause;
    }
  }
}

/** 上鎖序列的總逾時。比寫卡短：這一段只送 6 個命令。 */
export const NFC_LOCK_TIMEOUT_MS = 15000;

type NfcManagerInstance = NfcManagerModuleType["default"];

/**
 * 開一個 `NfcA` session 跑 `work`，不論成敗都釋放讀取器。
 *
 * 與 `writeUriToCard` 同一條規則（`F-01`）：內層操作可能**永不 settle**
 * （卡片被移走、讀卡機卡住），那時內層的 `finally` 永遠不會跑，讀取器被永久
 * 佔住 ⇒ Android 上後續 `requestTechnology` 全部失敗，整個場次都寫不了卡。
 * 所以 deadline 與釋放都放在**外層**。
 */
async function withNfcASession<T>(
  stage: NfcLockStage,
  options: { timeoutMs?: number; signal?: AbortSignal } | undefined,
  work: (manager: NfcManagerInstance) => Promise<T>,
): Promise<T> {
  const { default: NfcManager, NfcTech } = await loadNfcManager();
  const timeoutMs = options?.timeoutMs ?? NFC_LOCK_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let abortListener: (() => void) | null = null;

  try {
    const interruption = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new NfcLockError(
            "timeout",
            stage,
            "Unknown: the reader stopped answering. Hold the card still and try again.",
            { message: `NFC lock timed out after ${timeoutMs}ms` },
          ),
        );
      }, timeoutMs);

      if (options?.signal) {
        abortListener = () => {
          reject(
            new NfcLockError(
              "cancelled",
              stage,
              "The operation was cancelled before the card could be locked.",
              { message: "NFC lock cancelled" },
            ),
          );
        };
        if (options.signal.aborted) abortListener();
        else
          options.signal.addEventListener("abort", abortListener, {
            once: true,
          });
      }
    });

    const running = (async () => {
      await NfcManager.requestTechnology(NfcTech.NfcA);
      return work(NfcManager as NfcManagerInstance);
    })();

    void running.catch(() => undefined);
    return await Promise.race([running, interruption]);
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (options?.signal && abortListener) {
      options.signal.removeEventListener("abort", abortListener);
    }
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // session closing race 不阻斷主流程
    }
  }
}

/** 讀 `page` 起的一整塊（`READ` 回 p、p+1、p+2、p+3 共 16 bytes），取第一頁。 */
async function readPage(
  manager: NfcManagerInstance,
  page: number,
): Promise<Uint8Array | null> {
  try {
    const data = await manager.transceive(readCommand(page));
    if (!data || data.length < 4) return null;
    return Uint8Array.from(data.slice(0, 4));
  } catch {
    return null;
  }
}

/** 在既有 session 上送一次 `PWD_AUTH`。 */
async function authenticate(
  manager: NfcManagerInstance,
  password: Uint8Array,
): Promise<PwdAuthOutcome> {
  let response: number[];
  try {
    response = await manager.transceive(pwdAuthCommand(password));
  } catch {
    return { kind: "no-response" };
  }
  return classifyPwdAuthResponse(response);
}

/** 寫入一頁並檢查應答。 */
async function writePage(
  manager: NfcManagerInstance,
  write: LockWrite,
): Promise<void> {
  const response = await manager.transceive(
    writeCommand(write.page, write.data),
  );
  const ack = classifyWriteAck(response);
  if (ack.kind !== "ok") {
    throw new NfcLockError(ack.kind, "write", "", {
      message:
        ack.kind === "no-response"
          ? `page ${write.page} (${write.label}) did not answer`
          : `page ${write.page} (${write.label}) answered ${ack.sw ?? ack.detail}`,
      page: write.page,
    });
  }
}

/** 已經寫進去的頁 → 一句描述「卡片現在處於什麼狀態」。 */
function cardStateAfter(written: readonly string[]): string {
  if (written.length === 0) {
    return "The card is unchanged and still unprotected: it can be written again.";
  }
  if (!written.includes("AUTH0")) {
    return (
      "PWD/PACK/ACCESS may be written but AUTH0 is still at its factory value, " +
      "so the card is STILL unprotected: any reader can still rewrite it. " +
      "Retrying with the same password is safe."
    );
  }
  return (
    "AUTH0 has been written, so the card may already require the password that " +
    "was just written. Try reading it with that password before picking another " +
    "card; if it does not answer, the card is locked."
  );
}

export interface PwdAuthResult {
  pack: Uint8Array;
  packHex: string;
}

/**
 * 對已經上鎖的卡送一次 `PWD_AUTH`。
 *
 * 卡片一開始就是鎖著的（例如上一位操作員鎖過、或本輪上鎖成功要再讀回）時，
 * 任何寫入都要先過這一關。**成功與否看回應的形狀**：NTAG21x 驗證失敗是
 * 「不回應」，不是回一個錯誤碼。
 */
export async function pwdAuth(
  password: Uint8Array,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<PwdAuthResult> {
  return withNfcASession("auth", options, async (manager) => {
    const outcome = await authenticate(manager, password);
    if (outcome.kind === "ok") {
      return { pack: outcome.pack, packHex: outcome.packHex };
    }

    const cardState =
      "The card did not accept the password. It may be locked with a different " +
      "password, or the retry limit may already be used up.";

    if (outcome.kind === "pack-mismatch") {
      // 沒有傳 `expectedPack` 時不會走到這裡；保守起見仍當成協定異常。
      throw new NfcLockError("sw-error", "auth", cardState, {
        message:
          `PWD_AUTH returned PACK ${outcome.packHex}, ` +
          `expected ${outcome.expectedHex}`,
      });
    }

    throw new NfcLockError(outcome.kind, "auth", cardState, {
      message:
        outcome.kind === "no-response"
          ? "PWD_AUTH got no response (wrong password or lockout limit reached)"
          : `PWD_AUTH failed: ${outcome.detail}`,
    });
  });
}

export interface LockCardResult {
  variant: NtagVariant;
  /** 寫進 `configPage` byte3 的 `AUTH0`。 */
  auth0: number;
  written: { page: number; label: string }[];
}

/**
 * 把一張卡寫成「只有寫入需要密碼」的 `basic` 保護。
 *
 * 序列（順序即安全邊界，見 `planLockWrites`）：讀現值 → `PWD` → `PACK` →
 * `ACCESS` → `AUTH0` → 用新密碼驗證 → 讀回設定頁確認。
 *
 * ## 為什麼第一步是「讀設定頁」而且讀不到就**拒絕上鎖**
 *
 * `configPage` 的 byte0–2 是 `MIRROR`／`MIRROR_PAGE`。沒有現值就寫 0，會把卡片
 * 的 UID ASCII mirror 清掉——那是一個**寫下去就回不來**的副作用，而它與「上鎖」
 * 這件事完全無關。Web 的做法是照寫並留一個 warning；報到桌沒有辦法讓操作員
 * 在幾秒內判斷那個 warning 該不該吞，所以這裡選擇拒絕。
 *
 * ## 卡片本來就鎖著
 *
 * 讀設定頁失敗時先用 `password` 試一次 `PWD_AUTH` 再重讀（一張先前被鎖過的卡
 * 就是這個形狀）。兩者都失敗才丟錯——那時「讀不到」與「密碼不對」是同一個答案。
 */
export async function lockCard(
  layout: NtagLayout,
  password: Uint8Array,
  pack: Uint8Array,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<LockCardResult> {
  const written: string[] = [];

  return withNfcASession("read-config", options, async (manager) => {
    let currentConfigPage = await readPage(manager, layout.configPage);

    if (currentConfigPage === null) {
      const outcome = await authenticate(manager, password);
      if (outcome.kind !== "ok" && outcome.kind !== "pack-mismatch") {
        throw new NfcLockError(
          "unreadable",
          "read-config",
          "The card could not be read and the password was not accepted, so " +
            "nothing was written. It is either a different card or locked with " +
            "another password.",
          {
            message:
              `could not read config page ${layout.configPage} of ${layout.variant} ` +
              "and PWD_AUTH failed",
            page: layout.configPage,
          },
        );
      }
      currentConfigPage = await readPage(manager, layout.configPage);
      if (currentConfigPage === null) {
        throw new NfcLockError(
          "unreadable",
          "read-config",
          "The password was accepted but the config page still could not be " +
            "read, so nothing was written.",
          {
            message: `config page ${layout.configPage} unreadable after PWD_AUTH`,
          },
        );
      }
    }

    const plan = planLockWrites(layout, password, pack, { currentConfigPage });
    const auth0 = plan[plan.length - 1].data[3];

    for (const write of plan) {
      try {
        await writePage(manager, write);
      } catch (error) {
        const failure =
          error instanceof NfcLockError
            ? error
            : new NfcLockError("sw-error", "write", "", {
                message:
                  error instanceof Error ? error.message : "write failed",
                page: write.page,
              });
        throw new NfcLockError(failure.kind, "write", cardStateAfter(written), {
          message: failure.message,
          page: write.page,
          written,
        });
      }
      written.push(write.label);
    }

    // `AUTH0` 寫完保護立即生效 ⇒ 讀回之前必須先驗證。
    const outcome = await authenticate(manager, password);
    if (outcome.kind === "no-response" || outcome.kind === "sw-error") {
      throw new NfcLockError(outcome.kind, "verify", cardStateAfter(written), {
        message:
          "AUTH0 was written but PWD_AUTH with the new password failed: " +
          (outcome.kind === "no-response" ? "no response" : outcome.detail),
        page: layout.configPage,
        written,
      });
    }

    const configReadBack = await readPage(manager, layout.configPage);
    const accessReadBack = await readPage(manager, layout.accessPage);
    const verified =
      configReadBack !== null &&
      accessReadBack !== null &&
      configReadBack[3] === auth0 &&
      accessReadBack[0] === plan[2].data[0];
    if (!verified) {
      throw new NfcLockError(
        "verify-failed",
        "verify",
        cardStateAfter(written),
        {
          message:
            "the config page did not read back the expected AUTH0/ACCESS " +
            `(expected AUTH0=${auth0})`,
          page: layout.configPage,
          written,
        },
      );
    }

    return {
      variant: layout.variant,
      auth0,
      written: plan.map((write) => ({ page: write.page, label: write.label })),
    };
  });
}

/** 佈局表的讀取入口（給呼叫端由 storage byte／型號取得頁碼）。 */
export function ntagLayout(variant: NtagVariant): NtagLayout {
  return NTAG_LAYOUTS[variant];
}

/** `GET_VERSION` 的回應長度（NTAG21x 固定 8 bytes）。 */
const GET_VERSION_LENGTH = 8;

/** `GET_VERSION` 回應裡的 storage size byte 位置（0-based）。 */
const GET_VERSION_STORAGE_INDEX = 6;

/**
 * 問卡片「你是哪一型」，回它對應的頁碼佈局。
 *
 * ## 為什麼不能由呼叫端假設型號
 *
 * `lockCard()` 要 `layout` 才能算出 `configPage`／`pwdPage`／`packPage`：NTAG213
 * 是 41／43／44、NTAG215 是 131／133／134、NTAG216 是 227／229／230。這三個數字
 * 一旦猜錯，寫入不是「上鎖失敗」而是**寫進使用者的資料頁**——那張卡上剛寫好的
 * 網址會被蓋掉，而且不會有任何錯誤回報。所以型號只能問卡片。
 *
 * NDEF 抽象層（`writeUriToCard`）給不出型號，因此這裡另開一個 `NfcA` session 送
 * `GET_VERSION`（`60h`，唯讀）。它**不改動卡片任何狀態**，這是可以安全重試的。
 */
export async function detectCardLayout(options?: {
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<NtagLayout> {
  const version = await withNfcASession(
    "select",
    options,
    async (manager): Promise<Uint8Array> => {
      let response: number[];
      try {
        response = await manager.transceive(getVersionCommand());
      } catch {
        throw new NfcLockError(
          "no-response",
          "select",
          "The card did not answer GET_VERSION. Hold it still and try again.",
          { message: "GET_VERSION got no response" },
        );
      }
      if (!response || response.length < GET_VERSION_LENGTH) {
        throw new NfcLockError(
          "unsupported",
          "select",
          "The card did not return a version, so its page layout is unknown.",
          {
            message: `GET_VERSION returned ${response?.length ?? 0} bytes`,
          },
        );
      }
      return Uint8Array.from(response.slice(0, GET_VERSION_LENGTH));
    },
  );

  const storageByte = version[GET_VERSION_STORAGE_INDEX];
  const variant = variantFromStorageByte(storageByte);
  if (variant === null) {
    throw new NfcLockError(
      "unsupported",
      "select",
      "This card is not a NTAG21x, so it cannot be locked by this app.",
      { message: `unknown storage size byte 0x${storageByte.toString(16)}` },
    );
  }
  return NTAG_LAYOUTS[variant];
}
