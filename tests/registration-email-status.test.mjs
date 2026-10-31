/**
 * 報名 email 狀態的**呈現規則**鎖定。
 *
 * 這些規則先前不存在：名單列的「Email 狀態」欄在 App 是空白，因為
 * `Registration` 型別沒有這個欄位。補上型別之後，真正需要釘住的不是型別，
 * 而是三條會說謊的規則：
 *
 * 1. **`null`／缺失 ≠ 任何一種狀態**。BE 合法地回 `null`（湊不出狀態），
 *    把它畫成「未寄出」會讓操作員去重寄一封其實已經寄出的信。
 * 2. **色調必須與 Web 逐字一致**。同一個狀態在兩個端上給不同顏色，操作者會
 *    以為看到的是兩件事。
 * 3. **錯誤摘要的取用順序**（claim 信 → outbox 通知），缺一不可。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  ACTIONABLE_EMAIL_STATES,
  countActionable,
  emailStatusDetail,
  emailStatusLabel,
  emailStatusTone,
  hasNotificationDeliveryIssue,
  isConfirmationNotDelivered,
  matchesEmailStatusFilter,
} = await import("@/utils/registration-email-status");
const { copy } = await import("@/constants/copy.zh-TW");

/** 最小可用狀態；只帶規則會讀的欄位。 */
function status(state, overrides = {}) {
  return {
    state,
    claimEmail: { sentAt: null, error: null, hasActiveToken: false },
    claim: { claimedAt: null },
    notifications: [],
    ...overrides,
  };
}

test("七態各自有中文標籤，且與 Web zh-Hant 文案逐字相同", () => {
  const expected = {
    AWAITING_PAYMENT: "待付款",
    NO_ACCOUNT: "無帳號",
    CLAIMED: "已領取",
    NOT_REQUIRED: "免啟用",
    SEND_FAILED: "寄送失敗",
    SENT_NOT_OPENED: "已寄出未領取",
    NOT_SENT: "未寄出",
  };
  for (const [state, label] of Object.entries(expected)) {
    assert.equal(emailStatusLabel(status(state)), label, state);
  }
});

test("emailStatus 缺失或 null ⇒ 「未知」，不是任何一種狀態", () => {
  assert.equal(emailStatusLabel(undefined), copy.roster.emailStatus.unknown);
  assert.equal(emailStatusLabel(null), copy.roster.emailStatus.unknown);
  assert.equal(copy.roster.emailStatus.unknown, "未知");
});

test("未知的 state 字串原樣顯示，不被吞成舊標籤", () => {
  // 後端新增第八態時，App 應該看得見那個新值，而不是把它顯示成「未寄出」。
  assert.equal(emailStatusLabel(status("SOMETHING_NEW")), "SOMETHING_NEW");
});

test("色調與 Web emailStatusTone 逐字對齊", () => {
  const expected = {
    CLAIMED: "success",
    SENT_NOT_OPENED: "info",
    NOT_REQUIRED: "neutral",
    AWAITING_PAYMENT: "neutral",
    SEND_FAILED: "danger",
    NOT_SENT: "warning",
    NO_ACCOUNT: "warning",
  };
  for (const [state, tone] of Object.entries(expected)) {
    assert.equal(emailStatusTone(state), tone, state);
  }
});

test("未知 state 落回 neutral，不誤用 danger／success", () => {
  assert.equal(emailStatusTone("SOMETHING_NEW"), "neutral");
});

test("錯誤摘要先取 claim 信錯誤，其次取 outbox 的 lastError", () => {
  assert.equal(
    emailStatusDetail(
      status("SEND_FAILED", {
        claimEmail: {
          sentAt: null,
          error: "claim boom",
          hasActiveToken: false,
        },
        notifications: [
          {
            eventType: "X",
            status: "FAILED",
            attempts: 3,
            lastError: "outbox boom",
            processedAt: null,
          },
        ],
      }),
    ),
    "claim boom",
  );
  assert.equal(
    emailStatusDetail(
      status("SEND_FAILED", {
        notifications: [
          {
            eventType: "X",
            status: "PROCESSED",
            attempts: 1,
            lastError: null,
            processedAt: null,
          },
          {
            eventType: "Y",
            status: "FAILED",
            attempts: 3,
            lastError: "outbox boom",
            processedAt: null,
          },
        ],
      }),
    ),
    "outbox boom",
  );
});

test("沒有任何錯誤 ⇒ null（不是空字串），呼叫端才分得出兩者", () => {
  assert.equal(emailStatusDetail(status("CLAIMED")), null);
  assert.equal(emailStatusDetail(null), null);
  assert.equal(emailStatusDetail(undefined), null);
});

/**
 * `isConfirmationNotDelivered` —— 決定「重寄確認信」是否出現在管理面板。
 *
 * 這條述詞逐字鏡射 Web `RegistrationDetailDrawer.tsx:133-139`。兩邊若算出不同
 * 答案，同一筆報名在網頁上能重寄、在 App 上不能（或反過來），操作者只會以為
 * App 壞了。
 */
test("確認信未送出：NOT_REQUIRED + 完全沒有 outbox 意圖列", () => {
  assert.equal(isConfirmationNotDelivered(status("NOT_REQUIRED")), true);
});

test("確認信未送出：NOT_REQUIRED + 有 FAILED 列", () => {
  assert.equal(
    isConfirmationNotDelivered(
      status("NOT_REQUIRED", {
        notifications: [
          {
            eventType: "X",
            status: "PROCESSED",
            attempts: 1,
            lastError: null,
            processedAt: null,
          },
          {
            eventType: "Y",
            status: "FAILED",
            attempts: 5,
            lastError: "boom",
            processedAt: null,
          },
        ],
      }),
    ),
    true,
  );
});

test("PENDING 不算失敗：relay 每 5 分鐘才跑，剛排入的列本來就該是 PENDING", () => {
  assert.equal(
    isConfirmationNotDelivered(
      status("NOT_REQUIRED", {
        notifications: [
          {
            eventType: "X",
            status: "PENDING",
            attempts: 0,
            lastError: null,
            processedAt: null,
          },
        ],
      }),
    ),
    false,
  );
});

test("已成功投遞（PROCESSED）⇒ 不提供重寄", () => {
  assert.equal(
    isConfirmationNotDelivered(
      status("NOT_REQUIRED", {
        notifications: [
          {
            eventType: "X",
            status: "PROCESSED",
            attempts: 1,
            lastError: null,
            processedAt: null,
          },
        ],
      }),
    ),
    false,
  );
});

test("非 NOT_REQUIRED 的狀態一律不提供（那條路走的是領取信）", () => {
  for (const state of [
    "AWAITING_PAYMENT",
    "NO_ACCOUNT",
    "CLAIMED",
    "SEND_FAILED",
    "SENT_NOT_OPENED",
    "NOT_SENT",
  ]) {
    assert.equal(isConfirmationNotDelivered(status(state)), false, state);
  }
});

test("emailStatus 缺失 ⇒ 不提供（不能對「不知道」的狀態寄信）", () => {
  assert.equal(isConfirmationNotDelivered(null), false);
  assert.equal(isConfirmationNotDelivered(undefined), false);
});

/* ────────────────────────────────────────────────────────────────────────
 * Email 狀態篩選（client-side，作用於已載入的列）
 *
 * 這四條規則要釘住的不是「有篩」，而是**篩錯邊**的三種說謊方式：
 * 1. `all` 之外，`null` 狀態一律不得通過——「不知道」不能被算成任何一類。
 * 2. 「寄送失敗」不能只認 `state === SEND_FAILED`：outbox 通知 `FAILED`
 *    （確認信沒送出）時，state 可能仍是 `NOT_REQUIRED`。
 * 3. `PENDING` 且 `attempts === 0` **不算**失敗——剛排入佇列本來就該是
 *    `PENDING`，把它算進去會讓「寄送失敗」永遠有假陽性。
 * ──────────────────────────────────────────────────────────────────────── */

test("待處理三態與 BE `ACTIONABLE_EMAIL_STATES` 逐字對齊", () => {
  assert.deepEqual([...ACTIONABLE_EMAIL_STATES].sort(), [
    "NOT_SENT",
    "NO_ACCOUNT",
    "SEND_FAILED",
  ]);
});

test("`all` 放行每一種狀態，包含 `null`（不篩就是真的不篩）", () => {
  assert.equal(matchesEmailStatusFilter(null, "all"), true);
  assert.equal(matchesEmailStatusFilter(undefined, "all"), true);
  for (const state of [
    "AWAITING_PAYMENT",
    "NO_ACCOUNT",
    "CLAIMED",
    "NOT_REQUIRED",
    "SEND_FAILED",
    "SENT_NOT_OPENED",
    "NOT_SENT",
  ]) {
    assert.equal(matchesEmailStatusFilter(status(state), "all"), true, state);
  }
});

test("`all` 以外，`null`／缺失一律不通過（「不知道」不是任何一類）", () => {
  for (const filter of ["actionable", "claimed", "failed"]) {
    assert.equal(matchesEmailStatusFilter(null, filter), false, filter);
    assert.equal(matchesEmailStatusFilter(undefined, filter), false, filter);
  }
});

test("`actionable` 只收三態；`claimed` 只收 CLAIMED", () => {
  for (const state of [
    "AWAITING_PAYMENT",
    "CLAIMED",
    "NOT_REQUIRED",
    "SENT_NOT_OPENED",
  ]) {
    assert.equal(
      matchesEmailStatusFilter(status(state), "actionable"),
      false,
      state,
    );
  }
  for (const state of ["NO_ACCOUNT", "NOT_SENT", "SEND_FAILED"]) {
    assert.equal(
      matchesEmailStatusFilter(status(state), "actionable"),
      true,
      state,
    );
  }

  assert.equal(matchesEmailStatusFilter(status("CLAIMED"), "claimed"), true);
  for (const state of [
    "AWAITING_PAYMENT",
    "NO_ACCOUNT",
    "NOT_REQUIRED",
    "SEND_FAILED",
    "SENT_NOT_OPENED",
    "NOT_SENT",
  ]) {
    assert.equal(
      matchesEmailStatusFilter(status(state), "claimed"),
      false,
      state,
    );
  }
});

test("`failed` 也收 outbox 通知 FAILED 的列（state 可能仍是 NOT_REQUIRED）", () => {
  const confirmationFailed = status("NOT_REQUIRED", {
    notifications: [
      {
        eventType: "REGISTRATION_CONFIRMED",
        status: "FAILED",
        attempts: 5,
        lastError: "550 mailbox unavailable",
        processedAt: null,
      },
    ],
  });
  assert.equal(matchesEmailStatusFilter(confirmationFailed, "failed"), true);
  assert.equal(hasNotificationDeliveryIssue(confirmationFailed), true);

  // 反面：`PENDING` 且尚未重試過 ⇒ 不算失敗。
  const queued = status("NOT_REQUIRED", {
    notifications: [
      {
        eventType: "REGISTRATION_CONFIRMED",
        status: "PENDING",
        attempts: 0,
        lastError: null,
        processedAt: null,
      },
    ],
  });
  assert.equal(matchesEmailStatusFilter(queued, "failed"), false);
  assert.equal(hasNotificationDeliveryIssue(queued), false);

  // 曾失敗、重試中（attempts > 0）⇒ 算進「寄送失敗」，值得操作員看一眼。
  const retrying = status("NOT_REQUIRED", {
    notifications: [
      {
        eventType: "REGISTRATION_CONFIRMED",
        status: "PENDING",
        attempts: 2,
        lastError: "timeout",
        processedAt: null,
      },
    ],
  });
  assert.equal(matchesEmailStatusFilter(retrying, "failed"), true);
});

test("`countActionable` 只數三態，且跳過沒有 emailStatus 的列", () => {
  assert.equal(
    countActionable([
      { emailStatus: status("NO_ACCOUNT") },
      { emailStatus: status("SEND_FAILED") },
      { emailStatus: status("NOT_SENT") },
      { emailStatus: status("CLAIMED") },
      { emailStatus: status("SENT_NOT_OPENED") },
      { emailStatus: null },
      {},
    ]),
    3,
  );
  assert.equal(countActionable([]), 0);
});
