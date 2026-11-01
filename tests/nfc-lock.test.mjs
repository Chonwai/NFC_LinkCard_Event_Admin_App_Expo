/**
 * 卡片上鎖的**硬體層**（`lockCard` / `pwdAuth`）。
 *
 * 為什麼要 mock `transceive`：這條路徑唯一能證明的東西剛好都是「送出去什麼」與
 * 「失敗後卡片處於什麼狀態」——兩者都不需要真卡。CI 沒有讀卡機，而這條路徑會
 * 寫 `PWD`／`PACK`／`ACCESS`／`AUTH0`（**不可逆**），所以順序與位元組必須在這裡
 * 被釘死。
 *
 * 替身策略：一個會**記住頁面內容**的模擬器（READ 回 p..p+3 共 16 bytes、WRITE
 * 更新頁面、`PWD_AUTH` 比對已寫入的 `PWD` 頁）。這樣「讀回驗證」才是真的在驗證
 * ——如果 mock 只回固定值，讀回比對那一段永遠不會被測到。
 *
 * 載入鏈與 `nfc-write-release.test.mjs` 相同：`react-native`（Platform）＋動態
 * `import("react-native-nfc-manager")` 都以 `mock.module` 攔截；`nfc-utils`
 * 本身不被 mock，`NfcLockError` 才是真的類別。
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const LAYOUT = {
  variant: "NTAG215",
  storageByte: 0x11,
  firstUserPage: 4,
  lastUserPage: 129,
  ndefCapacityBytes: 496,
  configPage: 131,
  accessPage: 132,
  pwdPage: 133,
  packPage: 134,
};

const PASSWORD = Uint8Array.from([0x11, 0x22, 0x33, 0x44]);
const PACK = Uint8Array.from([0xab, 0xcd]);

// ---------------------------------------------------------------------------
// 會記住內容的卡片模擬器
// ---------------------------------------------------------------------------

/** @type {Map<number, number[]>} */
let pages = new Map();
/** @type {number[][]} */
let commands = [];
let techRequests = [];
let cancelCalls = 0;
/** `true` = 未驗證就讀 → 丟錯（重現一張 PROT=1 的卡） */
let blockReadsUntilAuth = false;
let authed = false;
/** 寫入這些頁時假裝成功但不真的更新（模擬「寫了但沒生效」） */
let dropWritePages = new Set();
let writeAck = [0x0a];
/** `true` = `requestTechnology` 永不 settle（重現讀取器卡住） */
let holdSessionOpen = false;

function pageBlock(start) {
  const out = [];
  for (let offset = 0; offset < 4; offset += 1) {
    out.push(...(pages.get(start + offset) ?? [0, 0, 0, 0]));
  }
  return out;
}

mock.module("react-native-nfc-manager", {
  defaultExport: {
    requestTechnology: async (techs) => {
      techRequests.push(techs);
      if (holdSessionOpen) return new Promise(() => {});
      return "NfcA";
    },
    cancelTechnologyRequest: async () => {
      cancelCalls += 1;
    },
    transceive: async (data) => {
      commands.push([...data]);
      const [insn, page] = data;

      if (insn === 0x30) {
        if (blockReadsUntilAuth && !authed) {
          throw new Error("Tag was lost. (transceive failed)");
        }
        return pageBlock(page);
      }

      if (insn === 0xa2) {
        if (!dropWritePages.has(page)) {
          pages.set(page, data.slice(2, 6));
        }
        return [...writeAck];
      }

      if (insn === 0x1b) {
        const currentPwd = pages.get(LAYOUT.pwdPage) ?? [
          0xff, 0xff, 0xff, 0xff,
        ];
        const matches = data
          .slice(1, 5)
          .every((byte, index) => byte === currentPwd[index]);
        if (!matches) return []; // NTAG：驗證失敗是「不回應」
        authed = true;
        const pack = pages.get(LAYOUT.packPage) ?? [0x00, 0x00, 0x00, 0x00];
        return [pack[0], pack[1]];
      }

      throw new Error(`unexpected command ${insn}`);
    },
  },
  namedExports: {
    NfcTech: { NfcA: "NfcA", Ndef: "Ndef" },
    Ndef: {},
  },
});

const { lockCard, ntagLayout, pwdAuth, NfcLockError } =
  await import("@/utils/nfc-utils");

beforeEach(() => {
  pages = new Map([
    [LAYOUT.pwdPage, [0xff, 0xff, 0xff, 0xff]],
    [LAYOUT.packPage, [0x00, 0x00, 0x00, 0x00]],
    [LAYOUT.accessPage, [0x00, 0x00, 0x00, 0x00]],
    // 非零現值：MIRROR=0x11、RFUI=0x22、MIRROR_PAGE=0x33、AUTH0=0xff（未保護）
    [LAYOUT.configPage, [0x11, 0x22, 0x33, 0xff]],
  ]);
  commands = [];
  techRequests = [];
  cancelCalls = 0;
  blockReadsUntilAuth = false;
  authed = false;
  dropWritePages = new Set();
  writeAck = [0x0a];
  holdSessionOpen = false;
});

/** 只保留寫入命令（`A2h`），形式為 `[頁碼, 4 bytes]`。 */
function writes() {
  return commands
    .filter((command) => command[0] === 0xa2)
    .map((command) => [command[1], command.slice(2, 6)]);
}

describe("pwdAuth", () => {
  it("送的位元組恰好是 1Bh 加 4 bytes 密碼，並要求 NfcA", async () => {
    pages.set(LAYOUT.pwdPage, Array.from(PASSWORD));
    pages.set(LAYOUT.packPage, [0xab, 0xcd, 0x00, 0x00]);

    const result = await pwdAuth(PASSWORD);

    assert.deepEqual(commands, [[0x1b, 0x11, 0x22, 0x33, 0x44]]);
    assert.deepEqual(
      techRequests,
      ["NfcA"],
      "必須用 NfcA（Ndef 發不了 raw APDU）",
    );
    assert.equal(result.packHex, "ABCD");
  });

  it("卡片不回應 ⇒ no-response（密碼錯或次數用盡），且 reader 被釋放", async () => {
    await assert.rejects(
      () => pwdAuth(PASSWORD),
      (error) => {
        assert.ok(error instanceof NfcLockError);
        assert.equal(error.kind, "no-response");
        assert.equal(error.stage, "auth");
        return true;
      },
    );
    assert.equal(cancelCalls, 1);
  });

  it("錯誤訊息與 cardState 都不得含密碼", async () => {
    await assert.rejects(
      () => pwdAuth(PASSWORD),
      (error) => {
        const text = `${error.message} ${error.cardState}`;
        assert.ok(!/11223344/i.test(text), "密碼不可進 log");
        return true;
      },
    );
  });
});

describe("lockCard — 寫入的頁碼與順序", () => {
  it("PWD → PACK → ACCESS → AUTH0（133 → 134 → 132 → 131）", async () => {
    await lockCard(LAYOUT, PASSWORD, PACK);

    assert.deepEqual(
      writes().map(([page]) => page),
      [133, 134, 132, 131],
    );
  });

  it("先讀設定頁取現值，再開始寫", async () => {
    await lockCard(LAYOUT, PASSWORD, PACK);

    assert.deepEqual(
      commands[0],
      [0x30, 131],
      "第一發必須是 READ(configPage)：沒有現值就不能寫 AUTH0",
    );
  });

  it("configPage 的 byte0–2 保留現值，只換 byte3（AUTH0 = 4）", async () => {
    await lockCard(LAYOUT, PASSWORD, PACK);

    const auth0Write = writes().find(([page]) => page === LAYOUT.configPage);
    assert.deepEqual(auth0Write[1], [0x11, 0x22, 0x33, 4]);
  });

  it("PWD 頁寫的是密碼，PACK 頁寫 [pack, 0, 0]，ACCESS 頁寫 0x00（basic）", async () => {
    await lockCard(LAYOUT, PASSWORD, PACK);

    const byPage = new Map(writes());
    assert.deepEqual(byPage.get(LAYOUT.pwdPage), [0x11, 0x22, 0x33, 0x44]);
    assert.deepEqual(byPage.get(LAYOUT.packPage), [0xab, 0xcd, 0x00, 0x00]);
    assert.deepEqual(byPage.get(LAYOUT.accessPage), [0x00, 0x00, 0x00, 0x00]);
  });

  it("AUTH0 寫完之後用新密碼驗證並讀回設定頁", async () => {
    const result = await lockCard(LAYOUT, PASSWORD, PACK);

    assert.equal(result.auth0, 4);
    assert.equal(result.variant, "NTAG215");
    assert.deepEqual(
      result.written.map((write) => write.label),
      ["PWD", "PACK", "ACCESS", "AUTH0"],
    );

    const authIndex = commands.findIndex((command) => command[0] === 0x1b);
    const verifyReadIndex = commands.findIndex(
      (command, index) => index > authIndex && command[0] === 0x30,
    );
    assert.ok(authIndex > 0, "AUTH0 之後必須先 PWD_AUTH 才讀得回設定頁");
    assert.ok(verifyReadIndex > authIndex);
  });

  it("成功後 reader 被釋放", async () => {
    await lockCard(LAYOUT, PASSWORD, PACK);
    assert.equal(cancelCalls, 1);
  });
});

describe("lockCard — 失敗時說清楚卡片處於什麼狀態", () => {
  it("讀不到設定頁且密碼不對 ⇒ unreadable，且一個 byte 都沒寫", async () => {
    blockReadsUntilAuth = true; // 卡片被別的密碼鎖住

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.kind, "unreadable");
        assert.equal(error.stage, "read-config");
        return true;
      },
    );

    assert.deepEqual(writes(), [], "拒絕上鎖時不得有任何寫入");
    assert.equal(cancelCalls, 1);
  });

  it("讀不到設定頁但密碼正確（先前鎖過的卡）⇒ 驗證後繼續", async () => {
    blockReadsUntilAuth = true;
    pages.set(LAYOUT.pwdPage, Array.from(PASSWORD));
    pages.set(LAYOUT.packPage, [0x00, 0x00, 0x00, 0x00]);

    const result = await lockCard(LAYOUT, PASSWORD, PACK);

    assert.equal(result.auth0, 4);
    assert.deepEqual(
      writes().map(([page]) => page),
      [133, 134, 132, 131],
    );
  });

  it("寫入應答不是 0Ah／9000 ⇒ sw-error，並說明卡片仍未受保護", async () => {
    writeAck = [0x00];

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.kind, "sw-error");
        assert.equal(error.stage, "write");
        assert.match(error.cardState, /unprotected/i);
        assert.deepEqual(error.written, []);
        return true;
      },
    );
    assert.equal(cancelCalls, 1, "寫入失敗也必須釋放 reader");
  });

  it("AUTH0 已寫但新密碼驗不上 ⇒ cardState 說「可能已經鎖上」", async () => {
    // 假裝 PWD 頁沒寫進去（寫入成功但沒生效）⇒ 後面驗證必然失敗
    dropWritePages = new Set([LAYOUT.pwdPage]);

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.stage, "verify");
        assert.deepEqual(error.written, ["PWD", "PACK", "ACCESS", "AUTH0"]);
        assert.match(error.cardState, /may already require the password/i);
        return true;
      },
    );
  });

  it("讀回不符 ⇒ verify-failed（送出成功不代表寫入成功）", async () => {
    dropWritePages = new Set([LAYOUT.configPage]);

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.kind, "verify-failed");
        assert.equal(error.stage, "verify");
        return true;
      },
    );
  });

  it("逾時 ⇒ timeout，且 reader 仍被釋放", async () => {
    holdSessionOpen = true;

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK, { timeoutMs: 5 }),
      (error) => {
        assert.equal(error.kind, "timeout");
        return true;
      },
    );
    assert.equal(cancelCalls, 1);
  });
});

describe("ntagLayout", () => {
  it("可由型號取得頁碼（呼叫端不必自己抄一份）", () => {
    assert.equal(ntagLayout("NTAG213").configPage, 41);
    assert.equal(ntagLayout("NTAG216").pwdPage, 229);
  });
});
