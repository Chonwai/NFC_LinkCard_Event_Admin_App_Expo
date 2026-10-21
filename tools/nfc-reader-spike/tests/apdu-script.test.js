"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildScript,
  renderScript,
  passThrough,
  toHex,
} = require("../src/apdu-script");
const { encodeUriTlv } = require("../src/ndef");

test("passThrough wraps a native command in the documented envelope", () => {
  // Reference Manual v2.02 §5.5.4.1 gives this exact example.
  assert.equal(toHex(passThrough(Buffer.from([0x60]))), "FF 00 00 00 01 60");
});

test("passThrough refuses empty and over-long payloads", () => {
  assert.throws(() => passThrough(Buffer.alloc(0)), /non-empty/);
  assert.throws(() => passThrough(Buffer.alloc(256)), /too long/);
});

test("passThrough sets Lc to the command length", () => {
  const apdu = passThrough(Buffer.from([0xa2, 0x04, 0x03, 0x0b, 0xd1, 0x01]));
  assert.equal(apdu[4], 6);
  assert.equal(apdu.length, 5 + 6);
});

test("a script starts with a self-test, writes every page, then verifies", () => {
  const script = buildScript("https://example.com/badge/abc");
  assert.equal(script.steps[0].kind, "self-test");
  assert.equal(script.steps[0].apdu.toString("hex"), "ff0000000160");
  assert.equal(script.steps.at(-1).kind, "verify");
  const writes = script.steps.filter((step) => step.kind === "write");
  assert.equal(writes.length, script.pages);
  // The native command starts after the 5-byte header, so `subarray(5)` is
  // `A2 <page> b0 b1 b2 b3`.
  writes.forEach((step, index) => {
    const native = step.apdu.subarray(5);
    assert.equal(native[0], 0xa2, "INS should be WRITE");
    assert.equal(native[1], 4 + index, "page numbers should be contiguous");
    assert.equal(native.length, 6);
  });
});

test("each write APDU is the pass-through plus a 4-byte page", () => {
  const script = buildScript("https://example.com/b");
  const firstWrite = script.steps.find((step) => step.kind === "write");
  // FF 00 00 00 06 A2 <page> <4 bytes> — Lc counts the native command.
  assert.equal(firstWrite.apdu[0], 0xff);
  assert.equal(firstWrite.apdu[4], 6);
  assert.equal(firstWrite.apdu[5], 0xa2);
  assert.equal(firstWrite.apdu.length, 5 + 6);
});
test("the written bytes are exactly the NDEF TLV for that URL", () => {
  const url = "https://example.com/x";
  const script = buildScript(url, { selfTest: false, verify: false });
  const written = Buffer.concat(
    script.steps.map((step) => step.apdu.subarray(7, 11)),
  );
  const { tlv } = encodeUriTlv(url);
  assert.deepEqual(
    written.subarray(0, tlv.length),
    tlv,
    "payload must round-trip through the page plan",
  );
  // Padding after the TLV must be zero, not garbage.
  for (const byte of written.subarray(tlv.length)) {
    assert.equal(byte, 0);
  }
});

test("a URL that does not fit is reported instead of silently truncated", () => {
  const longUrl = `https://example.com/${"a".repeat(400)}`;
  const script = buildScript(longUrl, { variant: "NTAG213" });
  assert.equal(script.fitted, false);
  assert.ok(script.bytes > script.capacityBytes);
});

test("the same URL fits on a bigger chip", () => {
  const longUrl = `https://example.com/${"a".repeat(400)}`;
  assert.equal(buildScript(longUrl, { variant: "NTAG213" }).fitted, false);
  assert.equal(buildScript(longUrl, { variant: "NTAG216" }).fitted, true);
});

test("unknown variants are rejected rather than defaulted", () => {
  assert.throws(
    () => buildScript("https://x.test", { variant: "NTAG999" }),
    /unknown NTAG variant/,
  );
});

test("renderScript can emit bare hex or commented hex", () => {
  const script = buildScript("https://example.com/c");
  const bare = renderScript(script, { comments: false });
  const lines = bare.trim().split("\n");
  assert.equal(lines.length, script.lines.length);
  for (const line of lines) {
    assert.match(line, /^[0-9A-F]{2}( [0-9A-F]{2})*$/);
  }

  const annotated = renderScript(script);
  assert.match(annotated, /^# ACR1555U badge script/);
  assert.match(annotated, /FF 00 00 00 01 60/);
  // Every non-empty line must be either a comment or a hex APDU, so a naive
  // parser can skip what it does not understand instead of choking.
  for (const line of annotated.trim().split("\n")) {
    if (line === "") continue;
    assert.ok(
      line.startsWith("#") || /^[0-9A-F]{2}( [0-9A-F]{2})*$/.test(line),
      `unexpected line: ${line}`,
    );
  }
});

test("the self-test and verify steps are optional", () => {
  const script = buildScript("https://example.com/d", {
    selfTest: false,
    verify: false,
  });
  assert.ok(script.steps.every((step) => step.kind === "write"));
});
