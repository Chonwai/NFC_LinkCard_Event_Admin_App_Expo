/**
 * NTAG21x 的上鎖命令——**全部當資料看待**。
 *
 * 為什麼要獨立成一個模組（而不是直接在硬體層拼位元組）：
 *
 * 1. **上鎖是不可逆的**。`CFGLCK` 一旦設下去，那張卡再也無法關閉保護或更換
 *    `AUTH0`；`AUTHLIM` 用盡後卡片永久拒絕驗證。這種東西不能只靠「讀起來像是
 *    對的」——它必須能在沒有讀卡機的情況下被逐位元組斷言。
 * 2. 現場只有一次機會。錯的頁碼會把 `PWD` 寫到設定頁，錯的 `AUTH0` 會讓
 *    使用者區完全讀不到。把「要寫哪幾頁、每頁 4 bytes」先算成純資料，
 *    硬體層就只剩下一個迴圈。
 *
 * 這裡**不 import 任何東西**，也不碰 `react-native-nfc-manager`——它在 web 的
 * top-level import 會直接崩潰（見 `nfc-utils.ts` 檔頭），而這一層連 web 都該能
 * 被單獨測試。
 *
 * ## 來源
 *
 * 逐字移植自 `LinkCard_Frontend@lib/nfc/ntag.ts`（佈局表）與
 * `LinkCard_Frontend@lib/nfc/native.ts`（命令與位元）以及
 * `LinkCard_Frontend@lib/nfc/protection.ts`（`planProtection` 的寫入順序）。
 * 兩個 repo 沒有共用套件，所以同一條規則存在兩份；頁碼與位元位置一律以那份
 * 程式碼為準，不憑記憶填入。
 *
 * 規格依據：NXP `NTAG213/215/216` 產品資料表 §8.5.7 Table 8（設定頁）與
 * Table 10/11（`ACCESS` 位元）。
 *
 * ## 只提供 `basic`
 *
 * Web 有三個預設（`basic` / `strong` / `permanent`），其中 `permanent` 會設
 * `CFGLCK`——**不可逆**。App 這條路徑只提供 `basic`
 * （`protectRead: false`、`lockConfig: false`、`authLimit: 0`）：報到桌的操作員
 * 在幾秒內決定一張卡的永久命運，不該是這一層能做的事。
 */

// ---------------------------------------------------------------------------
// 佈局
// ---------------------------------------------------------------------------

export type NtagVariant = "NTAG213" | "NTAG215" | "NTAG216";

export interface NtagLayout {
  variant: NtagVariant;
  /** `GET_VERSION` 回應的 storage size byte（byte 6）。 */
  storageByte: number;
  /** 使用者區的第一頁（NDEF TLV 從這裡開始）。 */
  firstUserPage: number;
  /** 使用者區的最後一頁。 */
  lastUserPage: number;
  /**
   * CC 宣告的 NDEF 資料區大小。
   *
   * ⚠️ 這比資料表的「user memory」少 8 bytes（NTAG215 是 496 而非 504）。
   * CC 才是 NDEF 寫入端必須遵守的上限；用 504 會寫出界。
   */
  ndefCapacityBytes: number;
  /** 第一設定頁：byte0=MIRROR、byte1=RFUI、byte2=MIRROR_PAGE、byte3=AUTH0。 */
  configPage: number;
  /** 第二設定頁：byte0=ACCESS、byte1=VCTID（不是 RFUI）、byte2–3=RFUI。 */
  accessPage: number;
  /** 密碼頁（4 bytes）。 */
  pwdPage: number;
  /** PACK 頁：byte0–1 = PACK，byte2–3 = RFUI。 */
  packPage: number;
}

/**
 * 三種型號的完整佈局。
 *
 * 頁碼是資料表 Table 8 的十進位值：`41/131/227`、`42/132/228`、`43/133/229`、
 * `44/134/230`。
 *
 * ⚠️ 把密碼寫到錯的頁，輕則無效，重則把 `LOCK` 或設定頁寫壞。所以型號必須
 * **量出來**（`GET_VERSION` 的 storage byte 或 CC 宣告的容量），不能靠猜。
 */
export const NTAG_LAYOUTS: Record<NtagVariant, NtagLayout> = {
  NTAG213: {
    variant: "NTAG213",
    storageByte: 0x0f,
    firstUserPage: 4,
    lastUserPage: 39,
    ndefCapacityBytes: 144,
    configPage: 41,
    accessPage: 42,
    pwdPage: 43,
    packPage: 44,
  },
  NTAG215: {
    variant: "NTAG215",
    storageByte: 0x11,
    firstUserPage: 4,
    lastUserPage: 129,
    ndefCapacityBytes: 496,
    configPage: 131,
    accessPage: 132,
    pwdPage: 133,
    packPage: 134,
  },
  NTAG216: {
    variant: "NTAG216",
    storageByte: 0x13,
    firstUserPage: 4,
    lastUserPage: 225,
    ndefCapacityBytes: 872,
    configPage: 227,
    accessPage: 228,
    pwdPage: 229,
    packPage: 230,
  },
};

/** 由 `GET_VERSION` 的 storage byte 回推型號。 */
export function variantFromStorageByte(
  storageByte: number,
): NtagVariant | null {
  for (const layout of Object.values(NTAG_LAYOUTS)) {
    if (layout.storageByte === storageByte) return layout.variant;
  }
  return null;
}

// ---------------------------------------------------------------------------
// ACCESS / AUTH0 位元組（資料表 Table 10/11）
// ---------------------------------------------------------------------------

/** `ACCESS` 位元遮罩。位元位置來自資料表 Table 10。 */
export const ACCESS_BITS = {
  /** bit7：1 = 讀取也需要密碼。 */
  PROT: 0x80,
  /** bit6：1 = 設定頁永久鎖定（**不可逆**）。 */
  CFGLCK: 0x40,
  /** bit5：RFUI。 */
  RFUI: 0x20,
  /** bit4：NFC counter 啟用。 */
  NFC_CNT_EN: 0x10,
  /** bit3：NFC counter 需密碼。 */
  NFC_CNT_PWD_PROT: 0x08,
  /** bits2..0：失敗次數上限。 */
  AUTHLIM_MASK: 0x07,
} as const;

export interface AccessOptions {
  /** true = 連讀取都要密碼（PROT=1）。 */
  protectRead?: boolean;
  /** true = 設定頁永久鎖定（CFGLCK=1）。**不可逆**。 */
  lockConfig?: boolean;
  /** 容許的錯誤密碼次數（0–7）。0 = 不限制。 */
  authLimit?: number;
}

/**
 * 組 `ACCESS` 位元組。
 *
 * 預設值刻意保守：不鎖讀取、不鎖設定頁、不限制失敗次數。這三個預設都是
 * 「可回復」的那一邊——把不可逆的選項留給呼叫端明確開啟。
 */
export function buildAccessByte(options: AccessOptions = {}): number {
  const { protectRead = false, lockConfig = false, authLimit = 0 } = options;
  if (!Number.isInteger(authLimit) || authLimit < 0 || authLimit > 7) {
    throw new Error(`authLimit must be an integer in 0–7 (got ${authLimit})`);
  }
  let value = 0x00;
  if (protectRead) value |= ACCESS_BITS.PROT;
  if (lockConfig) value |= ACCESS_BITS.CFGLCK;
  value |= authLimit & ACCESS_BITS.AUTHLIM_MASK;
  return value;
}

// ---------------------------------------------------------------------------
// 命令
// ---------------------------------------------------------------------------

/**
 * `1Bh <4 bytes>` PWD_AUTH。
 *
 * 成功時卡片回 **PACK（2 bytes）**；失敗時卡片**不回應**（NAK），讀卡機會以
 * 狀態字報錯。所以「回應的形狀」本身就是結果。
 */
export function pwdAuthCommand(password: ArrayLike<number>): number[] {
  if (password.length !== 4) {
    throw new Error(
      `password must be exactly 4 bytes (got ${password.length})`,
    );
  }
  return [0x1b, password[0], password[1], password[2], password[3]];
}

/** `A2h <page> <4 bytes>` WRITE。 */
export function writeCommand(page: number, data: ArrayLike<number>): number[] {
  assertPage(page, "WRITE");
  if (data.length !== 4) {
    throw new Error(`WRITE data must be exactly 4 bytes (got ${data.length})`);
  }
  return [0xa2, page, data[0], data[1], data[2], data[3]];
}

/** `30h <page>` READ，回 p、p+1、p+2、p+3 四頁共 16 bytes。 */
export function readCommand(page: number): number[] {
  assertPage(page, "READ");
  return [0x30, page];
}

/**
 * `60h` GET_VERSION（唯讀）。NTAG21x 回 8 bytes，其中 **byte 6 是 storage size**
 * （`0x11`＝NTAG215、`0x12`＝NTAG213、`0x13`＝NTAG216），見 `variantFromStorageByte`。
 *
 * 為什麼上鎖路徑需要它：`lockCard()` 要 `layout` 才能算出 `configPage`／
 * `pwdPage`／`packPage`，而寫卡走的是 NDEF 抽象層、拿不到型號。三個型號的頁碼
 * 差很遠（41／131／227），猜錯就是寫到使用者的資料頁上。所以型號只能問卡片。
 */
export function getVersionCommand(): number[] {
  return [0x60];
}

function assertPage(page: number, label: string): void {
  if (!Number.isInteger(page) || page < 0 || page > 0xff) {
    throw new Error(
      `${label} page must be an integer in 0–255 (got ${String(page)})`,
    );
  }
}

// ---------------------------------------------------------------------------
// 上鎖計畫
// ---------------------------------------------------------------------------

/** 一次頁寫入。`order` 只在同一份計畫內有意義。 */
export interface LockWrite {
  order: number;
  page: number;
  /** 給日誌／錯誤訊息用的短標籤（`PWD`／`PACK`／`ACCESS`／`AUTH0`）。 */
  label: "PWD" | "PACK" | "ACCESS" | "AUTH0";
  data: Uint8Array;
}

export interface LockPlanOptions {
  /**
   * `configPage` 的**現值**。有給就保留 byte0–2（`MIRROR`／`MIRROR_PAGE`），
   * 只改 byte3（`AUTH0`）。
   *
   * 沒給時 byte0–2 寫 0——那會**清掉 UID ASCII mirror**（如果這張卡啟用了）。
   * 所以呼叫端應該先讀 page `configPage` 再產生計畫；硬體層
   * （`lockCard`）會把它當成必經步驟。
   */
  currentConfigPage?: ArrayLike<number>;
  /**
   * 保護起點。**預設 `layout.firstUserPage`（= 4）**，也就是「從使用者區第一頁
   * 起就要密碼」——這樣整份 NDEF 都受保護。
   *
   * ⚠️ 這裡與 `AUTH0 = 使用者區最後一頁 + 1` 的直覺相反。`AUTH0` 的語意是
   * **「第一個需要驗證的頁」**，不是「最後一個受保護的頁」：設成
   * `lastUserPage + 1` 只會保護 `configPage` 之後的區域，**整份 NDEF 完全不
   * 受保護**，而寫入會看起來成功。Web 的 `planProtection` 用的也是
   * `authFromPage ?? firstUserPage`。
   */
  authFromPage?: number;
}

/**
 * 組出上鎖要寫的頁，順序即執行順序。
 *
 * | # | 頁 | 內容 |
 * | --- | --- | --- |
 * | 1 | `pwdPage` | 密碼 4 bytes |
 * | 2 | `packPage` | `[pack0, pack1, 0x00, 0x00]` |
 * | 3 | `accessPage` | `[ACCESS, 0x00, 0x00, 0x00]`（`basic` ⇒ `ACCESS = 0x00`） |
 * | 4 | `configPage` | `[現值0, 現值1, 現值2, AUTH0]` |
 *
 * ## 為什麼 `ACCESS` 一定要排在 `AUTH0` 之前
 *
 * `accessPage = configPage + 1`，而 `AUTH0` 一旦設成 4，`accessPage` 就落在
 * 保護區內——那之後再寫它就得先通過 `PWD_AUTH`。順序反了會讓「設保護」這一步
 * 被自己剛設下的規則擋住。
 *
 * ## 為什麼要寫 `ACCESS`（Web 也寫）
 *
 * 只寫 `AUTH0` 而沿用卡片現有的 `ACCESS`，會讓一張「之前被設成 `strong`」的卡
 * 繼續 `PROT = 1`：寫入需要密碼，**讀取也需要密碼**——訪客手機 tap 不到網址，
 * 而操作員以為「只是上鎖了」。`basic` 明確把 `PROT` 清成 0。
 *
 * ⚠️ 沿用 Web 的同一個已知取捨：`ACCESS` 頁的 byte1 是 `VCTID`（不是 RFUI），
 * 這一步會把它寫成 0。原廠值本來就是 0。
 *
 * 純資料：不送任何命令、不讀任何硬體。實際寫入由硬體層逐頁執行並讀回驗證。
 */
export function planLockWrites(
  layout: NtagLayout,
  password: ArrayLike<number>,
  pack: ArrayLike<number>,
  options: LockPlanOptions = {},
): LockWrite[] {
  if (password.length !== 4) {
    throw new Error(
      `password must be exactly 4 bytes (got ${password.length})`,
    );
  }
  if (pack.length !== 2) {
    throw new Error(`PACK must be exactly 2 bytes (got ${pack.length})`);
  }

  const authFrom = options.authFromPage ?? layout.firstUserPage;
  if (authFrom < layout.firstUserPage || authFrom > layout.lastUserPage) {
    throw new Error(
      `AUTH0 must be within ${layout.firstUserPage}–${layout.lastUserPage}` +
        ` (got ${authFrom}). Setting it to 0–3 would protect the UID and the` +
        " lock pages as well.",
    );
  }

  // `configPage`：只換 byte3（AUTH0），其餘保留現值。
  const configPage = new Uint8Array(4);
  const current = options.currentConfigPage;
  if (current) {
    if (current.length < 4) {
      throw new Error(
        `currentConfigPage must be 4 bytes (got ${current.length})`,
      );
    }
    for (let index = 0; index < 4; index += 1) {
      configPage[index] = current[index] & 0xff;
    }
  }
  configPage[3] = authFrom;

  // `basic`：不鎖讀取、不鎖設定頁、不限制失敗次數 ⇒ ACCESS = 0x00。
  const accessByte = buildAccessByte({
    protectRead: false,
    lockConfig: false,
    authLimit: 0,
  });

  return [
    {
      order: 1,
      page: layout.pwdPage,
      label: "PWD",
      data: Uint8Array.from([
        password[0],
        password[1],
        password[2],
        password[3],
      ]),
    },
    {
      order: 2,
      page: layout.packPage,
      label: "PACK",
      data: Uint8Array.from([pack[0], pack[1], 0x00, 0x00]),
    },
    {
      order: 3,
      page: layout.accessPage,
      label: "ACCESS",
      data: Uint8Array.from([accessByte, 0x00, 0x00, 0x00]),
    },
    {
      order: 4,
      page: layout.configPage,
      label: "AUTH0",
      data: configPage,
    },
  ];
}

/** 上鎖完成後，`AUTH0` 應該長成的值（給讀回驗證用）。 */
export function expectedAuth0(
  layout: NtagLayout,
  options: LockPlanOptions = {},
): number {
  const authFrom = options.authFromPage ?? layout.firstUserPage;
  if (authFrom < layout.firstUserPage || authFrom > layout.lastUserPage) {
    throw new Error(
      `AUTH0 must be within ${layout.firstUserPage}–${layout.lastUserPage}` +
        ` (got ${authFrom})`,
    );
  }
  return authFrom;
}

// ---------------------------------------------------------------------------
// 回應分類
// ---------------------------------------------------------------------------

/**
 * `PWD_AUTH` 的結果。
 *
 * 三種「不是成功」的情形必須分得開，因為**卡片當下處於不同狀態**，而操作員
 * 該做的事完全不同：
 *
 * - `no-response`：卡片 NAK。密碼錯誤，或 `AUTHLIM` 已用盡（永久拒絕）。
 * - `sw-error`：讀卡機／協定層回的狀態字。卡沒被碰過，可以重試。
 * - `pack-mismatch`：卡片「驗證成功」但回的 PACK 不是我們寫進去的值——
 *   代表密碼頁寫入其實沒有成功。
 */
export type PwdAuthOutcome =
  | { kind: "ok"; pack: Uint8Array; packHex: string }
  | { kind: "no-response" }
  | { kind: "sw-error"; sw: string | null; detail: string }
  | { kind: "pack-mismatch"; packHex: string; expectedHex: string };

/** `90 00`：ISO 7816 的成功狀態字（部分讀卡機在原生回應後附加）。 */
const SW_OK = [0x90, 0x00] as const;

function endsWithSwOk(data: ArrayLike<number>): boolean {
  return (
    data.length >= 2 &&
    data[data.length - 2] === SW_OK[0] &&
    data[data.length - 1] === SW_OK[1]
  );
}

/** `[12 34]` → `"1234"`。 */
export function toHex(bytes: ArrayLike<number>): string {
  return Array.from({ length: bytes.length }, (_, index) =>
    (bytes[index] & 0xff).toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
}

/**
 * 分類 `PWD_AUTH` 的回應。
 *
 * NTAG21x 在 NfcA 上是**原生幀**，成功就是 PACK 那 2 bytes，沒有 SW1/SW2。
 * 但同一份程式碼也會遇到「讀卡機／通道在原生回應後面附上 `90 00`」的情形
 * （Web 走 ISO 7816 pass-through 時就是這樣），所以兩種都接受。
 *
 * `expectedPack` 有給時會比對 PACK——這是唯一能證明「密碼頁真的寫進去了」的
 * 檢查：卡片對任何密碼都會回它自己的 PACK，長度檢查分不出「我們的密碼」和
 * 「別人的密碼」。
 */
export function classifyPwdAuthResponse(
  data: ArrayLike<number> | null | undefined,
  expectedPack?: ArrayLike<number> | null,
): PwdAuthOutcome {
  const bytes = data ?? [];

  if (bytes.length === 0) {
    return { kind: "no-response" };
  }

  // 先解掉 `90 00` 當 PACK 與 `90 00` 當狀態字的歧義。PACK 是我們自己產生的
  // 已知值，所以有給 `expectedPack` 時就精確比對——這比「2 bytes 就當 PACK」
  // 在邊界上正確，也比「末尾 9000 就拆掉」安全。
  if (expectedPack != null && bytes.length === 2) {
    const candidate = toHex([bytes[0], bytes[1]]);
    if (candidate === toHex(expectedPack)) {
      return {
        kind: "ok",
        pack: Uint8Array.from([bytes[0], bytes[1]]),
        packHex: candidate,
      };
    }
  }

  let pack: Uint8Array;
  if (bytes.length === 2 && !endsWithSwOk(bytes)) {
    // NfcA 原生：PACK 本身就是全部回應。
    pack = Uint8Array.from([bytes[0], bytes[1]]);
  } else if (endsWithSwOk(bytes) && bytes.length > 2) {
    const payload = bytes.length - 2;
    if (payload !== 2) {
      return {
        kind: "sw-error",
        sw: toHex([bytes[bytes.length - 2], bytes[bytes.length - 1]]),
        detail: `expected a 2-byte PACK after 9000, got ${payload} bytes`,
      };
    }
    pack = Uint8Array.from([bytes[0], bytes[1]]);
  } else {
    return {
      kind: "sw-error",
      sw:
        bytes.length >= 2
          ? toHex([bytes[bytes.length - 2], bytes[bytes.length - 1]])
          : toHex(bytes),
      detail:
        `PWD_AUTH returned ${bytes.length} bytes: neither a 2-byte PACK ` +
        "nor a response ending in 9000",
    };
  }

  const packHex = toHex(pack);
  if (expectedPack != null) {
    const expectedHex = toHex(expectedPack);
    if (packHex !== expectedHex) {
      return { kind: "pack-mismatch", packHex, expectedHex };
    }
  }

  return { kind: "ok", pack, packHex };
}

/** 一頁 `WRITE` 的結果。 */
export type WriteAckOutcome =
  | { kind: "ok" }
  | { kind: "no-response" }
  | { kind: "sw-error"; sw: string | null; detail: string };

/** NTAG 的 `WRITE` 應答：單一 byte `0Ah`。 */
const NTAG_WRITE_ACK = 0x0a;

/**
 * 分類一頁寫入的回應。
 *
 * 三種都可接受為成功，因為同一支程式會跑在三種通道上：
 * - `0A`：NfcA 原生（Android `NfcA.transceive` 對 `A2h` 的回應）。
 * - `0A 90 00`：原生應答後附 ISO 狀態字。
 * - `90 00`：純 ISO 7816 pass-through。
 *
 * 其他一律是錯——`0A` 是**唯一**的正面應答，把它當「有回應就算成功」是這類
 * 程式最常見的錯誤：卡片對寫錯頁的回應也不是空的。
 */
export function classifyWriteAck(
  data: ArrayLike<number> | null | undefined,
): WriteAckOutcome {
  const bytes = data ?? [];

  if (bytes.length === 0) {
    return { kind: "no-response" };
  }

  const body = endsWithSwOk(bytes) ? bytes.length - 2 : bytes.length;
  if (endsWithSwOk(bytes) && body === 0) {
    return { kind: "ok" };
  }
  if (body === 1 && bytes[0] === NTAG_WRITE_ACK) {
    return { kind: "ok" };
  }

  return {
    kind: "sw-error",
    sw:
      bytes.length >= 2
        ? toHex([bytes[bytes.length - 2], bytes[bytes.length - 1]])
        : toHex(bytes),
    detail: `WRITE should answer 0A (or 0A 90 00), got ${toHex(bytes)}`,
  };
}
