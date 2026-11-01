/**
 * 寫卡後上鎖 — **行為**（`@/utils/nfc-lock-after-write`）＋ **接線**（`nfc-bind.tsx`）。
 *
 * ## 兩段為什麼要放在同一支
 *
 * 行為對了但沒接上，等於沒做；接上了但三態判錯，現場會丟掉可用的卡。兩者分開寫
 * 很容易只驗到一半（畫面檔在純 Node 下載不進來，只能掃原始碼），所以這裡把
 * 「純邏輯真的 import 進來跑」與「畫面的呼叫順序用原始碼釘住」放在一起。
 *
 * ## 畫面的原始碼掃描只驗**順序與傳遞**，不驗文案
 *
 * 文案的真相在 `copy.zh-TW.ts`（`copy-routing.test.mjs` 已守門），這裡只確認
 * 三個詞在那個 namespace 裡真的存在——少一個 key 會是 `undefined`，而
 * `undefined` 在 RN 的 `<Text>` 裡不會報錯，只會靜靜地空白。
 *
 * ## 原始碼斷言不再鎖排版（R6）
 *
 * 原本 `writeAndBind.includes("if (cardPassword) {")` 這種寫法鎖到的是**空白**：
 * prettier 一折行就假紅，而程式語意沒變。現在走
 * `support/source-assertions.mjs`，只忽略邊界字元與換行造成的空白差異；
 * 識別字之間的空白仍然有意義（見 helper 檔頭）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { copy } from "@/constants/copy.zh-TW";
import {
  authenticateBeforeWrite,
  generatePack,
  isLockablePassword,
  lockAfterWrite,
} from "@/utils/nfc-lock-after-write";

import { matchesIgnoringWhitespace as matches } from "./support/source-assertions.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SOURCE = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/nfc-bind.tsx"),
  "utf8",
);

const PASSWORD = Uint8Array.from([0x11, 0x22, 0x33, 0x44]);

/** 取出單一函式區塊；錨點不見了就讓測試自己說出來，不要靜默切出空字串。 */
function block(startAnchor, endAnchor) {
  const start = SOURCE.indexOf(startAnchor);
  assert.ok(start >= 0, `找不到 ${startAnchor}`);
  const end = SOURCE.indexOf(endAnchor, start);
  assert.ok(end > start, `找不到 ${endAnchor}（在 ${startAnchor} 之後）`);
  return SOURCE.slice(start, end);
}

describe("lockAfterWrite — 三態", () => {
  it("沒有密碼 ⇒ unlocked，且 lockCard 一次都沒被呼叫", async () => {
    let lockCalls = 0;
    const note = await lockAfterWrite({
      password: null,
      lockCard: async () => {
        lockCalls += 1;
      },
    });

    assert.equal(note, "unlocked");
    // 反例探針：若少了密碼前置檢查，這裡會是 1 —— 對一張沒有密碼的卡硬送
    // PWD_AUTH/WRITE 正是「把卡寫壞」的路徑之一。
    assert.equal(lockCalls, 0);
  });

  it("密碼長度不是 4 bytes ⇒ 也當沒有密碼", async () => {
    let lockCalls = 0;
    const note = await lockAfterWrite({
      password: Uint8Array.from([0x11, 0x22, 0x33]),
      lockCard: async () => {
        lockCalls += 1;
      },
    });

    assert.equal(note, "unlocked");
    assert.equal(lockCalls, 0);
  });

  it("有密碼且 lockCard 成功 ⇒ locked", async () => {
    const seen = [];
    const note = await lockAfterWrite({
      password: PASSWORD,
      lockCard: async (password) => {
        seen.push([...password]);
      },
    });

    assert.equal(note, "locked");
    // 傳進去的必須是同一組 bytes（傳錯一個 byte 就是另一支密碼）。
    assert.deepEqual(seen, [[0x11, 0x22, 0x33, 0x44]]);
  });

  it("有密碼但 lockCard 丟錯 ⇒ lock_failed，且不外拋", async () => {
    const note = await lockAfterWrite({
      password: PASSWORD,
      lockCard: async () => {
        throw new Error("page 133 (PWD) did not answer");
      },
    });

    // 內容已經在卡上；這裡回 lock_failed 就是「寫卡成功、沒有上鎖」。
    // 反例探針：若這一支改成往外拋，畫面會落到 error 分支，操作員會把一張
    // 內容正確的卡當成失敗卡丟掉。
    assert.equal(note, "lock_failed");
  });
});

describe("authenticateBeforeWrite — 探測，不是閘門", () => {
  it("沒有密碼 ⇒ 不呼叫 pwdAuth、回 false", async () => {
    let authCalls = 0;
    const ok = await authenticateBeforeWrite({
      password: null,
      pwdAuth: async () => {
        authCalls += 1;
      },
    });

    assert.equal(ok, false);
    assert.equal(authCalls, 0);
  });

  it("pwdAuth 丟錯 ⇒ 回 false 而不是拋（寫卡必須照樣進行）", async () => {
    const ok = await authenticateBeforeWrite({
      password: PASSWORD,
      pwdAuth: async () => {
        throw new Error("PWD_AUTH got no response");
      },
    });

    assert.equal(ok, false);
  });

  it("pwdAuth 成功 ⇒ true", async () => {
    const ok = await authenticateBeforeWrite({
      password: PASSWORD,
      pwdAuth: async () => ({ pack: Uint8Array.from([0xab, 0xcd]) }),
    });

    assert.equal(ok, true);
  });
});

describe("isLockablePassword / generatePack", () => {
  it("只接受 4 bytes", () => {
    assert.equal(isLockablePassword(PASSWORD), true);
    assert.equal(isLockablePassword(null), false);
    assert.equal(isLockablePassword(undefined), false);
    assert.equal(isLockablePassword(new Uint8Array(0)), false);
    assert.equal(isLockablePassword(new Uint8Array(8)), false);
  });

  it("PACK 是 2 bytes", () => {
    const pack = generatePack();
    assert.ok(pack instanceof Uint8Array);
    assert.equal(pack.length, 2);
  });
});

describe("nfc-bind.tsx — 接線", () => {
  const writeAndBind = block("const writeAndBind", "const cancelWrite");

  it("寫卡前先驗密碼，寫卡後才上鎖", () => {
    const authAt = writeAndBind.indexOf("authenticateBeforeWrite(");
    const writeAt = writeAndBind.indexOf("writeUriToCard(");
    const lockAt = writeAndBind.indexOf("lockAfterWrite(");

    assert.ok(authAt >= 0, "找不到 authenticateBeforeWrite 呼叫");
    assert.ok(writeAt >= 0, "找不到 writeUriToCard 呼叫");
    assert.ok(lockAt >= 0, "找不到 lockAfterWrite 呼叫");
    // 順序就是語意：驗 → 寫 → 鎖。把上鎖挪到寫之前會在一張空白卡上寫
    // PWD/ACCESS，之後才寫 NDEF——那條路徑沒有一處是驗過的。
    assert.ok(
      authAt < writeAt,
      "authenticateBeforeWrite 必須在 writeUriToCard 之前",
    );
    assert.ok(
      writeAt < lockAt,
      "lockAfterWrite 必須在 writeUriToCard 之後（上鎖只能在內容落地之後）",
    );
  });

  it("密碼拿不到不會擋住寫卡", () => {
    // 取得密碼走 `resolveCardPassword`（永不 throw），而驗證被 `if (cardPassword)`
    // 包住——沒有任何一條 `return` 或 `throw` 因為密碼的事提前結束流程。
    assert.ok(matches(writeAndBind, "resolveCardPassword(eventId)"));
    assert.ok(matches(writeAndBind, "if (cardPassword) {"));
    assert.ok(
      matches(writeAndBind, "await resolveCardPassword(eventId)"),
      "沒有 await 就會拿到 Promise，`if` 恆真",
    );
  });

  it("上鎖結果一路傳到成功卡（三態才有地方顯示）", () => {
    assert.ok(
      matches(
        writeAndBind,
        "await bindOnly(ctx, tagUid, writtenUri, lockNote)",
      ),
      "lockNote 沒有傳進 bindOnly ⇒ 成功卡永遠顯示不出上鎖結果",
    );
    const bindOnly = block("const bindOnly", "const writeAndBind");
    assert.ok(matches(bindOnly, "lockNote"));
  });

  it("三態各有專屬 UI 分支", () => {
    const done = block('state.phase === "done"', "</ScrollView>");
    for (const note of ["locked", "unlocked", "lock_failed"]) {
      assert.ok(
        matches(done, `state.lockNote === "${note}"`),
        `成功卡缺少 ${note} 的分支`,
      );
    }
  });
});

describe("copy.zh-TW — 上鎖文案", () => {
  it("三個詞的文案都在（少一個會靜靜地空白）", () => {
    for (const key of [
      "lockLocked",
      "lockUnlocked",
      "lockFailedTitle",
      "lockFailedConsequence",
    ]) {
      assert.equal(typeof copy.nfc[key], "string", `copy.nfc.${key} 不存在`);
      assert.ok(copy.nfc[key].length > 0, `copy.nfc.${key} 是空字串`);
    }
  });

  it("lock_failed 的文案說得出「已寫好」與後果", () => {
    assert.ok(copy.nfc.lockFailedTitle.includes("已寫好"));
    assert.ok(copy.nfc.lockFailedConsequence.includes("覆寫"));
    // 反例探針：把它寫成「失敗」就會讓操作員丟掉一張可用的卡。
    assert.ok(!copy.nfc.lockFailedTitle.includes("失敗"));
  });
});
