"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  readPageCommand,
  writePageCommand,
  stripStatusWord,
  parseCapabilityContainer,
  variantFromUserBytes,
  variantFromVersionByte,
  planPageWrites,
} = require("../src/ntag");

const { encodeUriTlv } = require("../src/ndef");

const BADGE_URL = "https://linkcard.xyz/t/EVT1/04A1B2C3D4E5F6";

test("parses the capability container of each NTAG21x variant", () => {
  const ntag213 = parseCapabilityContainer(
    Buffer.from([0xe1, 0x10, 0x12, 0x00]),
  );
  assert.equal(ntag213.dataAreaBytes, 144);
  assert.equal(ntag213.variant, "NTAG213");

  // CC reports the writable data area, which is 8 bytes under the 504-byte
  // datasheet figure for NTAG215. 0x3e * 8 = 496.
  const ntag215 = parseCapabilityContainer(
    Buffer.from([0xe1, 0x10, 0x3e, 0x00]),
  );
  assert.equal(ntag215.dataAreaBytes, 496);
  assert.equal(ntag215.variant, "NTAG215");

  const ntag216 = parseCapabilityContainer(
    Buffer.from([0xe1, 0x10, 0x6d, 0x00]),
  );
  assert.equal(ntag216.dataAreaBytes, 872);
  assert.equal(ntag216.variant, "NTAG216");
});

test("rejects a tag that is not NDEF formatted", () => {
  assert.throws(
    () => parseCapabilityContainer(Buffer.from([0x00, 0x00, 0x00, 0x00])),
    /not NDEF formatted/,
  );
  assert.throws(
    () => parseCapabilityContainer(Buffer.from([0xe1, 0x10])),
    /must be 4 bytes/,
  );
});

test("maps the GET_VERSION storage byte to a variant", () => {
  assert.equal(variantFromVersionByte(0x0f), "NTAG213");
  assert.equal(variantFromVersionByte(0x11), "NTAG215");
  assert.equal(variantFromVersionByte(0x13), "NTAG216");
  assert.equal(variantFromVersionByte(0x99), "unknown");
  assert.equal(variantFromUserBytes(144), "NTAG213");
  assert.equal(variantFromUserBytes(123), "unknown");
});

test("builds the READ and WRITE commands the chip expects", () => {
  assert.deepEqual([...readPageCommand(0)], [0x30, 0x00]);
  assert.deepEqual([...readPageCommand(4)], [0x30, 0x04]);

  const write = writePageCommand(4, Buffer.from([0x03, 0x27, 0xd1, 0x01]));
  assert.deepEqual([...write], [0xa2, 0x04, 0x03, 0x27, 0xd1, 0x01]);
});

test("refuses to write outside user memory or with the wrong width", () => {
  assert.throws(
    () => writePageCommand(3, Buffer.alloc(4)),
    /user memory starts at page 4/,
  );
  assert.throws(() => writePageCommand(4, Buffer.alloc(3)), /exactly 4 bytes/);
});

test("strips and interprets the status word", () => {
  const ok = stripStatusWord(Buffer.from([0x01, 0x02, 0x90, 0x00]));
  assert.equal(ok.ok, true);
  assert.deepEqual([...ok.data], [0x01, 0x02]);

  const denied = stripStatusWord(Buffer.from([0x63, 0x00]));
  assert.equal(denied.ok, false);
  assert.equal(denied.sw1, 0x63);

  assert.throws(() => stripStatusWord(Buffer.from([0x90])), /status word/);
});

test("plans page writes that are 4-byte aligned and start at page 4", () => {
  const { tlv } = encodeUriTlv(BADGE_URL);
  const plan = planPageWrites(tlv, { userBytes: 504 });

  assert.equal(plan.fits, true);
  assert.equal(plan.bytes % 4, 0);
  assert.equal(plan.pages[0].page, 4);
  assert.deepEqual([...plan.pages[0].data], [...tlv.subarray(0, 4)]);
  assert.ok(plan.pages.every((entry) => entry.data.length === 4));

  const rebuilt = Buffer.concat(plan.pages.map((entry) => entry.data));
  assert.deepEqual([...rebuilt.subarray(0, tlv.length)], [...tlv]);
  assert.ok(
    rebuilt.subarray(tlv.length).every((byte) => byte === 0x00),
    "padding must be zeroes, never leftover data",
  );
});

test("reports a too-large payload instead of silently truncating it", () => {
  const big = encodeUriTlv(`https://${"d".repeat(400)}`).tlv;
  const plan = planPageWrites(big, { userBytes: 144 });
  assert.equal(plan.fits, false);
  assert.equal(plan.capacityBytes, 144);
  assert.ok(plan.bytes > plan.capacityBytes);
});

test("defaults to NTAG215 capacity when the tag size is unknown", () => {
  const { tlv } = encodeUriTlv(BADGE_URL);
  assert.equal(planPageWrites(tlv).capacityBytes, 496);
});

test("refuses an empty payload", () => {
  assert.throws(() => planPageWrites(Buffer.alloc(0)), /non-empty/);
  assert.throws(() => planPageWrites("nope"), /non-empty/);
});
