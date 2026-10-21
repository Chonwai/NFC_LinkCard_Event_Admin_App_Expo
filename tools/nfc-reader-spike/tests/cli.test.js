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

function captureConsole() {
  const chunks = [];
  const originalLog = console.log;
  console.log = (...args) => chunks.push(args.join(" "));
  return {
    text: () => chunks.join("\n"),
    restore: () => {
      console.log = originalLog;
    },
  };
}

test("drivers prints every platform and exits 0", async () => {
  const capture = captureConsole();
  try {
    assert.equal(await main(["drivers"]), 0);
  } finally {
    capture.restore();
  }
  const output = capture.text();
  for (const os of ["windows", "macos", "linux", "android", "ios"]) {
    assert.match(output, new RegExp(`^${os}\\b`, "m"), `${os} row missing`);
  }
  // The distinction that matters most: desktop USB needs nothing, Android does.
  assert.match(output, /BLE PC\/SC Driver installer 1\.0\.3\.1/);
  assert.match(output, /no driver exists/);
});

test("drivers --os exits 1 only when the asked-about route needs an install", async () => {
  const capture = captureConsole();
  try {
    // Android has no driver to install, so "must I install something?" is no.
    assert.equal(await main(["drivers", "--os", "android"]), 0);
    // Windows as a whole has the USB route, which is inbox.
    assert.equal(await main(["drivers", "--os", "windows"]), 0);
    // ...but Bluetooth on Windows genuinely needs the vendor bridge.
    assert.equal(
      await main(["drivers", "--os", "windows", "--transport", "bluetooth"]),
      1,
    );
    assert.equal(
      await main(["drivers", "--os", "windows", "--transport", "usb"]),
      0,
    );
    // A transport the platform does not have is not a "no".
    assert.equal(
      await main(["drivers", "--os", "macos", "--transport", "bluetooth"]),
      1,
    );
    // An unknown platform must not silently look fine.
    assert.equal(await main(["drivers", "--os", "beos"]), 1);
  } finally {
    capture.restore();
  }
  assert.match(capture.text(), /Unknown operating system/);
});

test("an unknown platform reports null, never a quiet false", async () => {
  const capture = captureConsole();
  try {
    assert.equal(await main(["drivers", "--os", "beos", "--json"]), 1);
  } finally {
    capture.restore();
  }
  const parsed = JSON.parse(capture.text());
  assert.equal(parsed.known, false);
  assert.equal(parsed.installsNeeded, null);
});

test("drivers --json is machine readable", async () => {
  const capture = captureConsole();
  try {
    assert.equal(await main(["drivers", "--json"]), 0);
  } finally {
    capture.restore();
  }
  const parsed = JSON.parse(capture.text());
  assert.ok(Array.isArray(parsed));
  const macos = parsed.find((entry) => entry.os === "macos");
  assert.equal(macos.installsNeeded, false);
  assert.ok(macos.rows.some((row) => row.id === "macos-usb"));
});

test("script prints a replayable sequence and exits 0", async () => {
  const chunks = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalLog = console.log;
  const originalError = console.error;
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  console.log = () => {};
  console.error = () => {};
  let code;
  try {
    code = await main(["script", "--url", "https://linkcard.example/b/7F3A"]);
  } finally {
    process.stdout.write = originalWrite;
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(code, 0);
  const text = chunks.join("");
  assert.match(text, /^# ACR1555U badge script/m);
  assert.match(text, /FF 00 00 00 01 60/);
  assert.doesNotMatch(text, /DO NOT SEND/);
});

test("script --out writes the file and leaves stdout clean", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spike-script-"));
  const target = path.join(dir, "badge.script");
  const originalLog = console.log;
  console.log = () => {};
  let code;
  try {
    code = await main([
      "script",
      "--url",
      "https://linkcard.example/b/7F3A",
      "--out",
      target,
    ]);
  } finally {
    console.log = originalLog;
  }
  assert.equal(code, 0);
  const written = fs.readFileSync(target, "utf8");
  assert.match(written, /A2 04/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("script refuses an oversized payload without writing a file", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spike-big-"));
  const target = path.join(dir, "badge.script");
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  let code;
  try {
    code = await main([
      "script",
      "--url",
      `https://example.com/${"a".repeat(400)}`,
      "--variant",
      "NTAG213",
      "--out",
      target,
    ]);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(code, 1);
  // The guard must run before the write, not after.
  assert.equal(fs.existsSync(target), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("script rejects a bad command line with exit 2", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await main(["script"]), 2);
    assert.equal(
      await main(["script", "--url", "https://x.test", "--variant", "NTAG999"]),
      2,
    );
  } finally {
    console.error = originalError;
  }
});
