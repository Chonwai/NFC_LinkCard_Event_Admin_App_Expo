"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyReaderName,
  classifyReaders,
  verdictFor,
} = require("../src/reader-model");

test("recognises the ACR1252 on both name shapes macOS has been seen to report", () => {
  for (const name of [
    "ACS ACR1252U PICC Reader",
    "ACS ACR1252 1S CL Reader PICC",
  ]) {
    const result = classifyReaderName(name);
    assert.equal(result.familyId, "acs-acr1252u", name);
    assert.equal(result.vendor, "Advanced Card Systems (ACS)");
    assert.equal(result.confidence, "high");
    assert.equal(result.isContactlessInterface, true);
  }
});

test("normalises casing and collapsed whitespace before matching", () => {
  const result = classifyReaderName("  acs   acr1252u   picc   reader ");
  assert.equal(result.familyId, "acs-acr1252u");
  assert.equal(result.readerName, "acs acr1252u picc reader");
});

test("distinguishes the SAM interface from the contactless interface", () => {
  const sam = classifyReaderName("ACS ACR1252 1S CL Reader SAM");
  assert.equal(sam.familyId, "acs-acr1252u");
  assert.equal(sam.isContactlessInterface, false);
});

test("recognises the older ACR122U and the multi-protocol ACR128", () => {
  assert.equal(classifyReaderName("ACS ACR122U PICC").familyId, "acs-acr122u");
  const acr128 = classifyReaderName("ACS ACR1281 1S Dual Reader PICC");
  assert.equal(acr128.familyId, "acs-acr128x");
  assert.ok(
    acr128.standards.some((line) => line.includes("15693")),
    "the ACR128 series is where 15693 support actually appears",
  );
});

test("recognises non-ACS readers that people also buy", () => {
  assert.equal(
    classifyReaderName("Sony FeliCa RC-S380/P").familyId,
    "sony-pasori",
  );
  assert.equal(
    classifyReaderName("Identiv uTrust 3700 F CL Reader").familyId,
    "identiv-utrust",
  );
  assert.equal(
    classifyReaderName("HID OMNIKEY 5022 CL").familyId,
    "hid-omnikey",
  );
});

test("falls back to the generic bucket instead of guessing a model", () => {
  const generic = classifyReaderName("Some Contactless Reader PICC");
  assert.equal(generic.familyId, "generic-pcsc");
  assert.equal(generic.confidence, "generic");

  const unknown = classifyReaderName("My Reader 9000");
  assert.equal(unknown.familyId, "unknown");
  assert.equal(unknown.confidence, "none");

  const empty = classifyReaderName(undefined);
  assert.equal(empty.familyId, "unknown");
  assert.equal(empty.readerName, "");
});

test("verdict separates the laptop answer from the tablet answer", () => {
  const acr1252 = verdictFor(classifyReaderName("ACS ACR1252U PICC Reader"));
  assert.equal(acr1252.laptopBatchWrite, "yes");
  assert.equal(acr1252.androidTablet, "vendor-sdk");
  assert.equal(acr1252.ipadTablet, "no");
  assert.equal(acr1252.expoAppDirect, "no");

  const bluetooth = verdictFor(classifyReaderName("ACS ACR1255U-J1"));
  assert.equal(bluetooth.laptopBatchWrite, "no");
});

test("classifyReaders keeps input order and attaches a verdict to each", () => {
  const results = classifyReaders([
    "ACS ACR1252U PICC Reader",
    "Sony FeliCa RC-S380/P",
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].familyId, "acs-acr1252u");
  assert.equal(results[1].familyId, "sony-pasori");
  assert.ok(results.every((entry) => entry.verdict.laptopBatchWrite === "yes"));
});

test("classifyReaders tolerates a non-list input", () => {
  assert.deepEqual(classifyReaders(null), []);
  assert.deepEqual(classifyReaders("ACS ACR1252U PICC Reader"), []);
});

test("recognises the purchased ACR1555U and all three of its transports", () => {
  for (const name of [
    "ACS ACR1555U-A1 PICC Reader",
    "ACS ACR1555U PICC Reader",
  ]) {
    const result = classifyReaderName(name);
    assert.equal(result.familyId, "acs-acr1555u", name);
    assert.deepEqual(result.transports, {
      usbCcId: "yes",
      bleApdu: "yes",
      bleHid: "yes",
    });
  }
});

test("keeps ACR1552 distinct from the ACR1555U", () => {
  assert.equal(classifyReaderName("ACS ACR1552U PICC").familyId, "acs-acr155x");
});

test("a Bluetooth reader with USB CCID is still a laptop reader", () => {
  // ACR1255U is Bluetooth-only, so it must stay out of the laptop path...
  const bluetoothOnly = verdictFor(classifyReaderName("ACS ACR1255U-J1"));
  assert.equal(bluetoothOnly.laptopBatchWrite, "no");

  // ...but the ACR1555U adds USB CCID, which changes that answer.
  const dual = verdictFor(classifyReaderName("ACS ACR1555U PICC Reader"));
  assert.equal(dual.laptopBatchWrite, "yes");
  assert.equal(dual.androidTablet, "ble-apdu");
  assert.equal(dual.androidHidKeyboard, "yes");
  assert.equal(dual.expoAppDirect, "no");
});

test("records that the vendor app can write NDEF URLs over Bluetooth", () => {
  const entry = classifyReaderName("ACS ACR1555U-A1 PICC Reader");
  assert.equal(entry.vendorApp.android, "com.acs.mobile_card_reader_utility");
  assert.equal(entry.vendorApp.ndefUrlWrite, "yes");
});

test("does not invent a vendor app for readers that have none recorded", () => {
  assert.equal(
    classifyReaderName("ACS ACR122U PICC Interface").vendorApp,
    null,
  );
  assert.equal(classifyReaderName("Generic USB Reader").vendorApp, null);
});

test("a reader with a vendor NDEF app is not described as new native work", () => {
  const verdict = verdictFor(classifyReaderName("ACS ACR1555U PICC Reader"));
  assert.match(verdict.summary, /vendor app/);
  assert.doesNotMatch(verdict.summary, /new native work/);
});
