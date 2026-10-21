"use strict";

/**
 * "Do I need to install a driver?"
 *
 * The honest answer is not one sentence — it is a different sentence on every
 * operating system, and on Windows it is even different per transport. This
 * module encodes that table so the answer cannot drift into folklore.
 *
 * Sourcing rules, kept deliberately strict:
 * - `inbox` means the OS itself binds the reader; a vendor installer is then
 *   optional (it replaces the class driver, it does not create support).
 * - `vendor` means the vendor installer IS the support; without it the device
 *   never appears to the OS subsystem named in `subsystem`.
 * - `app` means the platform has no installable driver at all and the reader
 *   only works inside an application that speaks the protocol.
 * - `unsupported` means official OS-support lists do not name that platform.
 *
 * Every row cites the document it came from, so a reader of the code can check
 * the claim instead of trusting it.
 */

/**
 * @typedef {object} DriverRow
 * @property {string} id          stable key, `<os>-<transport>`
 * @property {string} os
 * @property {string} osLabel
 * @property {"usb"|"bluetooth"} transport
 * @property {"inbox"|"vendor"|"app"|"unsupported"} requirement
 * @property {string} mechanism   what actually makes it work
 * @property {string|null} subsystem  who consumes the device; an
 *   `unsupported` row MAY name one, to explain part of the platform that
 *   exists but does not apply (e.g. CryptoTokenKit for PIV only)
 * @property {string|null} installer   vendor package, when one matters
 * @property {string} evidence
 */

/** @type {DriverRow[]} */
const DRIVER_MATRIX = [
  {
    id: "windows-usb",
    os: "windows",
    osLabel: "Windows 10 / 11",
    transport: "usb",
    requirement: "inbox",
    mechanism:
      "USB CCID is a Windows-supported device class, so the reader binds to the " +
      "inbox smart-card driver and PC/SC sees it with nothing installed",
    subsystem: "PC/SC (SCardSvr)",
    installer: null,
    evidence:
      "Microsoft 'USB Device Class Drivers Included in Windows' (Windows 10 and 11): " +
      "Smart Card (0Bh) -> Usbccid.sys, replaced by WUDFUsbccidDriver.dll; ACS " +
      "PC/SC Driver Installer 1.0.6.2 is therefore optional",
  },
  {
    id: "windows-bluetooth",
    os: "windows",
    osLabel: "Windows 10 / 11",
    transport: "bluetooth",
    requirement: "vendor",
    mechanism:
      "Windows has no generic BLE-to-PC/SC bridge, so the vendor driver is what " +
      "turns a paired reader into a PC/SC reader",
    subsystem: "PC/SC (SCardSvr)",
    installer: "BLE PC/SC Driver installer 1.0.3.1",
    evidence:
      "ACS ACR1555U driver page (Windows 10 and 11 row) lists 'BLE PC/SC Driver " +
      "installer 1.0.3.1' for Windows only, with no macOS or Linux equivalent",
  },
  {
    id: "macos-usb",
    os: "macos",
    osLabel: "macOS 10.15+",
    transport: "usb",
    requirement: "inbox",
    mechanism:
      "CryptoTokenKit ships Apple's own CCID class driver, so a CCID reader works " +
      "without additional software",
    subsystem: "CryptoTokenKit / smartcardd",
    installer: null,
    evidence:
      "Apple 'Intro to smart card integration': native support for USB CCID " +
      "class-compliant readers from macOS 10.15; SmartCardServices(7) says OS X " +
      "has built-in support for USB CCID readers",
  },
  {
    id: "macos-bluetooth",
    os: "macos",
    osLabel: "macOS",
    transport: "bluetooth",
    requirement: "unsupported",
    mechanism:
      "macOS is absent from the vendor's Bluetooth support list, and no macOS BLE " +
      "PC/SC driver is published, so the Mac path is USB only",
    subsystem: null,
    installer: null,
    evidence:
      "ACS ACR1555U product page: USB row lists macOS 10.7+; Bluetooth row lists " +
      "Windows / Android / iOS / iPadOS and omits macOS",
  },
  {
    id: "linux-usb",
    os: "linux",
    osLabel: "Linux",
    transport: "usb",
    requirement: "inbox",
    mechanism:
      "pcsc-lite plus the libccid driver handle CCID readers; the vendor package " +
      "only swaps in ACS's tuned CCID",
    subsystem: "pcscd",
    installer: null,
    evidence:
      "ACS PC/SC Driver Installer 1.1.13 for Linux builds acsccid on top of " +
      "pcsc-lite (github.com/acshk/acsccid), i.e. a replacement, not a " +
      "prerequisite",
  },
  {
    id: "linux-bluetooth",
    os: "linux",
    osLabel: "Linux",
    transport: "bluetooth",
    requirement: "unsupported",
    mechanism:
      "No Linux BLE PC/SC transport is published, so Bluetooth is not a route here",
    subsystem: null,
    installer: null,
    evidence:
      "ACS ACR1555U driver page: the only Bluetooth entries are the Windows BLE " +
      "PC/SC Driver 1.0.3.1 and the Android/iOS EVK packages; no Linux BLE bridge",
  },
  {
    id: "android-usb",
    os: "android",
    osLabel: "Android 4.3+ (USB host mode)",
    transport: "usb",
    requirement: "app",
    mechanism:
      "Android has no installable driver and no system PC/SC service: the app must " +
      "claim the USB interface and speak CCID itself",
    subsystem: "USB Host API (UsbManager)",
    installer: null,
    evidence:
      "Android 'USB host overview': UsbManager/claimInterface/bulkTransfer, host " +
      "mode from Android 4.3, and 'not all Android-powered devices are " +
      "guaranteed to support the USB host APIs'; ACS ships Android EVK 1.1.8",
  },
  {
    id: "android-bluetooth",
    os: "android",
    osLabel: "Android 4.4+ (BLE APDU)",
    transport: "bluetooth",
    requirement: "app",
    mechanism:
      "the app talks GATT to the reader's APDU service; pairing in system settings " +
      "is not the same as an app that can use it",
    subsystem: "Bluetooth LE (GATT)",
    installer: null,
    evidence:
      "ACS Android BLE EVK (SmartCardIO) 0.6.2 for Android 4.4+; Android 12+ " +
      "requires BLUETOOTH_SCAN / BLUETOOTH_CONNECT runtime permissions",
  },
  {
    id: "ios-usb",
    os: "ios",
    osLabel: "iOS 16.1+ / iPadOS 16+",
    transport: "usb",
    requirement: "unsupported",
    mechanism:
      "Apple's CCID support exists but is scoped to PIV smart cards, so a USB " +
      "connection is not a route for writing NDEF",
    subsystem: "CryptoTokenKit (PIV only)",
    installer: null,
    evidence:
      "Apple 'Intro to smart card integration': native USB CCID support arrives " +
      "with iOS 16.1 / iPadOS 16 and is scoped to PIV smart cards; some readers " +
      "need a powered hub",
  },
  {
    id: "ios-bluetooth",
    os: "ios",
    osLabel: "iOS 15+ / iPadOS 16+",
    transport: "bluetooth",
    requirement: "app",
    mechanism:
      "the app speaks the reader's GATT service through CoreBluetooth; there is no " +
      "driver to install on iOS at all",
    subsystem: "CoreBluetooth",
    installer: null,
    evidence:
      "ACS iOS BLE EVK (SmartCardIO) 0.7.0 for iOS 15.0+; Mobile Card Reader " +
      "Utility is on the App Store requiring iOS 17.2+ (iPadOS 16+ per the " +
      "product page)",
  },
];

const REQUIREMENT_MEANING = {
  inbox: "the OS binds it; nothing to install",
  vendor: "the vendor package is what makes it work",
  app: "no driver to install — an app has to implement the protocol",
  unsupported: "not an official route on this platform",
};

/** Distinct operating systems, in the order a LinkCard operator would try them. */
function listOperatingSystems() {
  return ["windows", "macos", "linux", "android", "ios"];
}

/**
 * Rows for one OS, or for one OS+transport pair.
 *
 * @param {string} os
 * @param {"usb"|"bluetooth"} [transport]
 * @returns {DriverRow[]}
 */
function normalise(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase();
}

function driverRows(os, transport) {
  const key = normalise(os);
  const wanted = transport == null ? null : normalise(transport);
  return DRIVER_MATRIX.filter(
    (row) => row.os === key && (wanted == null || row.transport === wanted),
  );
}

/**
 * The one-line answer for a given platform: does anything have to be installed?
 *
 * @param {string} os
 * @returns {{os: string, installsNeeded: boolean, vendorInstaller: string|null, summary: string}}
 */
function driverAnswer(os) {
  const rows = driverRows(os);
  if (rows.length === 0) {
    return {
      os: String(os),
      known: false,
      installsNeeded: null,
      installsNeededByTransport: null,
      usableTransports: [],
      vendorInstaller: null,
      summary: "Unknown operating system — no driver facts recorded.",
    };
  }

  return answerFromRows(rows, rows[0].os);
}

/**
 * Pure: builds the answer from a set of rows. Exported so the "every route is
 * unsupported" case can be tested without inventing a fake operating system.
 *
 * @param {DriverRow[]} rows
 * @param {string} os
 */
function answerFromRows(rows, os) {
  const vendorRows = rows.filter((row) => row.requirement === "vendor");
  const appRows = rows.filter((row) => row.requirement === "app");
  const unsupportedRows = rows.filter(
    (row) => row.requirement === "unsupported",
  );

  /**
   * Per-transport answer. `null` means "this route does not exist here", which
   * is a different statement from "no install needed" — collapsing the two is
   * how a dead route starts looking healthy.
   */
  const installsNeededByTransport = {};
  for (const row of rows) {
    installsNeededByTransport[row.transport] =
      row.requirement === "unsupported" ? null : row.requirement === "vendor";
  }
  const usableRows = rows.filter((row) => row.requirement !== "unsupported");
  const usableTransports = usableRows.map((row) => row.transport);

  if (usableRows.length === 0) {
    return {
      os,
      known: true,
      installsNeeded: null,
      installsNeededByTransport,
      usableTransports,
      vendorInstaller: null,
      summary: "no supported route on this platform",
    };
  }

  const installsNeeded = usableRows.every(
    (row) => row.requirement === "vendor",
  );
  const vendorInstaller = vendorRows.length ? vendorRows[0].installer : null;

  const parts = [];
  if (vendorRows.length) {
    const only = vendorRows.map((row) => row.transport).join(" / ");
    parts.push(`install ${vendorInstaller} (${only} only)`);
  }
  if (appRows.length) {
    const transports = appRows.map((row) => row.transport).join(" / ");
    parts.push(
      `no driver exists — an app must speak the protocol (${transports})`,
    );
  }
  if (vendorRows.length === 0 && appRows.length === 0) {
    parts.push("nothing to install");
  }
  if (unsupportedRows.length) {
    const dead = unsupportedRows.map((row) => row.transport).join(" / ");
    parts.push(`${dead} is not a supported route here`);
  }

  return {
    os,
    known: true,
    installsNeeded,
    installsNeededByTransport,
    usableTransports,
    vendorInstaller,
    summary: parts.join("; "),
  };
}

/** Every OS, answered. Used by the `drivers` CLI command. */
function allDriverAnswers() {
  return listOperatingSystems().map((os) => ({
    ...driverAnswer(os),
    rows: driverRows(os),
  }));
}

module.exports = {
  DRIVER_MATRIX,
  answerFromRows,
  REQUIREMENT_MEANING,
  listOperatingSystems,
  driverRows,
  driverAnswer,
  allDriverAnswers,
};
