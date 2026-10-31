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

const { emailStatusDetail, emailStatusLabel, emailStatusTone } =
  await import("@/utils/registration-email-status");
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
