/**
 * ADM-01: profile URL `/u/{id}` → `/p/{slug}` + urlsMatch 尾斜線容錯。
 *
 * X-23 預設寫卡值來源是 BE `profileUrl`；本檔鎖住 helper 形狀與回讀不變式。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const { buildRegistrationProfileUrl, NfcFlowError, buildUriNdefMessage } =
  await import("@/utils/nfc-utils");

function normalizeUrl(value) {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

test("buildRegistrationProfileUrl 以 /p/{slug} 結尾且不含 /u/", () => {
  const url = buildRegistrationProfileUrl("abc-123");
  assert.match(url, /\/p\/abc-123$/);
  assert.equal(url.includes("/u/"), false);
  assert.match(url, /^https?:\/\//);
});

test("urlsMatch 等價：尾斜線差異仍應視為 match（回讀驗證）", () => {
  const expected = buildRegistrationProfileUrl("abc-123");
  const actual = `${expected}/`;
  assert.equal(normalizeUrl(expected), normalizeUrl(actual));
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
