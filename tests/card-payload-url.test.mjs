/**
 * `INC-3`（Loop AF，2026-10-05）：`buildCardPayloadUrl`——卡面解析器 URL 的唯一組裝來源。
 *
 * 為什麼需要這一支：卡面 URL 是「寫進實體卡、任何人 tap 都看得到」的公開字串
 * ⇒ 形狀、編碼與「不含憑證」必須用**行為**鎖住（不是掃原始碼字串）。
 * 模組替身：`react-native`（Platform）——`nfc-utils` 為 web-safe 工具層，
 * 頂層依賴 Platform；NFC manager 不需 mock（本函式不觸及）。
 *
 * 反例探針（RED→GREEN，實測見 `03-execute-loop-af.md`）：
 * - 把 `/t/` 改回 `/p/` ⇒ 形狀條必紅。
 * - 把 `normalizeTagUid` 拿掉 ⇒ tagUid 正規化條必紅。
 */
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const { buildCardPayloadUrl, NfcFlowError } = await import("@/utils/nfc-utils");
const { WEB_BASE_URL } = await import("@/constants/config");

describe("buildCardPayloadUrl 解析器 URL（INC-3）", () => {
  it("形狀：`${WEB_BASE_URL}/t/{eventId}/{tagUid}`，origin 為 https", () => {
    const url = buildCardPayloadUrl("ev-1", "04A1B2C3");
    assert.equal(url, `${WEB_BASE_URL}/t/ev-1/04A1B2C3`);
    assert.equal(new URL(WEB_BASE_URL).protocol, "https:");
  });

  it("tagUid 先正規化（小寫、含分隔符 → 大寫 hex；與寫卡流程同一套 normalize）", () => {
    assert.equal(
      buildCardPayloadUrl("ev-1", "04:a1:B2:c3"),
      `${WEB_BASE_URL}/t/ev-1/04A1B2C3`,
    );
  });

  it("兩個路徑段都 URL-encode（eventId 含斜線不得穿出 `/t/` 路徑）", () => {
    const url = buildCardPayloadUrl("ev/1", "04A1B2C3");
    assert.ok(url.includes("/t/ev%2F1/04A1B2C3"), `未 encode：${url}`);
  });

  it("不含任何憑證：無 query string、不含 token/secret/key/auth 字樣（R4）", () => {
    const url = buildCardPayloadUrl("ev-1", "04A1B2C3");
    assert.equal(
      url.includes("?"),
      false,
      "卡面 URL 不得帶 query（token 的溫床）",
    );
    assert.equal(
      /token|secret|passwd|password|api[_-]?key/i.test(url),
      false,
      "卡面 URL 不得含憑證字樣（任何人 tap 都看得到卡面內容）",
    );
  });

  it("eventId 缺空或 tagUid 無效（空／非 hex／過短）→ 拋 write-failed，不得寫出壞 URL", () => {
    for (const [eventId, tagUid] of [
      ["", "04A1B2C3"],
      ["   ", "04A1B2C3"],
      ["ev-1", ""],
      ["ev-1", "XYZ"],
      ["ev-1", "04A1B2C"],
      ["ev-1", "04A1B2C3D"],
    ]) {
      assert.throws(
        () => buildCardPayloadUrl(eventId, tagUid),
        (error) =>
          error instanceof NfcFlowError && error.kind === "write-failed",
        `(eventId=${JSON.stringify(eventId)}, tagUid=${JSON.stringify(tagUid)}) 必須被擋`,
      );
    }
  });
});
