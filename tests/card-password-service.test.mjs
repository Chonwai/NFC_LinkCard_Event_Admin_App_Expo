/**
 * `cardPasswordService` 的**通道語意測試**。
 *
 * ## 為什麼要這一支
 *
 * 這條路徑把使用者的 JWT 裝進一個**不是** axios／不是 `apiClient` 的請求裡
 * （見 `src/services/card-password.service.ts` 檔頭「為什麼是 Cookie」），所以
 * `api.ts` 的 request／response interceptor **完全不會跑到**。少了 interceptor，
 * 就少了兩件平常免費的事：401 不會自動登出、錯誤不會被分類。這些必須在這一支
 * 被釘住，否則「token 過期」在現場會表現成「這次不上鎖」——一個看起來很正常、
 * 但實際上永遠不會好的狀態。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**真機能不能送 `Cookie` header——那是 Wave 5 的真機驗證，CI 沒有硬體
 *   也沒有 Web origin。
 * - **不驗**那支 route 的行為——那是 `LinkCard_Frontend` 的事，本 repo 只借用它
 *   的狀態碼契約。
 * - **不驗** fetch 的逾時：5 秒的計時器要用假時鐘才測得乾淨，而在這條路徑上
 *   「逾時」與「斷網」走的是同一個 `catch`（同一個失因），分開驗只證明 Node 的
 *   `AbortController` 會動。
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

/** 每次 `fetch` 的呼叫參數都記在這裡，供斷言觀察。 */
let calls = [];
/** `tokenStorage.getItem` 被讀過的 key（順便驗「讀的是哪一個 App 的 token」）。 */
let readKeys = [];
let storedToken = "jwt-abc";
let fetchImpl = async () => {
  throw new Error("fetch 沒有被 stub");
};

mock.module("@/utils/storage", {
  namedExports: {
    tokenStorage: {
      // 只在**本 App 的** key 上回 token：讀錯 key 會讓下面「沒有 token」那條
      // 與「有 token」那幾條互相掩蓋。
      getItem: async (key) => {
        readKeys.push(key);
        return key === "lc_event_admin_token" ? storedToken : null;
      },
      setItem: async () => undefined,
      removeItem: async () => undefined,
    },
  },
});

const {
  classifyCardPasswordFailure,
  endpointUrl,
  fetchCardPassword,
  hexToPasswordBytes,
} = await import("@/services/card-password.service");
const { WEB_BASE_URL } = await import("@/constants/config");

const ORIGINAL_FETCH = globalThis.fetch;

function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function installFetch(handler) {
  fetchImpl = handler;
}

beforeEach(() => {
  calls = [];
  readKeys = [];
  storedToken = "jwt-abc";
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return fetchImpl(url, init);
  };
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("endpointUrl", () => {
  it("把 eventId 編碼後接在 Web 的 card-password 端點上", () => {
    const eventId = "evt/../me?x=1&y=2";
    assert.equal(
      endpointUrl(eventId),
      `${WEB_BASE_URL}/api/check-in/card-password?eventId=${encodeURIComponent(eventId)}`,
    );
    // 反例探針：直接內插（不編碼）會讓 `&y=2` 變成第二個查詢參數。
    assert.ok(!endpointUrl(eventId).includes("&y=2"));
  });
});

describe("fetchCardPassword — 請求形狀", () => {
  it("送 GET、no-store，並以 Cookie 攜帶 auth_token", async () => {
    installFetch(async () => respond(200, { password: "11223344" }));

    await fetchCardPassword("evt-1");

    assert.equal(calls.length, 1);
    const [{ url, init }] = calls;
    assert.equal(
      url,
      `${WEB_BASE_URL}/api/check-in/card-password?eventId=evt-1`,
    );
    assert.equal(init.method, "GET");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.Accept, "application/json");
    // 這支 route 只認 cookie（`AUTH_COOKIE = 'auth_token'`），沒有 Bearer 分支。
    assert.equal(init.headers.Cookie, "auth_token=jwt-abc");
    assert.equal(init.headers.Authorization, undefined);
  });

  it("讀的是本 App 的 token key，不是另一個 App 的", async () => {
    installFetch(async () => respond(200, { password: "11223344" }));

    await fetchCardPassword("evt-1");

    assert.deepEqual(readKeys, ["lc_event_admin_token"]);
  });
});

describe("fetchCardPassword — 成功", () => {
  it("回 4 bytes，值與 hex 對應", async () => {
    installFetch(async () => respond(200, { password: "a1b2C3d4" }));

    const result = await fetchCardPassword("evt-1");

    assert.equal(result.ok, true);
    assert.deepEqual([...result.password], [0xa1, 0xb2, 0xc3, 0xd4]);
    assert.ok(result.password instanceof Uint8Array);
  });

  it("回傳物件只有 ok 與 password —— 密碼不夾帶在別的名字裡", async () => {
    installFetch(async () => respond(200, { password: "11223344" }));

    const result = await fetchCardPassword("evt-1");

    assert.deepEqual(Object.keys(result), ["ok", "password"]);
    // 洩漏防線：整包序列化後不該出現 JWT（密碼本身是 bytes，不在這條斷言範圍）。
    assert.ok(!JSON.stringify(result).includes("jwt-abc"));
  });
});

describe("fetchCardPassword — 失因分類（照 Web 的枚舉）", () => {
  it("401 ⇒ not_signed_in", async () => {
    installFetch(async () =>
      respond(401, { reason: "unauthenticated", error: "x" }),
    );
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, {
      ok: false,
      reason: "not_signed_in",
      status: 401,
    });
  });

  it("403 ⇒ not_operator", async () => {
    installFetch(async () =>
      respond(403, { reason: "not_event_operator", error: "x" }),
    );
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, {
      ok: false,
      reason: "not_operator",
      status: 403,
    });
  });

  it("501 ⇒ not_configured（伺服器沒有設 NFC_CARD_PASSWORD）", async () => {
    installFetch(async () =>
      respond(501, { reason: "not_configured", error: "x" }),
    );
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, {
      ok: false,
      reason: "not_configured",
      status: 501,
    });
  });

  it("502 ⇒ check_unavailable（現在問不到，可重試）", async () => {
    installFetch(async () =>
      respond(502, { reason: "access_check_timeout", error: "x" }),
    );
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, {
      ok: false,
      reason: "check_unavailable",
      status: 502,
    });
  });

  it("400 且 reason 是參數錯 ⇒ unknown（不是權限、也不是設定）", async () => {
    installFetch(async () =>
      respond(400, { reason: "missing_event_id", error: "x" }),
    );
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, { ok: false, reason: "unknown", status: 400 });
  });

  it("200 但密碼格式錯 ⇒ unknown，且不回半個密碼", async () => {
    installFetch(async () => respond(200, { password: "1122" }));
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, { ok: false, reason: "unknown", status: 200 });
  });

  it("200 但 body 不是 JSON ⇒ unknown", async () => {
    installFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token < in JSON");
      },
    }));
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, { ok: false, reason: "unknown", status: 200 });
  });

  it("網路錯誤 ⇒ check_unavailable，status 為 null", async () => {
    installFetch(async () => {
      throw new TypeError("Network request failed");
    });
    const result = await fetchCardPassword("evt-1");
    assert.deepEqual(result, {
      ok: false,
      reason: "check_unavailable",
      status: null,
    });
  });
});

describe("fetchCardPassword — 沒有 token 就不打", () => {
  it("未登入 ⇒ not_signed_in，且一趟都沒送", async () => {
    storedToken = null;
    installFetch(async () => respond(200, { password: "11223344" }));

    const result = await fetchCardPassword("evt-1");

    assert.deepEqual(result, {
      ok: false,
      reason: "not_signed_in",
      status: null,
    });
    // 反例探針：若少了這道前置檢查，這裡會變成 1（多一趟註定 401 的往返）。
    assert.equal(calls.length, 0);
  });
});

describe("classifyCardPasswordFailure / hexToPasswordBytes", () => {
  it("狀態碼對照表與 Web 的實作一致", () => {
    assert.equal(classifyCardPasswordFailure(401), "not_signed_in");
    assert.equal(classifyCardPasswordFailure(403), "not_operator");
    assert.equal(classifyCardPasswordFailure(501), "not_configured");
    assert.equal(classifyCardPasswordFailure(502), "check_unavailable");
    assert.equal(classifyCardPasswordFailure(500), "check_unavailable");
    assert.equal(classifyCardPasswordFailure(null), "check_unavailable");
    assert.equal(classifyCardPasswordFailure(200), "unknown");
    assert.equal(
      classifyCardPasswordFailure(400, "invalid_event_id"),
      "unknown",
    );
    // `reason` 的判斷**在狀態碼之前**（與 Web 的實作同序）。所以 403 只要帶了
    // 那兩個 400 專用的 reason 也會被判成 `unknown`。這在有真實 403 的呼叫端
    // 看起來很怪，但 Web 是這樣寫的、而 route 只會把這兩個 reason 配 400 發出，
    // 所以實際打不到。這裡釘住的是「照抄」而不是「我覺得應該怎樣」——若哪天
    // 想改成先看狀態碼，兩邊要一起改，否則同一個回應會得到兩種失因。
    assert.equal(
      classifyCardPasswordFailure(403, "missing_event_id"),
      "unknown",
    );
    assert.equal(classifyCardPasswordFailure(403), "not_operator");
  });

  it("hex 只接受 8 個 hex 字元", () => {
    assert.deepEqual(
      [...hexToPasswordBytes("00112233")],
      [0, 0x11, 0x22, 0x33],
    );
    assert.equal(hexToPasswordBytes("0011223"), null);
    assert.equal(hexToPasswordBytes("0011223344"), null);
    assert.equal(hexToPasswordBytes("zzzzzzzz"), null);
    assert.equal(hexToPasswordBytes(""), null);
  });
});
