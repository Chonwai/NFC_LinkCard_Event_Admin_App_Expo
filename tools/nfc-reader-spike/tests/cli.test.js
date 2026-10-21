"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { main, hasBinary } = require("../bin/spike");

test("exposes a callable CLI entry point", () => {
  assert.equal(typeof main, "function");
});

test("detects a binary that must exist and one that must not", () => {
  assert.equal(hasBinary("node"), true);
  assert.equal(hasBinary("definitely-not-a-real-binary-xyz"), false);
});

test("unknown commands exit with 2 rather than 1", async () => {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    assert.equal(await main(["nonsense"]), 2);
    assert.equal(await main(["help"]), 0);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test("readers --assume answers from the name alone, with no hardware", async () => {
  const originalLog = console.log;
  const lines = [];
  console.log = (line) => lines.push(String(line));
  try {
    const code = await main([
      "readers",
      "--assume",
      "ACS ACR1555U-A1 PICC Reader",
    ]);
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
  }
  const output = lines.join("\n");
  assert.match(output, /acs-acr1555u/);
  // The report must describe the vendor app the way the official guide does:
  // the NDEF tab emulates, the APDU tool is what reaches a tag.
  assert.match(
    output,
    /vendor app\s+Android com\.acs\.mobile_card_reader_utility/,
  );
  assert.match(output, /NDEF tab:\s+emulation-only/);
  assert.match(output, /APDU tool:\s+yes/);
  assert.doesNotMatch(output, /NDEF URL write available/);
});
