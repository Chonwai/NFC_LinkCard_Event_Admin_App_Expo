/**
 * `INC-2`（Loop AF，2026-10-05）：報到成功態「停得住」——
 * 15 秒常數化 ＋ 顯式「繼續掃碼」出口 ＋ checkIn/by-code 的 profileUrl 合併。
 *
 * 為什麼需要這一支：現場回報成功態 3 秒就跳回掃描，六列資訊讀不完、主 CTA
 * 來不及按；`check-in.tsx` 的計時器是畫面層行為（AdminApp 無 jsdom／RN
 * renderer 可驅動），因此以兩層鎖住：
 * 1) 行為層——常數值、`mergeCheckInProfileUrl` 三態（undefined→by-code 補位、
 *    null→null、有值→自身）直接在 Node 下執行（沿用 `desk-handoff.ts` 的
 *    「純邏輯下沉」慣例）。
 * 2) 接線層——原始碼切片鎖定「畫面接了常數、valid 態有 continueScan 按鈕、
 *    寫卡 CTA 先清計時器」（同 `check-in-write-handoff.test.mjs` 的既有做法）。
 *
 * 反例探針（RED→GREEN，實測見 `03-execute-loop-af.md`）：
 * - 把 `CHECK_IN_AUTO_RESET_MS` 改回 3000 ⇒ 第 1 條必紅。
 * - 拿掉 valid 態的 `continueScan` 按鈕 ⇒ 第 2 條必紅。
 * - 把畫面改回 `checked.registration ?? registration`（不合併欄位）⇒ 第 3 條必紅。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CHECK_IN_AUTO_RESET_MS } from "@/constants/config";
import { copy } from "@/constants/copy.zh-TW";
import { mergeCheckInProfileUrl } from "@/utils/desk-handoff";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CHECK_IN = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/check-in.tsx"),
  "utf8",
);

test("INC-2：自動返回等待＝15 秒常數，計時器不得寫死（3000 回歸）", () => {
  assert.equal(
    CHECK_IN_AUTO_RESET_MS,
    15000,
    `現場等待必須是 15 秒，實測 ${CHECK_IN_AUTO_RESET_MS}`,
  );
  assert.match(
    CHECK_IN,
    /playCheckInFeedback/,
    "受測檔切片失效（找不到既有符號，可能讀錯檔）",
  );
  assert.match(
    CHECK_IN,
    /import \{ CHECK_IN_AUTO_RESET_MS \} from "@\/constants\/config";/,
    "畫面沒有 import 常數",
  );
  assert.match(
    CHECK_IN,
    /setTimeout\(\(\) => \{\s*resetToIdle\(\);\s*\}, CHECK_IN_AUTO_RESET_MS\)/,
    "成功態計時器沒有接上常數",
  );
  assert.equal(
    /}, 3000\);/.test(CHECK_IN),
    false,
    "計時器又寫死 3000ms ⇒ 現場讀不完、按不到（INC-2 回歸）",
  );
});

test("INC-2：success 態有顯式「繼續掃碼」出口，寫卡 CTA 先清計時器", () => {
  const validStart = CHECK_IN.indexOf('outcome.kind === "valid" ? (');
  assert.ok(validStart >= 0, "找不到 valid 態區塊（切片端點失效會讓本條空轉）");
  const validEnd = CHECK_IN.indexOf("</View>", validStart);
  assert.ok(validEnd > validStart, "找不到 valid 態區塊的收尾");
  const validBlock = CHECK_IN.slice(validStart, validEnd);

  assert.match(
    validBlock,
    /label=\{copy\.checkIn\.continueScan\}/,
    "成功態沒有「繼續掃碼」按鈕（操作者只能等計時器）",
  );
  assert.match(
    validBlock,
    /onPress=\{resetToIdle\}/,
    "「繼續掃碼」沒有接上 resetToIdle",
  );
  assert.match(
    validBlock,
    /copy\.checkIn\.autoResetHint\(CHECK_IN_AUTO_RESET_MS \/ 1000\)/,
    "計時提示沒有帶秒數",
  );
  assert.equal(
    /autoResetIn/.test(CHECK_IN),
    false,
    "舊鍵 autoResetIn 仍在畫面上（本輪已改為 autoResetHint）",
  );

  const ctaStart = CHECK_IN.indexOf("label={copy.checkIn.gotoWriteCard}");
  assert.ok(ctaStart >= 0, "找不到寫卡 CTA");
  const ctaBlock = CHECK_IN.slice(ctaStart, ctaStart + 420);
  assert.match(
    ctaBlock,
    /clearResetTimer\(\);/,
    "寫卡 CTA 未先清計時器（導航殘留 timer 會把下一張碼拉回）",
  );

  // 文案鍵：函式帶秒數、名片列新語義（PIN 於 check-in-write-handoff 之外再鎖一次值）
  assert.equal(typeof copy.checkIn.autoResetHint, "function");
  assert.match(copy.checkIn.autoResetHint(15), /15 秒/);
  assert.equal(copy.checkIn.profileLabel, "名片");
  assert.equal(copy.checkIn.noPublicProfile, "（名片尚未就緒；仍可寫卡）");
});

test("INC-2：checkIn/by-code 合併三態——undefined 補位、null 維持、有值自身", () => {
  // staging（舊 BE）：checkIn 缺 profileUrl ⇒ 用同掃描的 by-code 補位，
  // 「有 profile 的人」不再被誤顯為名片未就緒。
  assert.equal(mergeCheckInProfileUrl(undefined, "/p/abc"), "/p/abc");
  // 兩源一致的真實空值：維持 null（未知 ≠ 空字串）。
  assert.equal(mergeCheckInProfileUrl(null, null), null);
  // checkIn 有值時以它為準（by-code 不覆蓋新回應）。
  assert.equal(mergeCheckInProfileUrl("/p/self", "/p/fallback"), "/p/self");
  // 畫面真的有用它（合併若被拔掉，本條的單元綠燈也不代表接線存在）。
  assert.match(CHECK_IN, /mergeCheckInProfileUrl\(/);
});
