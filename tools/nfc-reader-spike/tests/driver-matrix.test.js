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

test("driverAnswer names the installer on Windows and says nothing to install on macOS", () => {
  const windows = driverAnswer("windows");
  assert.equal(windows.installsNeeded, true);
  assert.match(windows.vendorInstaller, /BLE PC\/SC Driver/);

  const macos = driverAnswer("macos");
  assert.equal(macos.installsNeeded, false);
  assert.equal(macos.vendorInstaller, null);
  // USB is fine, Bluetooth is not — saying just "no supported route" would be
  // wrong in the other direction.
  assert.match(macos.summary, /nothing to install/);
  assert.match(macos.summary, /bluetooth is not a supported route/);
});

test("driverAnswer explains the app requirement on Android", () => {
  const android = driverAnswer("android");
  assert.equal(android.installsNeeded, false);
  assert.match(android.summary, /no driver exists/);
  assert.match(android.summary, /usb \/ bluetooth/);
});

test("driverAnswer is case-insensitive and survives nonsense input", () => {
  assert.equal(driverAnswer("WINDOWS").installsNeeded, true);
  const unknown = driverAnswer("beos");
  assert.equal(unknown.installsNeeded, false);
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
