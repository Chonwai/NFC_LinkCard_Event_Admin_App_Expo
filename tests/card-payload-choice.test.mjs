/**
 * 2026-10-30：`chooseCardPayloadUrl` ——「寫進卡裡的那一個網址」的唯一決策點。
 *
 * 定案形状：有公開名片 ⇒ `${WEB_BASE_URL}/p/{slug}?e={eventId}`（感應即名片，
 * 且說得出哪一場）；沒有 ⇒ `/t/{eventId}/{tagUid}`（保底，由 FE 動態解析）。
 *
 * 為什麼一定要有 `?e=`：手帶是依活動發的，同一人三場就是三條。若卡上只有
 * `/p/{slug}`，三條手帶會是**完全相同的網址**，於是「你在哪一場遇到他」無法回答，
 * 交換聯絡也少了 eventId 可以歸屬。
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
  it("有公開名片 ⇒ 寫 `/p/{slug}?e={eventId}`，family=profile", () => {
    const chosen = chooseCardPayloadUrl({
      eventId: "evt-1",
      tagUid: "04A1B2C3",
      profileUrl: PROFILE,
    });

    assert.equal(chosen.family, "profile");
    assert.equal(
      chosen.url,
      `${buildRegistrationProfileUrl("chan-tai-man")}?e=evt-1`,
    );
    assert.ok(!chosen.url.includes("/t/"), `不得寫解析器：${chosen.url}`);
  });

  it("沒有名片（null／undefined／空字串）⇒ 退回解析器，family=event-tap", () => {
    for (const profileUrl of [null, undefined, "", "   "]) {
      const chosen = chooseCardPayloadUrl({
        eventId: "evt-1",
        tagUid: "04:a1:B2:c3",
        profileUrl,
      });

      assert.equal(
        chosen.family,
        "event-tap",
        `profileUrl=${String(profileUrl)}`,
      );
      assert.equal(chosen.url, buildCardPayloadUrl("evt-1", "04A1B2C3"));
    }
  });

  it("兩場活動的同一人拿到不同網址（活動仍在卡面 URL 裡）", () => {
    const a = chooseCardPayloadUrl({
      eventId: "evt-A",
      tagUid: "04AAAABBBB",
      profileUrl: PROFILE,
    });
    const b = chooseCardPayloadUrl({
      eventId: "evt-B",
      tagUid: "04CCCCDDDD",
      profileUrl: PROFILE,
    });

    assert.notEqual(a.url, b.url);
    assert.ok(a.url.endsWith("?e=evt-A"), a.url);
    assert.ok(b.url.endsWith("?e=evt-B"), b.url);
  });

  it("選到 profile 家族時不需要有效 UID（名片網址與卡片本身無關）", () => {
    const chosen = chooseCardPayloadUrl({
      eventId: "evt-1",
      tagUid: "",
      profileUrl: PROFILE,
    });

    assert.equal(chosen.family, "profile");
  });

  it("名片網址形狀可疑 ⇒ 一律不採用（猜錯的網址＝現場修不了的 404 卡）", () => {
    for (const profileUrl of [
      `${WEB_BASE_URL}/t/evt-1/04A1B2C3`, // 解析器網址，不是名片
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
          eventId: "evt-1",
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
      eventId: "evt-1",
      tagUid: "04A1B2C3",
      profileUrl: `${PROFILE}?utm=x#frag`,
    });
    assert.equal(chosen.url, `${WEB_BASE_URL}/p/chan-tai-man?e=evt-1`);
  });

  it("相對路徑（BE 在 `/t/` lookup 回的就是相對路徑）也吃得下", () => {
    assert.equal(slugFromProfileUrl("/p/chan-tai-man"), "chan-tai-man");
  });

  it("結尾多一條斜線仍視為同一張名片（不因此退回解析器）", () => {
    assert.equal(slugFromProfileUrl(`${PROFILE}/`), "chan-tai-man");
  });
});

describe("previewCardPayloadUrl 確認畫面那一行字", () => {
  it("有名片 ⇒ 直接給實際會寫進卡的完整網址（含 ?e=）", () => {
    assert.equal(
      previewCardPayloadUrl({ eventId: "evt-1", profileUrl: PROFILE }),
      `${WEB_BASE_URL}/p/chan-tai-man?e=evt-1`,
    );
  });

  it("沒名片 ⇒ 只給模板（tagUid 要感應才讀得到，不得假裝知道）", () => {
    const preview = previewCardPayloadUrl({
      eventId: "evt-1",
      profileUrl: null,
    });

    assert.equal(preview, `${WEB_BASE_URL}/t/evt-1/…`);
    assert.ok(preview.includes("…"));
    assert.ok(
      buildCardPayloadUrl("evt-1", "04A1B2C3").startsWith(
        preview.replace("…", ""),
      ),
    );
  });
});

describe("buildCardPayloadUrl 仍是解析器唯一的組裝點（既有契約不變）", () => {
  it("無效 UID 仍拋 write-failed（不得因為多了家族決策就放寬）", () => {
    assert.throws(
      () => buildCardPayloadUrl("evt-1", "XYZ"),
      (error) => error instanceof NfcFlowError && error.kind === "write-failed",
    );
  });
});
