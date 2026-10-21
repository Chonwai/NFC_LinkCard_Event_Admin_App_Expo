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
