/**
 * `F-01` 的行為鎖定：**畫面**必須把錯誤判定結果顯示出來。
 *
 * 為什麼不能只測 `resolveCheckInErrorMessage`：上一輪正是這樣測的，全綠，
 * 而線上（`docs/evidence/UI-REVIEW/`）閘道 502 與真正的 404 仍然逐字相同——
 * 因為畫面從來沒有渲染判定結果。所以這裡走**畫面實際走的那條路**：
 * 後端錯誤 → `resolveCheckInErrorMessage` → `check-in-display` 的兩行字，
 * 再斷言兩者不同。
 *
 * runtime 半：讀真正的模組。
 * static 半：`check-in.tsx` 是 .tsx，需要 React Native 才能 render，純 Node
 * 載不進來（同 `lookup-timeout.test.mjs` / `count-display.test.mjs` 的既有做法），
 * 因此改讀原始碼，確認畫面真的渲染這一行，而不是只有一個沒有讀者的函式。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { copy } = await import("@/constants/copy.zh-TW");
const {
  CHECK_IN_COUNTER_LOADING,
  getCheckInCounterHint,
  getCheckInCounterValue,
  getCheckInOutcomeDetail,
  getCheckInOutcomeHeadline,
} = await import("@/utils/check-in-display");
const { resolveCheckInErrorMessage } = await import("@/utils/check-in-errors");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readSource = (relative) =>
  readFileSync(path.join(REPO_ROOT, relative), "utf8");

/** 伺服器沒有回應（連不上／逾時）：axios 不帶 response */
const transportError = (code, message) =>
  code === undefined ? { message } : { code, message };

/** 伺服器有回應的後端錯誤 */
const apiError = (status, code, message) => ({
  response: {
    status,
    data: {
      error: { ...(code ? { code } : {}), ...(message ? { message } : {}) },
    },
  },
});

/**
 * 畫面實際顯示的字：`check-in.tsx` 的 `doLookupThenCheckIn` catch 分支
 * 把 `resolveCheckInErrorMessage(err)` 放進 `message`，結果卡再把 headline
 * 與 detail 畫出來。這一支把三段接起來，回傳「操作者看到的那幾行」。
 */
function renderedOutcomeText(error) {
  const outcome = {
    phase: "outcome",
    kind: "invalid",
    code: "ABC-999",
    message: resolveCheckInErrorMessage(error),
  };

  return [
    getCheckInOutcomeHeadline(outcome.kind),
    getCheckInOutcomeDetail(outcome),
  ]
    .filter((line) => line != null)
    .join("\n");
}

test("F-01：閘道 502 與真正的 404 在畫面上是**不同**的字", () => {
  // 閘道回 HTML：沒有 response.data.error，既沒有 code 也沒有 message。
  const gatewayDown = renderedOutcomeText({ response: { status: 502 } });
  const notFound = renderedOutcomeText(apiError(404, "REGISTRATION_NOT_FOUND"));

  assert.notEqual(
    gatewayDown,
    notFound,
    "伺服器壞掉與這張票不存在，不可以顯示成同一組字",
  );

  assert.ok(
    gatewayDown.includes(copy.checkIn.serverError),
    `5xx 畫面必須出現伺服器文案：${gatewayDown}`,
  );
  assert.ok(
    notFound.includes(copy.checkIn.registrationNotFound),
    `404 畫面必須出現找不到報名的文案：${notFound}`,
  );

  // 反向：5xx 畫面不得講成「找不到此報名」（現場會據此作廢有效票）。
  assert.ok(
    !gatewayDown.includes(copy.checkIn.registrationNotFound),
    "5xx 不得顯示「找不到此報名」",
  );
});

test("F-01：連不上伺服器是第三種字，與 404、5xx 都不同", () => {
  const offline = renderedOutcomeText(transportError("ERR_NETWORK"));
  const gatewayDown = renderedOutcomeText({ response: { status: 503 } });
  const notFound = renderedOutcomeText(apiError(404));

  assert.ok(offline.includes(copy.checkIn.networkError), offline);
  assert.notEqual(offline, gatewayDown);
  assert.notEqual(offline, notFound);
  assert.notEqual(gatewayDown, notFound);
});

test("F-01：每個 5xx 都拿到伺服器文案，且都不是「找不到此報名」", () => {
  for (const status of [500, 502, 503, 504]) {
    const text = renderedOutcomeText(apiError(status, "SOMETHING_NEW"));
    assert.ok(text.includes(copy.checkIn.serverError), `${status}: ${text}`);
    assert.ok(
      !text.includes(copy.checkIn.registrationNotFound),
      String(status),
    );
  }
});

test("F-01：後端錯誤碼仍優先——已映射的訊息原樣顯示在第二行", () => {
  const text = renderedOutcomeText(apiError(409, "REGISTRATION_NOT_CONFIRMED"));
  assert.ok(text.includes(copy.checkIn.notConfirmed), text);
  assert.ok(text.includes(copy.checkIn.invalidHeadline), text);
});

test("成功的結果只顯示一行（第二行與標題逐字相同時不重複渲染）", () => {
  assert.equal(
    getCheckInOutcomeDetail({
      phase: "outcome",
      kind: "valid",
      code: "ABC-001",
      message: copy.checkIn.checkedIn,
    }),
    null,
  );
});

test("重複態的第二行是「已報到過」，不是標題的重複", () => {
  const detail = getCheckInOutcomeDetail({
    phase: "outcome",
    kind: "duplicate",
    code: "ABC-001",
    message: copy.checkIn.alreadyCheckedIn,
  });

  assert.equal(detail, copy.checkIn.alreadyCheckedIn);
  assert.notEqual(detail, copy.checkIn.duplicateHeadline);
});

test("空白訊息不會渲染出一行空白", () => {
  assert.equal(
    getCheckInOutcomeDetail({
      phase: "outcome",
      kind: "invalid",
      code: "ABC-001",
      message: "   ",
    }),
    null,
  );
});

test("標題表覆蓋三態且取自 copy", () => {
  assert.equal(getCheckInOutcomeHeadline("valid"), copy.checkIn.validHeadline);
  assert.equal(
    getCheckInOutcomeHeadline("duplicate"),
    copy.checkIn.duplicateHeadline,
  );
  assert.equal(
    getCheckInOutcomeHeadline("invalid"),
    copy.checkIn.invalidHeadline,
  );
});

test("[static] 結果卡真的渲染第二行（否則這只是一個沒有讀者的函式）", () => {
  const source = readSource("src/app/(auth)/[eventId]/check-in.tsx");

  assert.match(
    source,
    /getCheckInOutcomeDetail\(outcome\)/,
    "check-in.tsx 必須用 check-in-display 推導第二行",
  );
  assert.match(source, /\{outcomeDetail\}/, "推導出來的第二行必須真的被渲染");
  assert.match(
    source,
    /getCheckInOutcomeHeadline\(outcome\.kind\)/,
    "標題也必須走同一個來源，不得在畫面另寫一份",
  );
});

/**
 * `F-03`：總簽到計數讀不到時，破折號必須帶著原因。
 * 同一屏的其他破折號都有解釋（`event.tokenDegradedHint`、`nfcEmptyHint`、
 * `orgEmptyHint`），只有這一顆數字沒有——而它正好是現場最需要看懂的那一顆。
 */
test("F-03：讀取失敗時說明文字與正常態不同，且說出原因", () => {
  const degraded = getCheckInCounterHint(true);
  const healthy = getCheckInCounterHint(false);

  assert.notEqual(degraded, healthy, "失敗態不得沿用「（累計，非今日）」");
  assert.equal(degraded, copy.checkIn.counterUnavailableHint);
  assert.ok(degraded.includes("讀取失敗"), degraded);
  assert.equal(healthy, copy.checkIn.counterFallbackHint);
  assert.ok(!healthy.includes("讀取失敗"), healthy);
});

test("F-03：讀不到顯示破折號，但真正的 0 仍然顯示 0", () => {
  assert.equal(getCheckInCounterValue(true, 42), copy.checkIn.dash);
  assert.equal(getCheckInCounterValue(true, null), copy.checkIn.dash);
  assert.equal(getCheckInCounterValue(false, 0), "0");
  assert.equal(getCheckInCounterValue(false, 42), "42");
  assert.equal(getCheckInCounterValue(false, null), CHECK_IN_COUNTER_LOADING);
  assert.notEqual(getCheckInCounterValue(false, 0), copy.checkIn.dash);
});

test("[static] 計數的兩個值都走 check-in-display，畫面不再自己寫死", () => {
  const source = readSource("src/app/(auth)/[eventId]/check-in.tsx");

  assert.match(source, /getCheckInCounterHint\(counterError\)/);
  assert.match(
    source,
    /getCheckInCounterValue\(counterError, checkedInTotal\)/,
  );
  assert.doesNotMatch(
    source,
    /copy\.checkIn\.counterFallbackHint/,
    "正常態的提示字串也必須走同一個來源",
  );
});
