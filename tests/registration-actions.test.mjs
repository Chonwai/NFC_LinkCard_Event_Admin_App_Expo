/**
 * 名單管理動作的**規則**鎖定（不是 wire 契約）。
 *
 * 這一條規則決定「畫面上會出現哪些按鈕」，而它先前只是一個內嵌在畫面裡的
 * if/else——畫面拉的 `react-native` 讓它在 Node 測試裡載不進來，於是規則
 * 只能靠人記住。抽成純函式之後，這裡就可以直接斷言：
 *
 * 1. 狀態修正**只在** `CONFIRMED` / `CHECKED_IN` 出現，而且目標剛好是另一邊。
 * 2. 隱藏與封存是兩條獨立軸，四種組合都要正確（不是「隱藏了就順便封存」）。
 * 3. 狀態修正排在最上方——Web 的 row menu 刻意讓它與下面的資料品質操作分開，
 *    因為「更正錯誤」跟「把資料藏起來」不是同一層級的動作。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { correctionTargetFor, manageActionsFor, REVERSE_ACTION } =
  await import("@/utils/registration-actions");

/** 最小可用的 registration；只帶規則會讀的欄位。 */
function reg(overrides = {}) {
  return {
    id: "reg-1",
    registrationCode: "ABC123",
    status: "CONFIRMED",
    ...overrides,
  };
}

test("CONFIRMED → 修正目標是 CHECKED_IN（人工報到）", () => {
  assert.equal(correctionTargetFor(reg({ status: "CONFIRMED" })), "CHECKED_IN");
});

test("CHECKED_IN → 修正目標是 CONFIRMED（撤銷報到）", () => {
  assert.equal(correctionTargetFor(reg({ status: "CHECKED_IN" })), "CONFIRMED");
});

test("其餘狀態不提供狀態修正（避免給出必定 409 的按鈕）", () => {
  for (const status of [
    "PENDING_PAYMENT",
    "CANCELLED",
    "NO_SHOW",
    "REFUNDED",
    "ARCHIVED",
    "",
  ]) {
    assert.equal(correctionTargetFor(reg({ status })), null, status);
  }
});

test("已隱藏、已封存 → 兩軸各自翻面，且沒有狀態修正與退款", () => {
  assert.deepEqual(
    manageActionsFor(reg({ status: "ARCHIVED", isHidden: true })),
    ["unhide", "unarchive"],
  );
});

test("CONFIRMED 未隱藏未封存 → 四個動作，順序為 修正 / 退款 / 隱藏 / 封存", () => {
  assert.deepEqual(manageActionsFor(reg()), [
    "correct",
    "refund",
    "hide",
    "archive",
  ]);
});

test("CHECKED_IN 同樣提供退款登記（已入場仍可能要退押金）", () => {
  assert.deepEqual(manageActionsFor(reg({ status: "CHECKED_IN" })), [
    "correct",
    "refund",
    "hide",
    "archive",
  ]);
});

test("PENDING_PAYMENT 不提供退款登記（沒收到押金就沒有可退的）", () => {
  const actions = manageActionsFor(reg({ status: "PENDING_PAYMENT" }));
  assert.equal(actions.includes("refund"), false);
  assert.equal(actions.includes("correct"), false);
  assert.deepEqual(actions, ["hide", "archive"]);
});

/** 已封存但未隱藏 → 修正與退款消失，隱藏/封存各自獨立 */
test("已封存但未隱藏 → 修正與退款消失，隱藏/封存各自獨立", () => {
  assert.deepEqual(manageActionsFor(reg({ status: "ARCHIVED" })), [
    "hide",
    "unarchive",
  ]);
});

test("isHidden 為 null/undefined 時視為未隱藏（舊 BE 降級不誤判）", () => {
  for (const isHidden of [null, undefined]) {
    assert.deepEqual(manageActionsFor(reg({ isHidden })), [
      "correct",
      "refund",
      "hide",
      "archive",
    ]);
  }
});

test("四項可見性/封存動作都有反向；狀態修正與退款刻意沒有", () => {
  assert.deepEqual(REVERSE_ACTION, {
    hide: "unhide",
    unhide: "hide",
    archive: "unarchive",
    unarchive: "archive",
  });
  assert.equal(REVERSE_ACTION.correct, undefined);
  assert.equal(REVERSE_ACTION.refund, undefined);
});

/**
 * 「重寄確認信」的出現條件。
 *
 * Web 把它放在詳情抽屜（`RegistrationDetailDrawer.tsx:530`），App 收進管理面板。
 * 入口不同，但**條件必須相同**：狀態是 `NOT_REQUIRED` 且 outbox 查無成功投遞。
 * 條件放寬會讓操作員寄出後端必定回 `CONFIRMATION_EMAIL_NOT_APPLICABLE` 的信；
 * 條件收緊則讓真的沒寄到的人無處可救。
 */
function withEmailStatus(state, notifications = []) {
  return {
    state,
    claimEmail: { sentAt: null, error: null, hasActiveToken: false },
    claim: { claimedAt: null },
    notifications,
  };
}

test("確認信沒送出 ⇒ 管理面板出現「重寄確認信」", () => {
  const actions = manageActionsFor(
    reg({ emailStatus: withEmailStatus("NOT_REQUIRED") }),
  );
  assert.ok(actions.includes("resendConfirmation"), actions.join(","));
});

test("確認信已投遞 ⇒ 不提供重寄", () => {
  const actions = manageActionsFor(
    reg({
      emailStatus: withEmailStatus("NOT_REQUIRED", [
        {
          eventType: "X",
          status: "PROCESSED",
          attempts: 1,
          lastError: null,
          processedAt: null,
        },
      ]),
    }),
  );
  assert.equal(actions.includes("resendConfirmation"), false);
});

test("沒有 emailStatus（by-code 詳情或缺欄）⇒ 不提供重寄", () => {
  const actions = manageActionsFor(reg());
  assert.equal(actions.includes("resendConfirmation"), false);
});

test("重寄確認信排在可見性動作之前（寄信與改資料不是同一層級）", () => {
  const actions = manageActionsFor(
    reg({ emailStatus: withEmailStatus("NOT_REQUIRED") }),
  );
  const resend = actions.indexOf("resendConfirmation");
  const hide = actions.indexOf("hide");
  const archive = actions.indexOf("archive");
  assert.ok(resend >= 0 && hide >= 0 && archive >= 0, actions.join(","));
  assert.ok(resend < hide, `resend=${resend} hide=${hide}`);
  assert.ok(resend < archive, `resend=${resend} archive=${archive}`);
});

test("重寄確認信沒有 undo（outbox 已重置，沒有「取消重寄」這種端點）", () => {
  assert.equal(REVERSE_ACTION.resendConfirmation, undefined);
});
