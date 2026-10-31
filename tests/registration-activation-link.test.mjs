/**
 * 啟用連結：**簽發**與**唯讀探針**不可互換。
 *
 * 這兩條路徑長得一樣，只差一個 query。寫錯不會有任何型別錯誤，卻會造成兩個
 * 方向的災難：
 *
 * - 唯讀路徑少了 `readonly=1` ⇒ 批次寄送面板開一次，就把整頁待 claim 的人
 *   變成「已有有效連結」，預設收件人歸零（`AA-F-01`）。
 * - 簽發路徑多了 `readonly=1` ⇒ 按了「簽發」什麼都不會發生，操作員拿不到
 *   連結，卻以為拿到了。
 *
 * 所以這裡不測「有沒有呼叫」，只測**那一個 query 字串**：誰帶了什麼、沒帶什麼。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 url 都記在這裡。 */
const calls = [];

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push(url);
        return {
          data: {
            data: {
              email: "a@b.c",
              firstName: "Ann",
              lastName: "Lee",
              isActivated: false,
              userId: "user-1",
              activationToken: "tok",
              activationUrl: "/events/activation/claim?token=tok",
              issued: false,
            },
          },
        };
      },
      post: async (url) => {
        calls.push(url);
        return { data: { data: {} } };
      },
    },
  },
});

const { registrationService } = await import("@/services/registration.service");
const {
  absoluteActivationUrl,
  canIssueActivation,
  classifyIssueError,
  describeIssueResult,
} = await import("@/utils/registration-activation");

test("唯讀探針**一定**帶 readonly=1，且**不得**帶 issue", async () => {
  calls.length = 0;
  await registrationService.getActivationLinkStatus("evt-1", "reg-1");

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0],
    "/api/v1/events/evt-1/registrations/reg-1/activation-link?readonly=1",
  );
  assert.ok(calls[0].includes("readonly=1"), "唯讀探針必須帶 readonly=1");
  assert.ok(
    !calls[0].includes("issue"),
    "唯讀探針不得帶 issue——那會讓它變成簽發",
  );
});

test("簽發**一定**帶 issue=1，且**不得**帶 readonly", async () => {
  calls.length = 0;
  await registrationService.issueActivationLink("evt-1", "reg-1");

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0],
    "/api/v1/events/evt-1/registrations/reg-1/activation-link?issue=1",
  );
  assert.ok(calls[0].includes("issue=1"), "簽發必須帶 issue=1");
  assert.ok(
    !calls[0].includes("readonly"),
    "簽發路徑不得帶 readonly——帶了就什麼都不會發生",
  );
});

test("兩條路徑只差 query：路由本身必須是同一個", async () => {
  calls.length = 0;
  await registrationService.getActivationLinkStatus("evt-1", "reg-1");
  await registrationService.issueActivationLink("evt-1", "reg-1");

  const [probe, issue] = calls;
  assert.equal(probe.split("?")[0], issue.split("?")[0]);
});

test("只有「有帳號且未啟用」才能簽發（與 BE 簽發分支同一條判定）", () => {
  const base = {
    email: "a@b.c",
    firstName: "Ann",
    lastName: "Lee",
    activationToken: null,
    activationUrl: null,
  };
  assert.equal(
    canIssueActivation({ ...base, isActivated: false, userId: "u-1" }),
    true,
  );
  assert.equal(
    canIssueActivation({ ...base, isActivated: true, userId: "u-1" }),
    false,
    "已啟用不需要連結",
  );
  assert.equal(
    canIssueActivation({ ...base, isActivated: false, userId: null }),
    false,
    "沒有帳號就沒有對象可以綁 token",
  );
  assert.equal(canIssueActivation(null), false);
  assert.equal(canIssueActivation(undefined), false);
});

test("絕對 URL：相對路徑補上前台 origin，已是絕對值則原樣保留", () => {
  const info = {
    email: "a@b.c",
    firstName: "Ann",
    lastName: "Lee",
    isActivated: false,
    userId: "u-1",
    activationToken: "tok",
  };
  const relative = absoluteActivationUrl({
    ...info,
    activationUrl: "/events/activation/claim?token=tok",
  });
  assert.ok(relative.startsWith("https://"), relative);
  assert.ok(relative.endsWith("/events/activation/claim?token=tok"), relative);

  const absolute = absoluteActivationUrl({
    ...info,
    activationUrl: "https://example.com/claim?token=tok",
  });
  assert.equal(absolute, "https://example.com/claim?token=tok");

  assert.equal(absoluteActivationUrl({ ...info, activationUrl: null }), null);
  assert.equal(absoluteActivationUrl(null), null);
});

test("簽發結果分類：先看有沒有 url，再看是不是這次鑄的", () => {
  const info = {
    email: "a@b.c",
    firstName: "Ann",
    lastName: "Lee",
    userId: "u-1",
    activationToken: "tok",
    activationUrl: "/events/activation/claim?token=tok",
  };
  assert.equal(
    describeIssueResult({ ...info, isActivated: false, issued: true }),
    "issued",
  );
  assert.equal(
    describeIssueResult({ ...info, isActivated: false, issued: false }),
    "reused",
    "issued=false 且 url 有值＝沿用既有 token，不是新鑄的",
  );
  assert.equal(
    describeIssueResult({ ...info, isActivated: true, issued: false }),
    "already_active",
  );
  assert.equal(
    describeIssueResult({
      ...info,
      isActivated: false,
      userId: null,
      issued: false,
    }),
    "no_account",
  );
  assert.equal(
    describeIssueResult({
      ...info,
      isActivated: false,
      activationUrl: null,
      issued: false,
    }),
    "empty",
  );
});

test("錯誤分類只看 code / status（不回顯後端 message）", () => {
  const withError = (status, code) => ({
    response: { status, data: { error: { code, message: "內部路徑 /var/x" } } },
  });
  assert.equal(
    classifyIssueError(withError(409, "TOKEN_ALREADY_CLAIMED")),
    "claimed",
  );
  assert.equal(
    classifyIssueError(withError(403, "INSUFFICIENT_PERMISSION")),
    "forbidden",
  );
  assert.equal(
    classifyIssueError(withError(404, "REGISTRATION_NOT_FOUND")),
    "not_found",
  );
  assert.equal(classifyIssueError(withError(500, "SOMETHING_ELSE")), "failed");
  assert.equal(classifyIssueError(new Error("boom")), "failed");
});
