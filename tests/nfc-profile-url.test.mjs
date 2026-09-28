/**
 * ADM-01: profile URL `/u/{id}` → `/p/{slug}` + 寫入後的**讀回驗證**（`urlsMatch`）。
 *
 * X-23 預設寫卡值來源是 BE `profileUrl`；本檔鎖住 helper 形狀與回讀不變式。
 *
 * ⚠️ 這一支原本有一條**恆真測試**（D2 `A1`）：
 * `it('urlsMatch 等價：尾斜線差異仍應視為 match')` 在測試檔內自己寫了一份
 * `normalizeUrl()`，再拿 `normalizeUrl(expected) === normalizeUrl(actual)` 當斷言
 * ——expected 與 actual 都由受測物**自身**產生，`urlsMatch` 就算永遠回 `true`
 * 它也不會紅。現在改成驅動真正的讀回路徑（`writeUriToCard` → `nfc-utils.ts:164`
 * 的 `urlsMatch`），讓斷言對「缺陷簽名」而不是對「函式名」。
 *
 * `urlsMatch` 是模組私有函式，唯一的觀察點就是這條讀回驗證，所以這裡以 NFC
 * manager mock 控制「讀回來的 URI」，其餘（含 `NfcFlowError`）都是真的。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

/** 讀回值（`Ndef.uri.decodePayload` 的回傳）由測試控制。 */
let readBackUri = "";

mock.module("react-native-nfc-manager", {
  defaultExport: {
    requestTechnology: () => Promise.resolve("Ndef"),
    cancelTechnologyRequest: () => Promise.resolve(),
    getTag: async () => ({ id: "04A1B2C3" }),
    ndefHandler: {
      writeNdefMessage: async () => undefined,
      getNdefMessage: async () => ({ ndefMessage: [{ payload: [1, 2, 3] }] }),
    },
  },
  namedExports: {
    NfcTech: { Ndef: "Ndef" },
    Ndef: {
      encodeMessage: () => [1, 2, 3],
      uriRecord: (uri) => uri,
      uri: { decodePayload: () => readBackUri },
    },
  },
});

const {
  buildRegistrationProfileUrl,
  NfcFlowError,
  buildUriNdefMessage,
  writeUriToCard,
} = await import("@/utils/nfc-utils");

const PROFILE_URL = buildRegistrationProfileUrl("abc-123");

test("buildRegistrationProfileUrl 以 /p/{slug} 結尾且不含 /u/", () => {
  const url = buildRegistrationProfileUrl("abc-123");
  assert.match(url, /\/p\/abc-123$/);
  assert.equal(url.includes("/u/"), false);
  assert.match(url, /^https?:\/\//);
});

test("T-ANQ-E1：讀回值只差一個尾斜線，仍必須視為 match（寫入成功並回傳讀回值）", async () => {
  readBackUri = `${PROFILE_URL}/`;

  const result = await writeUriToCard(PROFILE_URL, { timeoutMs: 1000 });

  assert.equal(result.writtenUri, `${PROFILE_URL}/`);
  assert.equal(result.tagUid, "04A1B2C3");
});

test("T-ANQ-E2：讀回值是真正不同的路徑，必須以 uri-mismatch 拒絕（不得被當成 match）", async () => {
  readBackUri = PROFILE_URL.replace(/abc-123$/, "abd-123");
  assert.notEqual(readBackUri, PROFILE_URL);

  await assert.rejects(
    () => writeUriToCard(PROFILE_URL, { timeoutMs: 1000 }),
    (error) => error instanceof NfcFlowError && error.kind === "uri-mismatch",
  );
});

test("空 slug 拋 write-failed（不得寫出空尾段 /p/）", () => {
  for (const bad of ["", "   "]) {
    assert.throws(
      () => buildRegistrationProfileUrl(bad),
      (err) =>
        err instanceof NfcFlowError &&
        err.kind === "write-failed" &&
        /missing profile slug/.test(err.message),
    );
  }
});

test("String(null) 等價情境拋 write-failed（不得把 null 寫進 tag）", () => {
  assert.throws(
    () => buildRegistrationProfileUrl(String(null)),
    (err) => err instanceof NfcFlowError && err.kind === "write-failed",
  );
});

test("buildUriNdefMessage 仍拒絕非 http(s) scheme", async () => {
  await assert.rejects(
    () => buildUriNdefMessage("ftp://x/p/a"),
    (err) => err instanceof NfcFlowError && err.kind === "write-failed",
  );
});
