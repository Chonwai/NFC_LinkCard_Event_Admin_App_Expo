/**
 * J-WALKIN-REGISTER — 現場代填送出（gate → payload → 錯誤碼）。
 *
 * 層級：unit（Node 內建 test runner，純函式）。Persona：`staff-onsite`
 * （阿聰，已授權現場工作人員）。
 *
 * **已知界線（`20-remediation-and-test-plan.md` §10.1）**：AdminApp 沒有 jsdom／
 * React Native renderer，本檔只能覆蓋 walk-in 的**純邏輯**（守衛、payload、
 * 錯誤映射）。NFC 讀取、相機、導航、離線切換是 E2E-only 缺口。因此本檔**不得**
 * 被描述為「已覆蓋現場簽到流程」或「ADM 全鏈已驗證」。
 *
 * 命名依計畫 §5.3（RN1–RN5）：`describe` 第 1 段＝journey ID、第 3 段＝persona；
 * `it` 名稱同時寫出觸發條件與可觀察後果。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { copy } from "@/constants/copy.zh-TW";
import { mapWalkInError } from "@/utils/walk-in-error-map";
import { buildWalkInRegistrationBody } from "@/utils/walk-in-payload";
import {
  EVENT_CONSENT_TOS_VERSION,
  validateWalkInConsent,
} from "@/utils/walk-in-validation";

/** 造一個與 axios 同形的後端錯誤（`options.response.data.error.code`）。 */
function apiError(code, message) {
  return {
    response: {
      status: 400,
      data: { error: message === undefined ? { code } : { code, message } },
    },
  };
}

describe("J-WALKIN-REGISTER 現場代填送出 [persona:staff-onsite]", () => {
  it("given 票種與 email 已填且已勾同意, when 通過送出前守衛, then 回 ok", () => {
    assert.deepEqual(
      validateWalkInConsent({
        ticketId: "t1",
        email: "a@b.co",
        consent: true,
      }),
      { ok: true },
    );
  });

  it("given 未勾同意, when 通過送出前守衛, then 本地阻擋（walkInNeedConsent）", () => {
    assert.deepEqual(
      validateWalkInConsent({
        ticketId: "t1",
        email: "a@b.co",
        consent: false,
      }),
      { ok: false, key: "walkInNeedConsent" },
    );
  });

  it("given 票種與 email 皆空, when 通過送出前守衛, then 先報票種（守衛順序不可對調）", () => {
    assert.deepEqual(
      validateWalkInConsent({ ticketId: "", email: "", consent: true }),
      { ok: false, key: "walkInNeedTicket" },
    );
  });

  it("given email 前後有空白, when 通過送出前守衛, then 仍視為有效（不因空白擋人）", () => {
    assert.deepEqual(
      validateWalkInConsent({
        ticketId: "t1",
        email: "  a@b.co  ",
        consent: true,
      }),
      { ok: true },
    );
  });

  it("given ADM 與 FE／BE 共用的同意版本常數, when 讀取, then 為 event-tos-v1", () => {
    assert.equal(EVENT_CONSENT_TOS_VERSION, "event-tos-v1");
  });

  it("given 票種與 email 已填且已勾同意, when 組出送出 payload, then 帶 consent.tosVersion 與 ISO 的 privacyAcceptedAt", () => {
    const body = buildWalkInRegistrationBody({
      ticketId: "t1",
      email: "  a@b.co  ",
      firstName: " 阿 ",
      lastName: "",
      phone: "",
      company: "",
    });

    assert.equal(body.ticketTypeId, "t1");
    assert.equal(body.email, "a@b.co");
    assert.equal(body.firstName, "阿");
    assert.equal(body.consent.tosVersion, EVENT_CONSENT_TOS_VERSION);
    assert.match(body.consent.privacyAcceptedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(
      Number.isNaN(Date.parse(body.consent.privacyAcceptedAt)),
      false,
    );
  });

  it("given 選填欄位為空白, when 組出送出 payload, then 以 undefined 帶出（不送空字串）", () => {
    const body = buildWalkInRegistrationBody({
      ticketId: "t1",
      email: "a@b.co",
      firstName: "   ",
      lastName: "   ",
      phone: "   ",
      company: "   ",
    });

    assert.deepEqual(
      [body.firstName, body.lastName, body.phone, body.company],
      [undefined, undefined, undefined, undefined],
    );
    assert.equal("firstName" in body, true);
  });

  it("given 伺服器回 400 CONSENT_REQUIRED, when 映射錯誤, then 文案為「請先閱讀並同意條款」", () => {
    assert.equal(
      mapWalkInError(apiError("CONSENT_REQUIRED"), copy.checkIn.walkInFailed),
      copy.checkIn.walkInConsentRequired,
    );
  });

  it("given 伺服器回 400 CONSENT_VERSION_MISMATCH, when 映射錯誤, then 文案與 CONSENT_REQUIRED 可分辨", () => {
    const required = mapWalkInError(
      apiError("CONSENT_REQUIRED"),
      copy.checkIn.walkInFailed,
    );
    const mismatch = mapWalkInError(
      apiError("CONSENT_VERSION_MISMATCH"),
      copy.checkIn.walkInFailed,
    );

    assert.equal(mismatch, copy.checkIn.walkInConsentVersionMismatch);
    assert.notEqual(mismatch, required);
    // 兩者都不得落回泛用文案，否則現場分不出「還沒同意」與「條款改版」。
    assert.notEqual(mismatch, copy.checkIn.walkInFailed);
    assert.notEqual(required, copy.checkIn.walkInFailed);
  });

  it("given 伺服器回 EVENT_NOT_ACCEPTING_REGISTRATIONS, when 映射錯誤, then 維持既有專屬文案（不得被本次擴充蓋掉）", () => {
    assert.equal(
      mapWalkInError(
        apiError("EVENT_NOT_ACCEPTING_REGISTRATIONS"),
        copy.checkIn.walkInFailed,
      ),
      copy.checkIn.walkInNotAccepting,
    );
  });

  it(
    "given API 逾時後重按送出, when 佇列重新進入, then 不得產生第二筆報名（corner，探索後固化）",
    { todo: true },
    () => {},
  );
});
