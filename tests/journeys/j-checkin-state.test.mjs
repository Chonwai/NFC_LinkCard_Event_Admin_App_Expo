/**
 * J-CHECKIN-STATE — 現場簽到狀態機（成功／重複／無效／逾時＋越權）。
 *
 * 層級：unit（Node 內建 test runner；受測物是畫面唯一使用的純推導層）。
 * Persona：`staff-onsite`（阿聰，已授權現場工作人員）與
 * `volunteer-unauthorized`（阿明，已登入但**無** operator 角色）。
 *
 * **已知界線（`20-remediation-and-test-plan.md` §10.1）**：AdminApp 沒有 jsdom／
 * React Native renderer，`check-in.tsx` 的狀態機（`phase` 轉移、相機、掃碼）
 * **無法**在純 Node 下驅動。本檔覆蓋的是狀態機的**判定與文案推導**
 * ——`utils/check-in-errors`（錯誤 → 文案）與 `utils/check-in-display`
 * （結果 → 標題／第二行）是畫面唯一使用的來源——以及畫面層守衛的**接線**
 * （`[static]`，同 `walk-in-wiring.test.mjs` 的既有做法）。
 * 相機、掃碼、導航、離線切換為 E2E-only 缺口，列 `[UNVERIFIED]`。
 *
 * **不得**用本檔描述成「已覆蓋現場簽到流程」；正確描述是「已覆蓋簽到流程的
 * 狀態判定、錯誤映射與文案推導；相機／掃碼／離線切換為 E2E-only 已知缺口」。
 *
 * 命名依計畫 §5.3（`RN1`–`RN5`）：`describe` 第 1 段＝journey ID、第 3 段＝persona；
 * `it` 名稱同時寫出觸發條件與可觀察後果。`T-ACK-*` 前綴對應計畫 §4.3 的 test ID。
 *
 * **CHARACTERIZATION 範圍（`K32`／計畫 §7.4）**：本檔在受測實作已存在且綠之後撰寫，
 * 因此各條記載的是**現狀**（多數為規格已明文的現狀）。逐條登錄於
 * `docs/review/visitorflow-remediation-tdd-20260929/characterization-register-adm.md`；
 * 其中 `CHARACTERIZATION` 標記者（`T-ACK-S3b`）為未經 PM 裁決的疑似缺口，只鎖現狀。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { LOOKUP_TIMEOUT_MS } from "@/constants/config";
import { copy } from "@/constants/copy.zh-TW";
import {
  getCheckInOutcomeDetail,
  getCheckInOutcomeHeadline,
} from "@/utils/check-in-display";
import { resolveCheckInErrorMessage } from "@/utils/check-in-errors";
import {
  isAlreadyCheckedIn,
  isRegistrationNotCheckInEligible,
} from "@/utils/registration-display";

// `tests/journeys/` 在 repo 根之下兩層（`tests/*.test.mjs` 只差一層，不可照抄）。
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const CHECK_IN_SCREEN = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/check-in.tsx"),
  "utf8",
);

const CODE = "LC-0001";

/** 造一個與 axios 同形的後端錯誤（`options.response.data.error.{code,message}`）。 */
function apiError(status, code, message) {
  return { response: { status, data: { error: { code, message } } } };
}

/** 造一筆只有本 journey 關心的欄位的報名。 */
function registration(status, checkedInAt = null) {
  return { status, checkedInAt, registrationCode: CODE };
}

describe("J-CHECKIN-STATE 現場簽到狀態機 [persona:staff-onsite]", () => {
  it("T-ACK-H1 given 憑證有效且尚未簽到, when 完成簽到, then 標題為「報到成功」且第二行不重複（成功態只有一行）", () => {
    const reg = registration("CONFIRMED");
    assert.equal(isAlreadyCheckedIn(reg), false);
    assert.equal(isRegistrationNotCheckInEligible(reg), false);

    assert.equal(
      getCheckInOutcomeHeadline("valid"),
      copy.checkIn.validHeadline,
    );
    // 成功態的第二行與標題逐字相同 ⇒ 畫面不得渲染出重複的一行。
    assert.equal(
      getCheckInOutcomeDetail({
        kind: "valid",
        code: CODE,
        message: copy.checkIn.checkedIn,
      }),
      null,
    );

    // 三態標題互異：同一張卡不得同時看起來像兩種結果。
    const headlines = new Set([
      getCheckInOutcomeHeadline("valid"),
      getCheckInOutcomeHeadline("duplicate"),
      getCheckInOutcomeHeadline("invalid"),
    ]);
    assert.equal(headlines.size, 3);
  });

  it("T-ACK-S1 given 這筆報名已經簽到過, when 再掃同一張碼, then 進入重複態且文案為「已報到過」而非成功", () => {
    const reg = registration("CHECKED_IN", "2026-09-29T01:00:00.000Z");
    assert.equal(isAlreadyCheckedIn(reg), true);
    assert.equal(
      getCheckInOutcomeHeadline("duplicate"),
      copy.checkIn.duplicateHeadline,
    );

    // 重複態的兩個來源（查詢時就已簽到、送出時後端回 409）必須給同一句話，
    // 否則現場會依「哪一步擋下來」看到不同說法。
    assert.equal(
      resolveCheckInErrorMessage(apiError(409, "ALREADY_CHECKED_IN")),
      copy.checkIn.alreadyCheckedIn,
    );
    assert.equal(
      getCheckInOutcomeDetail({
        kind: "duplicate",
        code: CODE,
        message: copy.checkIn.alreadyCheckedIn,
      }),
      copy.checkIn.alreadyCheckedIn,
    );
    assert.notEqual(
      copy.checkIn.alreadyCheckedIn,
      getCheckInOutcomeHeadline("duplicate"),
    );
    assert.notEqual(copy.checkIn.alreadyCheckedIn, copy.checkIn.checkedIn);
  });

  it("T-ACK-S2 given 碼無法簽到（查不到／狀態不可簽到）, when 解析失敗, then 走無效態且兩種成因的第二行互異", () => {
    const notFound = resolveCheckInErrorMessage(
      apiError(404, "REGISTRATION_NOT_FOUND"),
    );
    const notConfirmed = copy.checkIn.notConfirmed;
    const notEligible = registration("PENDING_PAYMENT");

    assert.equal(notFound, copy.checkIn.registrationNotFound);
    assert.equal(isRegistrationNotCheckInEligible(notEligible), true);
    assert.equal(isAlreadyCheckedIn(notEligible), false);

    assert.equal(
      getCheckInOutcomeHeadline("invalid"),
      copy.checkIn.invalidHeadline,
    );
    // 兩種成因都走無效態，但第二行必須分得出來。
    assert.notEqual(notFound, notConfirmed);
    assert.notEqual(
      getCheckInOutcomeDetail({
        kind: "invalid",
        code: CODE,
        message: notFound,
      }),
      getCheckInOutcomeDetail({
        kind: "invalid",
        code: CODE,
        message: notConfirmed,
      }),
    );
    // 且都不得與成功／重複／網路三態混用。
    assert.notEqual(notFound, copy.checkIn.checkedIn);
    assert.notEqual(notFound, copy.checkIn.networkError);
    assert.notEqual(notFound, copy.checkIn.alreadyCheckedIn);
  });

  it("T-ACK-E1 [static] given 掃碼回空字串或只有空白, when 進入查詢入口, then 不發出查詢（守衛在查詢之前）", () => {
    const guard = CHECK_IN_SCREEN.search(
      /if \(!eventId \|\| !rawCode\.trim\(\)\) return;/,
    );
    const lookup = CHECK_IN_SCREEN.indexOf("registrationService.getByCode(");

    assert.ok(guard >= 0, "找不到空字串守衛");
    assert.ok(lookup >= 0, "找不到查詢呼叫");
    assert.ok(guard < lookup, "守衛必須在查詢之前，否則空碼也會打後端");
  });

  it("T-ACK-E1b [static] given 同一個 tick 內連續兩次掃碼事件, when 第二次進入, then 門閂已關（不得重複查詢與重複簽到）", () => {
    const set = CHECK_IN_SCREEN.indexOf("scanInFlight.current = true;");
    const release = CHECK_IN_SCREEN.indexOf("scanInFlight.current = false;");

    assert.ok(set >= 0, "找不到門閂的設定點");
    assert.ok(release >= 0, "找不到門閂的釋放點");
    assert.ok(set < release, "釋放點必須在設定點之後");
    // 唯一釋放點必須是 finally，否則任何提前 return 都會讓掃碼永久卡住。
    assert.match(
      CHECK_IN_SCREEN.slice(set, release),
      /\.finally\(\(\) => \{/,
      "門閂必須在 finally 中釋放",
    );
  });

  it("T-ACK-E2 given 查詢在 LOOKUP_TIMEOUT_MS 內沒有回應, when 連線以逾時收尾, then 第二行是「網路連線異常」而非「找不到此報名」", () => {
    assert.equal(typeof LOOKUP_TIMEOUT_MS, "number");
    assert.ok(
      LOOKUP_TIMEOUT_MS <= 3000,
      `查詢逾時必須 ≤ 3000 ms，實測 ${LOOKUP_TIMEOUT_MS}`,
    );

    // EP：逾時在 axios 下有兩個等價類（ECONNABORTED 自帶、ETIMEDOUT 由 Node 拋），
    // 兩者都不得落到「這張票不存在」。
    for (const code of ["ECONNABORTED", "ETIMEDOUT"]) {
      assert.equal(
        resolveCheckInErrorMessage({
          code,
          message: `timeout of ${LOOKUP_TIMEOUT_MS}ms exceeded`,
        }),
        copy.checkIn.networkError,
        `${code} 必須落到網路文案`,
      );
    }

    assert.notEqual(
      copy.checkIn.networkError,
      copy.checkIn.registrationNotFound,
    );
    assert.notEqual(copy.checkIn.networkError, copy.checkIn.serverError);
  });

  it(
    "T-ACK-C1 應然: 現場斷網後恢復連線時的離線切換行為（E2E-only，探索後固化）",
    {
      todo: true,
    },
  );
});

describe("J-CHECKIN-STATE 現場簽到狀態機 [persona:volunteer-unauthorized]", () => {
  it("T-ACK-S3 given 已登入但沒有 operator 角色, when 後端回 403 INSUFFICIENT_PERMISSION, then 第二行是「權限不足」而非「找不到此報名」", () => {
    const denied = resolveCheckInErrorMessage(
      apiError(403, "INSUFFICIENT_PERMISSION"),
    );

    assert.equal(denied, copy.checkIn.notEnoughPermission);
    assert.notEqual(denied, copy.checkIn.registrationNotFound);
    assert.equal(
      getCheckInOutcomeHeadline("invalid"),
      copy.checkIn.invalidHeadline,
    );
  });

  it("T-ACK-S3b CHARACTERIZATION given 後端只回 403 而沒有錯誤碼, when 解析失敗, then 現狀文案是「找不到此報名」（未經 PM 裁決，鎖住現狀）", () => {
    // CHARACTERIZATION（`G4`）：403＝「你的角色不能做這件事」，但畫面對
    // 「沒有錯誤碼的 403」給的是「找不到此報名」。哪一種才是應然（把無碼 403
    // 一律當權限問題，或維持現狀）**沒有書面裁決**，且屬 `[NEEDS-PM]` 語意，
    // 依任務書不得由執行者自行決定 ⇒ 只鎖現狀並在報告揭露（見 §3）。
    assert.equal(
      resolveCheckInErrorMessage({ response: { status: 403, data: {} } }),
      copy.checkIn.registrationNotFound,
    );
  });
});
