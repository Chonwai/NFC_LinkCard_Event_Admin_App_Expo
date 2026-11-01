/**
 * 寫完卡之後的「上鎖」：決策、執行、以及**三種結局的詞彙**。
 *
 * ## 為什麼三態而不是成功／失敗
 *
 * 上鎖失敗**不是**寫卡失敗（`04 §G-8` 的〈剩餘 1 項〉與 Web 的
 * `classifyIssueReport` 同一條：`WRITTEN_BUT_LOCK_FAILED` 是黃色註記，不阻擋）。
 * 一張內容正確但沒上鎖的卡，現場該做的是「照發、但知道風險」；把它報成失敗，
 * 操作員會丟掉一張可用的卡——那是用一個文案製造出一張廢卡。
 *
 * 三個詞彙**照抄** Web 的 `DeskLockNote`
 * （`LinkCard_Frontend@lib/checkin/nfcDesk.ts:57`）：`locked`／`unlocked`／
 * `lock_failed`。兩邊同一個現場、同一句話，不該有兩套名字。
 *
 * ## 為什麼抽成 util 而不是寫在 `nfc-bind.tsx` 裡
 *
 * AdminApp 沒有元件層測試（同 `@/utils/desk-handoff` 的理由）：留在畫面檔裡的
 * 分支只能被「掃原始碼字串」驗到，而這裡要釘的是**行為**——
 * 「沒有密碼時 `lockCard` 一次都不能被呼叫」這種事，掃字串永遠掃不出來。
 *
 * ## 密碼不離開這支函式
 *
 * 這支不回傳密碼、不記錄密碼；呼叫端拿到的是三個字之一。
 */

/** 與 Web `DeskLockNote` 同名同義（`LinkCard_Frontend@lib/checkin/nfcDesk.ts:57`）。 */
export type CardLockNote = "locked" | "unlocked" | "lock_failed";

/**
 * 這個密碼能不能用來上鎖。
 *
 * `PWD_AUTH` 吃 4 bytes，而 `null`／長度不對的值代表「這次沒有密碼」，不是錯誤
 * ——政策就是「沒有就不鎖」（Web `decideLockPolicy` 的 `password_unavailable`
 * 回 `protect: false`，同一個語意）。
 */
export function isLockablePassword(
  password: Uint8Array | null | undefined,
): password is Uint8Array {
  return password != null && password.length === 4;
}

/**
 * 寫卡**之前**先驗一次密碼。
 *
 * ## 它到底解決了什麼（誠實邊界）
 *
 * 卡片本來就鎖著時（上一位操作員鎖過、或重試同一張卡），任何寫入都會失敗。這
 * 一步在寫之前先確認「這個密碼這張卡收不收」，讓失敗發生在**還沒動卡**的時候。
 *
 * ⚠️ **它不能把授權帶進寫卡那個 session。** `pwdAuth()` 開的是 `NfcA` session
 * 並在回傳前關閉；寫卡走的是獨立的 `Ndef` session。NTAG 的 PWD_AUTH 只對當次
 * RF session 有效，所以「先驗再寫」不會讓一張已鎖的卡變得可寫。它的價值是**探測**：
 * 把「密碼不對／不能用」這件唯一可行動的事實，提早到寫卡之前拿出來。
 *
 * ## 失敗不擋路
 *
 * 驗不過也照樣往下寫（`04 §G-8`／計畫 D-4 的同一取捨：絕不因為密碼的事擋住寫卡）。
 * 這裡**永不 throw**——它是一個探測，不是閘門。
 *
 * @returns `true` = 卡片接受了這個密碼；`false` = 沒驗（沒有密碼／驗不過）。
 */
export async function authenticateBeforeWrite(input: {
  password: Uint8Array | null | undefined;
  pwdAuth: (password: Uint8Array) => Promise<unknown>;
}): Promise<boolean> {
  if (!isLockablePassword(input.password)) return false;
  try {
    await input.pwdAuth(input.password);
    return true;
  } catch {
    // 驗不過有多種原因（密碼不同、重試次數用盡、卡拿開了），但對「接下來要不要
    // 寫」而言它們是同一個答案：照寫。細節留給上鎖那一步再判定。
    return false;
  }
}

/**
 * 寫卡成功之後上鎖。**永不 throw**。
 *
 * - 沒有可用的密碼 ⇒ `unlocked`，**`lockCard` 一次都不會被呼叫**。
 * - `lockCard` 成功 ⇒ `locked`。
 * - `lockCard` 失敗 ⇒ `lock_failed`（內容已在卡上，這件事不會被這一支推翻）。
 */
export async function lockAfterWrite(input: {
  password: Uint8Array | null | undefined;
  lockCard: (password: Uint8Array) => Promise<unknown>;
}): Promise<CardLockNote> {
  if (!isLockablePassword(input.password)) return "unlocked";
  try {
    await input.lockCard(input.password);
    return "locked";
  } catch {
    return "lock_failed";
  }
}

/**
 * 產生 2 bytes 的 `PACK`。
 *
 * `PACK` 是「驗證成功時卡片回的應答」，**不是秘密**——秘密是 `PWD`。所以這裡在
 * 拿不到 `crypto.getRandomValues` 時退回 `Math.random` 是可接受的取捨，而不是
 * 降級：一個可預測的 PACK 不會讓任何人多得到一次寫入權。
 *
 * （Web 的 `generatePack()` 在沒有 WebCrypto 時直接丟錯；那是網頁環境的選擇，
 * 而報到桌上「為了 PACK 產生不出來而不上鎖」是更糟的結果。）
 */
export function generatePack(): Uint8Array {
  const pack = new Uint8Array(2);
  const webCrypto = globalThis.crypto;
  if (webCrypto != null && typeof webCrypto.getRandomValues === "function") {
    webCrypto.getRandomValues(pack);
    return pack;
  }
  pack[0] = Math.floor(Math.random() * 256);
  pack[1] = Math.floor(Math.random() * 256);
  return pack;
}
