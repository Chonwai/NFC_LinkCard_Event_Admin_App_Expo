"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  pickUriPrefix,
  encodeUriMessage,
  encodeTlv,
  encodeUriTlv,
  extractNdefFromTlv,
  decodeUriMessage,
} = require("../src/ndef");

const BADGE_URL = "https://linkcard.xyz/t/EVT1/04A1B2C3D4E5F6";

test("picks the longest URI prefix, not merely the first", () => {
  assert.equal(pickUriPrefix("https://www.example.com/a").code, 0x02);
  assert.equal(pickUriPrefix("https://linkcard.xyz/x").code, 0x04);
  assert.equal(pickUriPrefix("http://example.com/x").code, 0x03);
  assert.equal(pickUriPrefix("http://www.example.com/x").code, 0x01);
  assert.equal(pickUriPrefix("tel:+85312345678").code, 0x05);
  assert.equal(pickUriPrefix("urn:nfc:ext:linkcard.xyz").code, 0x23);
  assert.equal(pickUriPrefix("weird://scheme/x").code, 0x00);
});

test("emits the exact badge byte layout", () => {
  const { tlv } = encodeUriTlv(BADGE_URL);
  // "linkcard.xyz/t/EVT1/04A1B2C3D4E5F6" is 34 bytes -> payload 35, message 39.
  assert.equal(tlv[0], 0x03, "TLV tag");
  assert.equal(tlv[1], 0x27, "TLV length = 39");
  assert.equal(tlv[2], 0xd1, "MB|ME|SR|TNF=well-known");
  assert.equal(tlv[3], 0x01, "type length");
  assert.equal(tlv[4], 0x23, "payload length = 35");
  assert.equal(tlv[5], 0x55, "'U' record type");
  assert.equal(tlv[6], 0x04, "'https://' prefix code");
  assert.equal(
    tlv.subarray(7, tlv.length - 1).toString("utf8"),
    "linkcard.xyz/t/EVT1/04A1B2C3D4E5F6",
  );
  assert.equal(tlv[tlv.length - 1], 0xfe, "terminator");
  assert.equal(tlv.length, 42);
});

test("round-trips a badge URL through TLV and back", () => {
  const { tlv } = encodeUriTlv(BADGE_URL);
  const decoded = decodeUriMessage(extractNdefFromTlv(tlv));
  assert.equal(decoded.uri, BADGE_URL);
  assert.equal(decoded.prefixCode, 0x04);
  assert.equal(decoded.compressedBytes, 7);
});

test("handles payloads that need the long record and 3-byte TLV length", () => {
  const longUrl = `https://${"a".repeat(300)}`;
  const { message, tlv } = encodeUriTlv(longUrl);

  assert.equal(message[0], 0xc1, "SR bit must be clear on long records");
  assert.equal(message.readUInt32BE(2), 301, "4-byte payload length");

  assert.equal(tlv[0], 0x03);
  assert.equal(tlv[1], 0xff, "3-byte length form marker");
  assert.equal((tlv[2] << 8) | tlv[3], message.length);

  assert.equal(decodeUriMessage(extractNdefFromTlv(tlv)).uri, longUrl);
});

test("uses the short TLV form right up to the 254-byte boundary", () => {
  // rest 253 -> payload 254 -> message 258, which no longer fits one length byte
  const url = `https://${"b".repeat(253)}`;
  const { message, tlv } = encodeUriTlv(url);
  assert.equal(message.length, 258);
  assert.equal(tlv[1], 0xff, "258 bytes no longer fits a 1-byte length");

  // rest 249 -> payload 250 -> message 254, the largest short form
  const shorter = `https://${"c".repeat(249)}`;
  const shortTlv = encodeUriTlv(shorter).tlv;
  assert.equal(shortTlv[1], 254, "254 is still the short form");
});

test("rejects anything it cannot honestly write", () => {
  assert.throws(() => encodeUriMessage(""), /non-empty/);
  assert.throws(() => encodeUriMessage("   "), /non-empty/);
  assert.throws(() => encodeUriMessage(null), /non-empty/);
});

test("refuses to decode records that are not a well-known URI", () => {
  const wellKnownText = Buffer.from([0xd1, 0x01, 0x03, 0x54, 0x02, 0x68, 0x69]);
  assert.throws(() => decodeUriMessage(wellKnownText), /unsupported record/);

  const truncated = Buffer.from([0xd1, 0x01, 0x28, 0x55, 0x04, 0x61]);
  assert.throws(() => decodeUriMessage(truncated), /truncated payload/);

  assert.throws(() => decodeUriMessage(Buffer.alloc(0)), /at least 3 bytes/);
});

test("reports missing and truncated TLVs instead of returning silence", () => {
  assert.throws(
    () => extractNdefFromTlv(Buffer.from([0x00, 0x00])),
    /no NDEF TLV/,
  );
  assert.throws(
    () => extractNdefFromTlv(Buffer.from([0x03])),
    /missing length/,
  );
  assert.throws(
    () => extractNdefFromTlv(Buffer.from([0x03, 0xff, 0x01])),
    /3-byte length form is incomplete/,
  );
  assert.throws(
    () => extractNdefFromTlv(Buffer.from([0x03, 0x10, 0xd1])),
    /truncated NDEF message/,
  );
});

test("encodeTlv refuses non-Buffer input", () => {
  assert.throws(() => encodeTlv("nope"), /expects a Buffer/);
});
