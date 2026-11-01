/**
 * 簽到台取得「上鎖用卡片密碼」的通道。
 *
 * ## 這支為什麼打的是 **Web** 的端點（借用，不是整合）
 *
 * 密碼只存在 Frontend 的環境變數裡（`LinkCard_Frontend@app/api/check-in/card-password/route.ts:212`
 * 讀 `process.env.NFC_CARD_PASSWORD`）。後端**沒有等價端點**——實跑
 * `grep -rn 'NFC_CARD_PASSWORD\|cardPassword' ../LinkCard_ExpressJS_Backend/src/`
 * 是 0 命中。所以 App 要嘛借 Web 這支，要嘛沒有密碼可用。
 *
 * 這是一個**已知的、有期限的**借用，不是設計上的偏好：
 *
 * - 長期方案是後端新增 `GET /events/:eventId/card-password`（閘門沿用既有的
 *   `getEventOperatorAccess`，env 未設回 501 fail-closed）。決定與代價記在
 *   `docs/analysis/adminapp-parity-20261028/04-gap-register.md` §G-8
 *   〈兩個可選解法〉的方案 A。
 * - 屆時**只需要換掉本檔 `endpointUrl()` 的 URL**，回傳形狀、失因分類、呼叫端
 *   全部不動。所以這裡把 URL 收在一個函式裡，而不是散在呼叫點。
 *
 * ## 為什麼是 `Cookie: auth_token=` 而不是 `Authorization: Bearer`
 *
 * 那支 route 的閘門只認 cookie：`AUTH_COOKIE = 'auth_token'`
 * （`LinkCard_Frontend@app/api/check-in/card-password/route.ts:75`，讀取在 `:140`），
 * 沒有 Bearer 分支。App 平常打後端一律帶 `Authorization: Bearer`
 * （`src/services/api.ts:31`），兩邊是兩套認證體系——這是借用的直接代價，
 * 也是為什麼上面那段說它有期限。
 *
 * React Native 的 `fetch` 不會自己管理 cookie jar，所以這裡**顯式**把 header
 * 拼出來。這個 header 就是使用者的 JWT，等同憑證：不進 log、不進 state、
 * 不進錯誤訊息。
 *
 * ## 三條紀律
 *
 * 1. **永不 throw、永不回 `null`。** 拿不到密碼不是錯誤，是「這次不上鎖」
 *    （計畫 §1 D-4：絕不因為取不到密碼而擋住寫卡）。呼叫端只看 `ok`。
 * 2. **不在這裡碰 storage／state。** 密碼用完即丟；這一支只負責把 bytes 交給
 *    呼叫端，存哪裡是呼叫端的事（而正確答案是不存）。
 * 3. **不臆測失因。** 分不出來就回 `unknown`——一句指錯方向的斷言比「不知道」
 *    更貴，2026-10-29 那次維運查錯方向就是這樣發生的
 *    （`LinkCard_Frontend@lib/checkin/cardPassword.ts` 檔頭記錄了同一件事）。
 */
import { TOKEN_STORAGE_KEY, WEB_BASE_URL } from "@/constants/config";
import { tokenStorage } from "@/utils/storage";

/**
 * NTAG21x 的 `PWD_AUTH` 吃 4 bytes ⇒ 端點回的 `password` 必須是 8 個 hex 字元。
 * 與 Web 的 `CARD_PASSWORD_HEX` 同一條規則（同一個端點回的同一種值）。
 */
export const CARD_PASSWORD_HEX = /^[0-9a-fA-F]{8}$/;

/**
 * 這一趟的期限（毫秒）。
 *
 * 為什麼要設：`fetch` 在 React Native 沒有預設逾時，而這個呼叫卡在「寫卡成功
 * 之後、可以發卡之前」——懸著不動等於整個報到台停在那裡。5 秒的依據與 Web 那支
 * route 對後端的 `ACCESS_CHECK_TIMEOUT_MS` 相同：正常路徑是毫秒級，超過 5 秒幾乎
 * 可以確定是上游異常，再等下去只是延後降級。
 */
export const CARD_PASSWORD_TIMEOUT_MS = 5_000;

/**
 * 「這次拿不到上鎖用密碼」的失因。
 *
 * 詞彙**照抄** Web 的 `CardPasswordFailureReason`
 * （`LinkCard_Frontend@lib/checkin/cardPassword.ts:44`）——兩邊共用同一個端點回的
 * 同一組狀態碼，各自造一套名字只會讓下一個人以為它們是不同的事。
 *
 * - `not_signed_in`（401）／`not_operator`（403）→ 帳號問題，重試無用。
 * - `not_configured`（501）→ 伺服器沒有設 `NFC_CARD_PASSWORD`，要找技術支援。
 * - `check_unavailable`（502／網路／逾時）→ 現在問不到，可以再試。
 * - `unknown`（200 但 body 不成形、400 參數錯）→ 真的分不出來。
 */
export type CardPasswordFailureReason =
  | "not_signed_in"
  | "not_operator"
  | "not_configured"
  | "check_unavailable"
  | "unknown";

export type CardPasswordResult =
  | {
      ok: true;
      /** 已解碼的 4 bytes，直接丟給 `pwdAuth()` 與 `lockCard()`。 */
      password: Uint8Array;
    }
  | {
      ok: false;
      reason: CardPasswordFailureReason;
      /** HTTP 狀態碼；連線層失敗時是 `null`。 */
      status: number | null;
    };

/**
 * HTTP 事實 ⇒ 失因。對照的是那支 route 實際會回的狀態碼
 * （`LinkCard_Frontend@app/api/check-in/card-password/route.ts` 的 `fail(...)`）。
 *
 * `reason` 只用來擋掉「呼叫端自己傳錯參數」那兩格——狀態碼是介面契約，
 * `reason` 是給人看的補充，不該成為判斷的主要依據。
 */
export function classifyCardPasswordFailure(
  status: number | null,
  reason?: unknown,
): CardPasswordFailureReason {
  // 400：沒帶 `eventId` 或格式不合法。這是**程式錯**，不是權限、也不是設定。
  if (reason === "missing_event_id" || reason === "invalid_event_id") {
    return "unknown";
  }

  if (status === null) return "check_unavailable";

  if (status === 401) return "not_signed_in";
  if (status === 403) return "not_operator";
  if (status === 501) return "not_configured";

  // 200 走到這裡只可能是 body 不成形（沒有 `password` 或不是 8 個 hex）。
  if (status === 200) return "unknown";

  // 502（問不到權限、逾時）與其他 5xx／未知狀態：都當「現在問不到」，可重試。
  return "check_unavailable";
}

/** hex 字串 → 4 bytes。格式不對回 `null`（不解釋、不猜測）。 */
export function hexToPasswordBytes(hex: string): Uint8Array | null {
  if (!CARD_PASSWORD_HEX.test(hex)) return null;
  const bytes = new Uint8Array(4);
  for (let index = 0; index < 4; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * 端點位址。**後端有了等價端點之後，這是唯一要改的一行。**
 *
 * `eventId` 走 `encodeURIComponent`：它是唯一被拼進 URL 的外部輸入。
 */
export function endpointUrl(eventId: string): string {
  return `${WEB_BASE_URL}/api/check-in/card-password?eventId=${encodeURIComponent(eventId)}`;
}

/** 解析 body 時只認得這個形狀；其餘一律當「沒有密碼」。 */
function readPasswordField(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return undefined;
  return (body as { password?: unknown }).password;
}

/** 失因只認字串；其他型別一律當作沒帶。 */
function readReasonField(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return undefined;
  const reason = (body as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

/**
 * 取得這場活動的卡片密碼。
 *
 * **永不 throw**。回 `ok: false` 的每一種失因都對應一個現場處置，
 * 呼叫端據此決定文案；拿不到就是「這一次不上鎖」，寫卡照樣完成。
 */
export async function fetchCardPassword(
  eventId: string,
): Promise<CardPasswordResult> {
  // 沒有 `fetch`（理論上不會發生在 RN／Expo，但 `jest`／舊 runtime 可能有）
  // ⇒ 當「問不到」，不要讓 ReferenceError 冒到呼叫端。
  if (typeof fetch !== "function") {
    return { ok: false, reason: "check_unavailable", status: null };
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const token = await tokenStorage.getItem(TOKEN_STORAGE_KEY);
    // 沒有 token 就不必白跑一趟：那支 route 一定回 401，而多一趟往返只會讓
    // 「寫完卡、等一個註定失敗的回應」變得更長。
    if (!token) {
      return { ok: false, reason: "not_signed_in", status: null };
    }

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), CARD_PASSWORD_TIMEOUT_MS);

    const response = await fetch(endpointUrl(eventId), {
      method: "GET",
      headers: {
        Accept: "application/json",
        // 顯式拼 cookie：RN 沒有 cookie jar，而這支 route 只認這個 header。
        Cookie: `auth_token=${token}`,
      },
      // 可輪換的設定值，不該被任何中間層快取（與 route 的 `no-store` 對齊）。
      cache: "no-store",
      signal: controller.signal,
    });

    // body 只是補充資訊；解析失敗不該讓整條流程爆掉——狀態碼才是契約。
    const body: unknown = await response.json().catch(() => null);

    if (response.ok) {
      const raw = readPasswordField(body);
      const bytes = typeof raw === "string" ? hexToPasswordBytes(raw) : null;
      if (bytes === null) {
        return {
          ok: false,
          reason: classifyCardPasswordFailure(response.status),
          status: response.status,
        };
      }
      return { ok: true, password: bytes };
    }

    return {
      ok: false,
      reason: classifyCardPasswordFailure(
        response.status,
        readReasonField(body),
      ),
      status: response.status,
    };
  } catch {
    // 逾時（abort）／斷網／DNS 失敗／storage 讀取失敗：都是「現在問不到」。
    // 刻意不把 error 往外帶——它的訊息可能含 URL 查詢字串，而這裡沒有任何
    // 呼叫端需要那個細節才能決定下一步。
    return { ok: false, reason: "check_unavailable", status: null };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
