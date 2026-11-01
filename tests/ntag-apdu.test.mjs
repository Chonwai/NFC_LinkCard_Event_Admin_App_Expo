/**
 * NTAG21x 上鎖命令——**不需要讀卡機就能證明的部分**。
 *
 * 為什麼需要這一支：這條路徑會寫 `PWD`／`PACK`／`ACCESS`／`AUTH0`，其中
 * `CFGLCK` 與 `AUTHLIM` 是**不可逆**的。CI 沒有硬體，所以「寫對頁、寫對位元」
 * 只能靠純函式斷言來守；硬體層（`lockCard`）再負責「真的送出去、真的讀回來」。
 *
 * 這裡刻意鎖住四件在真實卡片上無法回頭修正的事：
 *
 * 1. `PWD_AUTH` 的位元組（`1Bh` 開頭、剛好 5 bytes）。
 * 2. `ACCESS` 位元的每一個旗標與組合。
 * 3. **寫入頁碼與順序**——`ACCESS` 必須排在 `AUTH0` 之前，否則會被自己剛設下
 *    的保護擋住。
 * 4. `AUTH0` 的**語意**：它是「第一個需要驗證的頁」，所以 `basic` 要寫
 *    `firstUserPage`（4），不是 `lastUserPage + 1`。後者會讓整份 NDEF 完全
 *    不受保護，而寫入仍然看起來成功。
 *
 * 本模組不 import 任何東西（連 `react-native` 都沒有），所以不需要 mock。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const {
  ACCESS_BITS,
  NTAG_LAYOUTS,
  buildAccessByte,
  classifyPwdAuthResponse,
  classifyWriteAck,
  expectedAuth0,
  planLockWrites,
  pwdAuthCommand,
  readCommand,
  toHex,
  variantFromStorageByte,
  writeCommand,
} = await import("@/utils/ntag-apdu");

/** 3 個型號，避免每一條都手寫三次。 */
const VARIANTS = ["NTAG213", "NTAG215", "NTAG216"];

/** 測試用密碼／PACK（都不是原廠預設值）。 */
const PASSWORD = Uint8Array.from([0x11, 0x22, 0x33, 0x44]);
const PACK = Uint8Array.from([0xab, 0xcd]);

describe("pwdAuthCommand", () => {
  it("送出的位元組是 1Bh 加上 4 bytes 密碼，長度剛好 5", () => {
    assert.deepEqual(pwdAuthCommand(PASSWORD), [0x1b, 0x11, 0x22, 0x33, 0x44]);
  });

  it("密碼不是 4 bytes 就丟錯（3 與 5 都算）", () => {
    assert.throws(() => pwdAuthCommand(Uint8Array.from([1, 2, 3])));
    assert.throws(() => pwdAuthCommand(Uint8Array.from([1, 2, 3, 4, 5])));
    assert.throws(() => pwdAuthCommand(Uint8Array.from([])));
  });
});

describe("ACCESS_BITS", () => {
  it("位元位置與資料表 Table 10 一致", () => {
    assert.equal(ACCESS_BITS.PROT, 0x80);
    assert.equal(ACCESS_BITS.CFGLCK, 0x40);
    assert.equal(ACCESS_BITS.RFUI, 0x20);
    assert.equal(ACCESS_BITS.NFC_CNT_EN, 0x10);
    assert.equal(ACCESS_BITS.NFC_CNT_PWD_PROT, 0x08);
    assert.equal(ACCESS_BITS.AUTHLIM_MASK, 0x07);
  });
});

describe("buildAccessByte", () => {
  it("預設全保守 ⇒ 0x00（不鎖讀取、不鎖設定頁、不限次數）", () => {
    assert.equal(buildAccessByte(), 0x00);
    assert.equal(buildAccessByte({}), 0x00);
  });

  it("單一旗標各自生效", () => {
    assert.equal(buildAccessByte({ protectRead: true }), 0x80);
    assert.equal(buildAccessByte({ lockConfig: true }), 0x40);
    assert.equal(buildAccessByte({ authLimit: 3 }), 0x03);
  });

  it("旗標與 authLimit 可疊加（0x80 | 0x40 | 5 = 0xC5）", () => {
    assert.equal(
      buildAccessByte({ protectRead: true, lockConfig: true, authLimit: 5 }),
      0xc5,
    );
  });

  it("authLimit 超出 0–7 或不是整數就丟錯", () => {
    assert.throws(() => buildAccessByte({ authLimit: 8 }));
    assert.throws(() => buildAccessByte({ authLimit: -1 }));
    assert.throws(() => buildAccessByte({ authLimit: 1.5 }));
  });
});

describe("NTAG 佈局表", () => {
  it("三個型號的設定頁／密碼頁／PACK 頁都對應 Table 8", () => {
    const expected = {
      NTAG213: { config: 41, access: 42, pwd: 43, pack: 44, last: 39 },
      NTAG215: { config: 131, access: 132, pwd: 133, pack: 134, last: 129 },
      NTAG216: { config: 227, access: 228, pwd: 229, pack: 230, last: 225 },
    };

    for (const variant of VARIANTS) {
      const layout = NTAG_LAYOUTS[variant];
      assert.equal(layout.configPage, expected[variant].config, variant);
      assert.equal(layout.accessPage, expected[variant].access, variant);
      assert.equal(layout.pwdPage, expected[variant].pwd, variant);
      assert.equal(layout.packPage, expected[variant].pack, variant);
      assert.equal(layout.lastUserPage, expected[variant].last, variant);
      assert.equal(layout.variant, variant);
    }
  });

  it("使用者區從 page 4 起，且 accessPage 緊接在 configPage 之後", () => {
    for (const variant of VARIANTS) {
      const layout = NTAG_LAYOUTS[variant];
      assert.equal(layout.firstUserPage, 4, variant);
      assert.equal(layout.accessPage, layout.configPage + 1, variant);
    }
  });

  it("storage byte 可回推型號", () => {
    assert.equal(variantFromStorageByte(0x0f), "NTAG213");
    assert.equal(variantFromStorageByte(0x11), "NTAG215");
    assert.equal(variantFromStorageByte(0x13), "NTAG216");
    assert.equal(variantFromStorageByte(0x99), null);
  });
});

describe("planLockWrites", () => {
  it("頁碼與順序：PWD → PACK → ACCESS → AUTH0", () => {
    const layout = NTAG_LAYOUTS.NTAG215;
    const writes = planLockWrites(layout, PASSWORD, PACK);

    assert.deepEqual(
      writes.map((write) => write.label),
      ["PWD", "PACK", "ACCESS", "AUTH0"],
    );
    assert.deepEqual(
      writes.map((write) => write.page),
      [133, 134, 132, 131],
    );
    assert.deepEqual(
      writes.map((write) => write.order),
      [1, 2, 3, 4],
    );
  });

  it("ACCESS 寫在 AUTH0 之前（否則會被自己剛設下的保護擋住）", () => {
    const writes = planLockWrites(NTAG_LAYOUTS.NTAG216, PASSWORD, PACK);
    const access = writes.findIndex((write) => write.label === "ACCESS");
    const auth0 = writes.findIndex((write) => write.label === "AUTH0");

    assert.ok(access >= 0 && auth0 >= 0);
    assert.ok(
      access < auth0,
      "ACCESS 必須先寫：AUTH0 一旦設成 4，accessPage 就落在保護區內",
    );
  });

  it("每一頁都剛好 4 bytes", () => {
    for (const write of planLockWrites(NTAG_LAYOUTS.NTAG213, PASSWORD, PACK)) {
      assert.equal(write.data.length, 4, write.label);
    }
  });

  it("PWD 頁的內容就是密碼本身", () => {
    const pwd = planLockWrites(NTAG_LAYOUTS.NTAG215, PASSWORD, PACK).find(
      (write) => write.label === "PWD",
    );
    assert.deepEqual(Array.from(pwd.data), [0x11, 0x22, 0x33, 0x44]);
  });

  it("PACK 頁 = [pack0, pack1, 0x00, 0x00]", () => {
    const pack = planLockWrites(NTAG_LAYOUTS.NTAG215, PASSWORD, PACK).find(
      (write) => write.label === "PACK",
    );
    assert.deepEqual(Array.from(pack.data), [0xab, 0xcd, 0x00, 0x00]);
  });

  it("ACCESS 頁 = [0x00, 0x00, 0x00, 0x00]（basic：不鎖讀取、不鎖設定頁）", () => {
    const access = planLockWrites(NTAG_LAYOUTS.NTAG215, PASSWORD, PACK).find(
      (write) => write.label === "ACCESS",
    );
    assert.deepEqual(Array.from(access.data), [0x00, 0x00, 0x00, 0x00]);
  });

  it("configPage 的 byte0–2 保留現值，只換 byte3（AUTH0）", () => {
    const writes = planLockWrites(NTAG_LAYOUTS.NTAG215, PASSWORD, PACK, {
      currentConfigPage: Uint8Array.from([0x11, 0x22, 0x33, 0xff]),
    });
    const auth0 = writes.find((write) => write.label === "AUTH0");

    assert.deepEqual(
      Array.from(auth0.data),
      [0x11, 0x22, 0x33, 4],
      "MIRROR / MIRROR_PAGE 不能被清掉；只有 byte3 應該變",
    );
  });

  it("沒有現值時 byte0–2 寫 0（沿用 Web 的已知取捨）", () => {
    const auth0 = planLockWrites(NTAG_LAYOUTS.NTAG215, PASSWORD, PACK).find(
      (write) => write.label === "AUTH0",
    );
    assert.deepEqual(Array.from(auth0.data), [0x00, 0x00, 0x00, 4]);
  });

  it("AUTH0 = 使用者區第一頁（4），不是最後一頁 + 1", () => {
    for (const variant of VARIANTS) {
      const layout = NTAG_LAYOUTS[variant];
      const auth0 = planLockWrites(layout, PASSWORD, PACK).find(
        (write) => write.label === "AUTH0",
      );

      assert.equal(auth0.data[3], layout.firstUserPage, variant);
      assert.equal(auth0.data[3], expectedAuth0(layout), variant);
      assert.notEqual(
        auth0.data[3],
        layout.lastUserPage + 1,
        "AUTH0 是「第一個要驗證的頁」；設成 lastUserPage + 1 只保護設定區，" +
          "整份 NDEF 完全不受保護",
      );
    }
  });

  it("authFromPage 超出使用者區範圍就丟錯（含把 UID 也鎖進去的 0–3）", () => {
    const layout = NTAG_LAYOUTS.NTAG215;
    assert.throws(() =>
      planLockWrites(layout, PASSWORD, PACK, { authFromPage: 3 }),
    );
    assert.throws(() =>
      planLockWrites(layout, PASSWORD, PACK, {
        authFromPage: layout.lastUserPage + 1,
      }),
    );
  });

  it("密碼或 PACK 長度不對就丟錯（先於任何寫入）", () => {
    const layout = NTAG_LAYOUTS.NTAG215;
    assert.throws(() => planLockWrites(layout, [1, 2, 3], PACK));
    assert.throws(() => planLockWrites(layout, PASSWORD, [1]));
    assert.throws(() => planLockWrites(layout, PASSWORD, [1, 2, 3]));
  });

  it("currentConfigPage 不足 4 bytes 就丟錯", () => {
    assert.throws(() =>
      planLockWrites(NTAG_LAYOUTS.NTAG215, PASSWORD, PACK, {
        currentConfigPage: [0x00, 0x00],
      }),
    );
  });
});

describe("writeCommand / readCommand", () => {
  it("WRITE 是 A2h + 頁碼 + 4 bytes", () => {
    assert.deepEqual(
      writeCommand(43, PASSWORD),
      [0xa2, 43, 0x11, 0x22, 0x33, 0x44],
    );
  });

  it("READ 是 30h + 頁碼", () => {
    assert.deepEqual(readCommand(41), [0x30, 41]);
  });

  it("頁碼必須是 0–255 的整數", () => {
    assert.throws(() => writeCommand(256, PASSWORD));
    assert.throws(() => readCommand(-1));
    assert.throws(() => readCommand(1.5));
  });
});

describe("classifyPwdAuthResponse", () => {
  it("2 bytes = 原生 PACK ⇒ 成功", () => {
    const outcome = classifyPwdAuthResponse([0x12, 0x34]);
    assert.equal(outcome.kind, "ok");
    assert.equal(outcome.packHex, "1234");
  });

  it("空回應 = NAK（密碼錯或 AUTHLIM 已用盡）", () => {
    assert.equal(classifyPwdAuthResponse([]).kind, "no-response");
    assert.equal(classifyPwdAuthResponse(null).kind, "no-response");
    assert.equal(classifyPwdAuthResponse(undefined).kind, "no-response");
  });

  it("9000 結尾的通道 ⇒ 成功，PACK 取 9000 之前那 2 bytes", () => {
    const outcome = classifyPwdAuthResponse([0xde, 0xad, 0x90, 0x00]);
    assert.equal(outcome.kind, "ok");
    assert.equal(outcome.packHex, "DEAD");
  });

  it("只有 9000 卻沒有 PACK ⇒ 狀態字錯誤（不能當成功）", () => {
    const outcome = classifyPwdAuthResponse([0x90, 0x00]);
    assert.equal(outcome.kind, "sw-error");
  });

  it("PACK 本身剛好是 9000 時，靠 expectedPack 精確解掉歧義", () => {
    const pack = Uint8Array.from([0x90, 0x00]);
    assert.equal(classifyPwdAuthResponse(pack, pack).kind, "ok");
    assert.equal(classifyPwdAuthResponse([0x90, 0x00]).kind, "sw-error");
  });

  it("expectedPack 不符 ⇒ pack-mismatch（唯一能證明密碼頁真的寫進去的檢查）", () => {
    const outcome = classifyPwdAuthResponse([0x12, 0x34], PACK);
    assert.equal(outcome.kind, "pack-mismatch");
    assert.equal(outcome.packHex, "1234");
    assert.equal(outcome.expectedHex, "ABCD");
  });

  it("expectedPack 相符 ⇒ 成功", () => {
    assert.equal(classifyPwdAuthResponse(PACK, PACK).kind, "ok");
  });

  it("單一 byte（例如 0Ah）不是 PWD_AUTH 的合法回應", () => {
    assert.equal(classifyPwdAuthResponse([0x0a]).kind, "sw-error");
  });

  it("既不長得像 PACK 也不以 9000 結尾 ⇒ 狀態字錯誤", () => {
    const outcome = classifyPwdAuthResponse([0x12, 0x34, 0x6a, 0x82]);
    assert.equal(outcome.kind, "sw-error");
    assert.equal(outcome.sw, "6A82");
  });

  it("9000 之後不是 2 bytes PACK 也算狀態字錯誤", () => {
    const outcome = classifyPwdAuthResponse([0x00, 0x90, 0x00]);
    assert.equal(outcome.kind, "sw-error");
  });
});

describe("classifyWriteAck", () => {
  it("0Ah = NTAG 原生 WRITE 應答 ⇒ 成功", () => {
    assert.equal(classifyWriteAck([0x0a]).kind, "ok");
  });

  it("0Ah + 9000 與純 9000 都接受（不同讀卡機通道）", () => {
    assert.equal(classifyWriteAck([0x0a, 0x90, 0x00]).kind, "ok");
    assert.equal(classifyWriteAck([0x90, 0x00]).kind, "ok");
  });

  it("空回應 ⇒ no-response；其他任何 byte ⇒ 狀態字錯誤", () => {
    assert.equal(classifyWriteAck([]).kind, "no-response");
    assert.equal(classifyWriteAck(null).kind, "no-response");
    assert.equal(classifyWriteAck([0x00]).kind, "sw-error");
    assert.equal(classifyWriteAck([0x0b, 0x00]).kind, "sw-error");
  });
});

describe("toHex", () => {
  it("固定兩位大寫，不做縮寫", () => {
    assert.equal(toHex([0x00, 0x0a, 0xff]), "000AFF");
    assert.equal(toHex(Uint8Array.from([0x1b])), "1B");
  });
});
