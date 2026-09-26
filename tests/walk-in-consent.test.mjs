/**
 * ADM-02: walk-in consent 守衛順序（ticket → email → consent）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateWalkInConsent } from "@/utils/walk-in-validation";

test("合法且已同意 → ok", () => {
  assert.deepEqual(
    validateWalkInConsent({
      ticketId: "t1",
      email: "a@b.co",
      consent: true,
    }),
    { ok: true },
  );
});

test("未同意 → walkInNeedConsent", () => {
  assert.deepEqual(
    validateWalkInConsent({
      ticketId: "t1",
      email: "a@b.co",
      consent: false,
    }),
    { ok: false, key: "walkInNeedConsent" },
  );
});

test("缺票種優先於 consent", () => {
  assert.deepEqual(
    validateWalkInConsent({
      ticketId: "",
      email: "a@b.co",
      consent: false,
    }),
    { ok: false, key: "walkInNeedTicket" },
  );
});

test("email 無效優先於 consent", () => {
  assert.deepEqual(
    validateWalkInConsent({
      ticketId: "t1",
      email: "not-an-email",
      consent: false,
    }),
    { ok: false, key: "walkInNeedEmail" },
  );
});

test("email 前後空白仍合法", () => {
  assert.deepEqual(
    validateWalkInConsent({
      ticketId: "t1",
      email: "  a@b.co  ",
      consent: true,
    }),
    { ok: true },
  );
});
