/**
 * 2026-10-29：`chooseCardPayloadUrl`——「寫進卡裡的那一個網址」的唯一決策點。
 *
 * 為什麼要補這一支（原本只有 `buildCardPayloadUrl` 的形狀測試）：卡面 URL 從
 * 「固定解析器」變成「兩個家族，依當事人有沒有公開名片決定」。決策本身是行為，
 * 不是形狀——所以要鎖的是：
 *   ① 有公開名片 ⇒ 寫 `/p/{slug}`（tap 一次就到，不多繞解析頁）。
 *   ② 沒有 ⇒ 才退回 `/t/{eventId}/{tagUid}`（先綁卡後建檔也會自動升級）。
 *   ③ `profileUrl` 形狀可疑（不是恰好 `/p/{單一段}`）⇒ **不得**寫進卡片，
 *      寧可退回解析器：猜錯的網址會變成一張現場沒人能修的 404 卡。
 *
 * 模組替身：`react-native`（Platform）——`nfc-utils` 為 web-safe 工具層，
 * 頂層依賴 Platform；NFC manager 不需 mock（這些函式不觸及）。
 */
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const {
  buildCardPayloadUrl,
  buildRegistrationProfileUrl,
  chooseCardPayloadUrl,
  previewCardPayloadUrl,
  slugFromProfileUrl,
  NfcFlowError,
} = await import("@/utils/nfc-utils");
const { WEB_BASE_URL } = await import("@/constants/config");

const PROFILE = `${WEB_BASE_URL}/p/chan-tai-man`;

describe("chooseCardPayloadUrl 家族決策", () => {
  it("有公開名片 ⇒ 寫 `/p/{slug}`，family=profile（不再多繞一層解析頁）", () => {
    const chosen = chooseCardPayloadUrl({
      eventId: "ev-1",
      tagUid: "04A1B2C3",
      profileUrl: PROFILE,
    });

    assert.equal(chosen.family, "profile");
    assert.equal(chosen.url, buildRegistrationProfileUrl("chan-tai-man"));
    assert.ok(!chosen.url.includes("/t/"), `不得寫解析器：${chosen.url}`);
  });

  it("沒有名片（null／undefined／空字串）⇒ 退回解析器，family=event-tap", () => {
    for (const profileUrl of [null, undefined, "", "   "]) {
      const chosen = chooseCardPayloadUrl({
        eventId: "ev-1",
        tagUid: "04:a1:B2:c3",
        profileUrl,
      });

      assert.equal(
        chosen.family,
        "event-tap",
        `profileUrl=${String(profileUrl)}`,
      );
      assert.equal(chosen.url, buildCardPayloadUrl("ev-1", "04A1B2C3"));
    }
  });

  it("選到 profile 家族時不需要有效 UID（名片網址與卡片本身無關）", () => {
    const chosen = chooseCardPayloadUrl({
      eventId: "ev-1",
      tagUid: "",
      profileUrl: PROFILE,
    });

    assert.equal(chosen.family, "profile");
    assert.equal(chosen.url, `${WEB_BASE_URL}/p/chan-tai-man`);
  });

  it("名片網址形狀可疑 ⇒ 一律不採用（猜錯的網址＝現場修不了的 404 卡）", () => {
    for (const profileUrl of [
      `${WEB_BASE_URL}/t/ev-1/04A1B2C3`, // 解析器網址，不是名片
      `${WEB_BASE_URL}/p/`, // 沒有 slug
      `${WEB_BASE_URL}/p/a/b`, // 多段
      "not-a-url", // 完全不是網址
      "https://[bad", // 連網址都不是（取 pathname 會拋）
    ]) {
      assert.equal(
        slugFromProfileUrl(profileUrl),
        null,
        `必須拒絕：${profileUrl}`,
      );
      assert.equal(
        chooseCardPayloadUrl({
          eventId: "ev-1",
          tagUid: "04A1B2C3",
          profileUrl,
        }).family,
        "event-tap",
        `可疑網址不得寫進卡片：${profileUrl}`,
      );
    }
  });

  it("query／hash 被丟棄而不是拒收——回收的是 slug，全網址不會進卡片", () => {
    // 與 `LinkCard_Frontend` 的同名函式逐字一致（孿生實作）。
    assert.equal(slugFromProfileUrl(`${PROFILE}?utm=x`), "chan-tai-man");
    assert.equal(slugFromProfileUrl(`${PROFILE}#frag`), "chan-tai-man");

    const chosen = chooseCardPayloadUrl({
      eventId: "ev-1",
      tagUid: "04A1B2C3",
      profileUrl: `${PROFILE}?utm=x#frag`,
    });
    assert.equal(chosen.url, `${WEB_BASE_URL}/p/chan-tai-man`);
    assert.equal(
      chosen.url.includes("?"),
      false,
      "卡面 URL 不得帶 query（R4）",
    );
  });

  it("相對路徑（BE 在 `/t/` lookup 回的就是相對路徑）也吃得下", () => {
    assert.equal(slugFromProfileUrl("/p/chan-tai-man"), "chan-tai-man");
  });

  it("結尾多一條斜線仍視為同一張名片（不因此退回解析器）", () => {
    assert.equal(slugFromProfileUrl(`${PROFILE}/`), "chan-tai-man");
  });
});

describe("previewCardPayloadUrl 確認畫面那一行字", () => {
  it("有名片 ⇒ 直接給實際會寫進卡的完整網址（不需要 UID）", () => {
    assert.equal(
      previewCardPayloadUrl({ eventId: "ev-1", profileUrl: PROFILE }),
      `${WEB_BASE_URL}/p/chan-tai-man`,
    );
  });

  it("沒名片 ⇒ 只給模板（tagUid 要感應才讀得到，不得假裝知道）", () => {
    const preview = previewCardPayloadUrl({
      eventId: "ev-1",
      profileUrl: null,
    });

    assert.equal(preview, `${WEB_BASE_URL}/t/ev-1/…`);
    assert.ok(preview.includes("…"));
    // 模板必須與真正會寫出的網址同前綴，否則操作員看到的字與卡片內容不符。
    assert.ok(
      buildCardPayloadUrl("ev-1", "04A1B2C3").startsWith(
        preview.replace("…", ""),
      ),
    );
  });
});

describe("buildCardPayloadUrl 仍是解析器唯一的組裝點（既有契約不變）", () => {
  it("無效 UID 仍拋 write-failed（不得因為多了家族決策就放寬）", () => {
    assert.throws(
      () => buildCardPayloadUrl("ev-1", "XYZ"),
      (error) => error instanceof NfcFlowError && error.kind === "write-failed",
    );
  });
});
