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
/** 寫入這些頁時回 `0x00`（模擬單頁 NAK，其他頁照常成功） */
let failWritePages = new Set();
/** `true` = `requestTechnology` 永不 settle（重現讀取器卡住） */
let holdSessionOpen = false;
/** 這些頁的 `transceive` 會慢 `slowDelayMs` 才回應（重現「寫到一半卡片不動」） */
let slowPages = new Set();
let slowDelayMs = 0;
/** 事件時序：證明讀取器是在 `work` 收手之後才被撤掉。 */
let timeline = [];

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
      timeline.push("cancel");
    },
    transceive: async (data) => {
      commands.push([...data]);
      const [insn, page] = data;

      if (slowPages.has(page)) {
        await new Promise((resolve) => setTimeout(resolve, slowDelayMs));
        timeline.push(`settled:${page}`);
      }

      if (insn === 0x30) {
        if (blockReadsUntilAuth && !authed) {
          throw new Error("Tag was lost. (transceive failed)");
        }
        return pageBlock(page);
      }

      if (insn === 0xa2) {
        if (failWritePages.has(page)) return [0x00];
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
  failWritePages = new Set();
  writeAck = [0x0a];
  holdSessionOpen = false;
  slowPages = new Set();
  slowDelayMs = 0;
  timeline = [];
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

  it("PACK 頁沒生效 ⇒ pack-mismatch 被判成驗證失敗（密碼頁寫入才有證據）", async () => {
    // R3：卡片對「被接受的密碼」一律回它自己的 PACK，所以只驗「有沒有回應」
    // 會讓這張卡一路綠燈——PWD 頁寫了、PACK 頁沒寫，AUTH0 也生效了，讀回
    // 檢查只比對 AUTH0/ACCESS，於是回報上鎖成功。帶著 `pack` 驗之後，
    // 回應的 PACK 與期望值不符，這才是「密碼頁沒寫成功」的直接證據。
    dropWritePages = new Set([LAYOUT.packPage]);

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.kind, "verify-failed");
        assert.equal(error.stage, "verify");
        assert.match(error.message, /PACK/);
        assert.deepEqual(error.written, ["PWD", "PACK", "ACCESS", "AUTH0"]);
        return true;
      },
    );
  });

  it("PACK 相符 ⇒ 成功（同一張卡重寫一次不會被 expectedPack 誤判）", async () => {
    // 已受保護、且 PACK 頁已經是同一組 bytes：這是「同一張卡再跑一次」的
    // 形狀。帶 `expectedPack` 驗證時它必須仍然成功。
    pages.set(LAYOUT.configPage, [0x11, 0x22, 0x33, 0x04]);
    pages.set(LAYOUT.pwdPage, Array.from(PASSWORD));
    pages.set(LAYOUT.packPage, [0xab, 0xcd, 0x00, 0x00]);

    const result = await lockCard(LAYOUT, PASSWORD, PACK);

    assert.equal(result.auth0, 4);
    assert.deepEqual(
      writes().map(([page]) => page),
      [133, 134, 132, 131],
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

  it("逾時時把已確認寫入的頁一起回報，並說上鎖狀態未知", async () => {
    // 第三頁（ACCESS）卡住 40ms，而 deadline 是 5ms ⇒ 中斷先到，寫入還在飛。
    // 舊行為只回「Unknown: the reader stopped answering」，操作員不知道卡片
    // 已經被寫了兩頁，也不知道該不該再碰它。
    slowPages = new Set([LAYOUT.accessPage]);
    slowDelayMs = 40;

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK, { timeoutMs: 5 }),
      (error) => {
        assert.equal(error.kind, "timeout");
        assert.deepEqual(
          error.written,
          ["PWD", "PACK"],
          "中斷當下已經確認寫入的頁必須跟著錯誤走",
        );
        assert.match(error.cardState, /unknown/i, "必須明說上鎖狀態未知");
        assert.match(error.cardState, /2 page/);
        assert.match(error.cardState, /read it back/i);
        return true;
      },
    );

    // 中斷之後 `work` 還在跑（它不知道 deadline 到了）。立刻撤讀取器會把那次
    // 寫入切成兩半，所以必須等它收手；但也不能無限等——真不回來就強制取消。
    const settledAt = timeline.indexOf(`settled:${LAYOUT.accessPage}`);
    const cancelAt = timeline.indexOf("cancel");
    assert.ok(settledAt >= 0, "慢的那一頁最後必須收手");
    assert.ok(cancelAt >= 0, "reader 仍然必須被釋放");
    assert.ok(
      settledAt < cancelAt,
      `cancelTechnologyRequest 必須在 running 收手之後（${timeline.join(" → ")}）`,
    );
  });
});

describe("lockCard — 卡片本來就鎖著（AUTH0 ≠ 0xFF）", () => {
  it("已保護但密碼不對 ⇒ 先 PWD_AUTH、一頁都不寫，且不會說「仍未受保護」", async () => {
    // `basic` 的 `PROT = 0` ⇒ 讀取不受限制，所以這是「讀得到、但已經受保護」
    // 的那張卡。舊行為會直接進寫入迴圈：四頁全部 NAK，然後回報「卡片仍未受
    // 保護，可以再寫一次」——對一張鎖著的卡，那是兩句假話。
    pages.set(LAYOUT.configPage, [0x11, 0x22, 0x33, 0x04]);
    pages.set(LAYOUT.pwdPage, [0xde, 0xad, 0xbe, 0xef]);

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.kind, "no-response");
        assert.equal(error.stage, "auth", "必須停在 auth，不是 write");
        assert.deepEqual(error.written, []);
        const text = `${error.message} ${error.cardState}`;
        assert.ok(!/unprotected/i.test(text), `不得說未受保護：${text}`);
        assert.ok(
          !/can be written again/i.test(text),
          `不得說可以再寫：${text}`,
        );
        assert.match(error.cardState, /still protected/i);
        return true;
      },
    );

    assert.deepEqual(writes(), [], "密碼不對時一頁都不准寫");
    assert.deepEqual(
      commands.map((command) => command[0]),
      [0x30, 0x1b],
      "讀設定頁 → PWD_AUTH，中間沒有任何寫入",
    );
    assert.equal(cancelCalls, 1);
  });

  it("已保護但密碼正確 ⇒ 先驗證再寫，四頁照常寫完", async () => {
    pages.set(LAYOUT.configPage, [0x11, 0x22, 0x33, 0x04]);
    pages.set(LAYOUT.pwdPage, Array.from(PASSWORD));

    const result = await lockCard(LAYOUT, PASSWORD, PACK);

    assert.equal(result.auth0, 4);
    const authIndex = commands.findIndex((command) => command[0] === 0x1b);
    const firstWriteIndex = commands.findIndex(
      (command) => command[0] === 0xa2,
    );
    assert.ok(authIndex >= 0, "已保護的卡必須送 PWD_AUTH");
    assert.ok(authIndex < firstWriteIndex, "PWD_AUTH 必須在第一個寫入命令之前");
    assert.deepEqual(
      writes().map(([page]) => page),
      [133, 134, 132, 131],
    );
  });

  it("已保護的卡在 AUTH0 那頁失手 ⇒ 也不能說「仍未受保護」", async () => {
    // `AUTH0` 是最後一頁，所以 `!written.includes("AUTH0")` 那一支對**已受
    // 保護**的卡照樣會被走到。它的舊文案無條件說「仍在出廠值、仍未受保護」
    // ——同一個家族的第二句假話。
    pages.set(LAYOUT.configPage, [0x11, 0x22, 0x33, 0x04]);
    pages.set(LAYOUT.pwdPage, Array.from(PASSWORD));
    failWritePages = new Set([LAYOUT.configPage]);

    await assert.rejects(
      () => lockCard(LAYOUT, PASSWORD, PACK),
      (error) => {
        assert.equal(error.stage, "write");
        assert.deepEqual(error.written, ["PWD", "PACK", "ACCESS"]);
        assert.ok(!/unprotected/i.test(error.cardState), error.cardState);
        assert.ok(!/factory value/i.test(error.cardState), error.cardState);
        assert.match(error.cardState, /already protected/i);
        return true;
      },
    );
  });
});

describe("ntagLayout", () => {
  it("可由型號取得頁碼（呼叫端不必自己抄一份）", () => {
    assert.equal(ntagLayout("NTAG213").configPage, 41);
    assert.equal(ntagLayout("NTAG216").pwdPage, 229);
  });
});
