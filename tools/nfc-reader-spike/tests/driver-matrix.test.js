"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DRIVER_MATRIX,
  REQUIREMENT_MEANING,
  listOperatingSystems,
  driverRows,
  driverAnswer,
  allDriverAnswers,
  answerFromRows,
} = require("../src/driver-matrix");

test("every matrix row is fully sourced and self-consistent", () => {
  for (const row of DRIVER_MATRIX) {
    assert.ok(row.id, "row needs an id");
    assert.ok(row.osLabel, `${row.id} needs a label`);
    assert.match(row.id, new RegExp(`^${row.os}-${row.transport}$`));
    assert.ok(
      REQUIREMENT_MEANING[row.requirement],
      `${row.id} has an unknown requirement '${row.requirement}'`,
    );
    assert.ok(row.mechanism.length > 20, `${row.id} needs a real explanation`);
    assert.ok(row.evidence.length > 20, `${row.id} needs evidence`);
    if (row.requirement === "vendor") {
      assert.ok(
        row.installer,
        `${row.id} is vendor-driven so it must name the package`,
      );
    } else {
      assert.equal(
        row.installer,
        null,
        `${row.id} should not name an installer`,
      );
    }
  }
});

test("ids are unique", () => {
  const ids = DRIVER_MATRIX.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("USB is driver-free on the three desktop systems", () => {
  for (const os of ["windows", "macos", "linux"]) {
    const [row] = driverRows(os, "usb");
    assert.equal(
      row.requirement,
      "inbox",
      `${os} USB should be an inbox class driver`,
    );
  }
});

test("only Windows needs a vendor package, and only for Bluetooth", () => {
  const vendorRows = DRIVER_MATRIX.filter(
    (row) => row.requirement === "vendor",
  );
  assert.equal(vendorRows.length, 1);
  assert.equal(vendorRows[0].id, "windows-bluetooth");
  assert.match(vendorRows[0].installer, /BLE PC\/SC Driver/);
});

test("Bluetooth is unsupported on macOS and Linux, never 'app'", () => {
  for (const os of ["macos", "linux"]) {
    const [row] = driverRows(os, "bluetooth");
    assert.equal(row.requirement, "unsupported");
  }
});

test("Android has no driver whatsoever — both transports are app-level", () => {
  const rows = driverRows("android");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.requirement, "app");
    assert.equal(row.installer, null);
  }
});

test("iOS USB is not a route for NDEF (PIV only)", () => {
  const [usb] = driverRows("ios", "usb");
  assert.equal(usb.requirement, "unsupported");
  assert.match(usb.mechanism, /PIV/);
  const [ble] = driverRows("ios", "bluetooth");
  assert.equal(ble.requirement, "app");
});

test("driverAnswer scopes an installer to the transport that needs it", () => {
  const windows = driverAnswer("windows");
  assert.match(windows.vendorInstaller, /BLE PC\/SC Driver/);
  // USB is inbox, so "Windows needs a driver" would be the wrong headline.
  assert.equal(windows.installsNeeded, false);
  assert.deepEqual(windows.installsNeededByTransport, {
    usb: false,
    bluetooth: true,
  });
  assert.match(windows.summary, /\(bluetooth only\)/);

  const macos = driverAnswer("macos");
  assert.equal(macos.installsNeeded, false);
  assert.equal(macos.vendorInstaller, null);
  // USB is fine, Bluetooth is not — saying just "no supported route" would be
  // wrong in the other direction.
  assert.match(macos.summary, /nothing to install/);
  assert.match(macos.summary, /bluetooth is not a supported route/);
});

test("installsNeeded is only true when every usable transport demands it", () => {
  for (const os of ["windows", "macos", "android", "ios"]) {
    assert.equal(
      driverAnswer(os).installsNeeded,
      false,
      `${os} always has at least one route that needs no driver install`,
    );
  }
});

test("an unknown platform is a third state, not a quiet 'no'", () => {
  const unknown = driverAnswer("beos");
  // JSON consumers must not read false and conclude "you are fine".
  assert.equal(unknown.known, false);
  assert.equal(unknown.installsNeeded, null);
  assert.equal(unknown.installsNeededByTransport, null);
  assert.deepEqual(unknown.usableTransports, []);
});

test("driverAnswer explains the app requirement on Android", () => {
  const android = driverAnswer("android");
  assert.equal(android.installsNeeded, false);
  assert.match(android.summary, /no driver exists/);
  assert.match(android.summary, /usb \/ bluetooth/);
});

test("driverAnswer tolerates case and surrounding whitespace", () => {
  assert.equal(driverAnswer("WINDOWS").known, true);
  assert.equal(driverAnswer("  windows  ").known, true);
  assert.equal(driverRows("windows", "USB").length, 1);
  const unknown = driverAnswer("beos");
  assert.equal(unknown.known, false);
  assert.match(unknown.summary, /Unknown operating system/);
});

test("allDriverAnswers covers every OS exactly once", () => {
  const answers = allDriverAnswers();
  assert.deepEqual(
    answers.map((entry) => entry.os),
    listOperatingSystems(),
  );
  for (const entry of answers) {
    assert.ok(entry.rows.length > 0, `${entry.os} should have rows`);
    assert.ok(entry.summary.length > 0);
  }
});

test("an unsupported row may explain a subsystem without breaking the shape", () => {
  // iOS USB names CryptoTokenKit because that support exists but is PIV-only.
  const [row] = driverRows("ios", "usb");
  assert.equal(row.requirement, "unsupported");
  assert.match(row.subsystem, /PIV/);
  // Every other unsupported row leaves it empty; either way it is a string|null.
  for (const entry of DRIVER_MATRIX.filter(
    (r) => r.requirement === "unsupported",
  )) {
    assert.ok(
      entry.subsystem === null || typeof entry.subsystem === "string",
      `${entry.id} subsystem must be null or a string`,
    );
  }
});

test("every row cites something a reviewer can look up", () => {
  // The module exists so the answer cannot drift into folklore. A guideline with
  // no lookupable marker fails that purpose, so require one.
  const sourceMarker = /https?:\/\/|§|v?\d+\.\d+/;
  for (const row of DRIVER_MATRIX) {
    assert.match(
      row.evidence,
      sourceMarker,
      `${row.id} cites nothing specific`,
    );
    assert.notEqual(
      row.evidence,
      row.mechanism,
      `${row.id} repeats its mechanism instead of citing a source`,
    );
  }
});

test("any version number in a label also appears in the evidence", () => {
  for (const row of DRIVER_MATRIX) {
    const versions = row.osLabel.match(/\d+(\.\d+)*/g) || [];
    for (const version of versions) {
      assert.ok(
        row.evidence.includes(version),
        `${row.id} claims ${version} in its label but never sources it`,
      );
    }
  }
});

test("a platform with only unsupported routes is not reported as install-free", () => {
  const synthetic = [
    {
      id: "x-usb",
      transport: "usb",
      requirement: "unsupported",
      installer: null,
    },
  ];
  const answer = answerFromRows(synthetic, "x");
  assert.equal(answer.known, true);
  assert.equal(answer.installsNeeded, null);
  assert.deepEqual(answer.installsNeededByTransport, { usb: null });
  assert.match(answer.summary, /no supported route/);
});
