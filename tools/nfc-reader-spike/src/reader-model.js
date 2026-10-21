"use strict";

/**
 * PC/SC reader identification.
 *
 * `nfc-pcsc` exposes a reader by the name the operating system reports, e.g.
 * "ACS ACR1252 1S CL Reader PICC". That string is the only device identity we
 * get for free, so it is also the only honest basis for answering "can this
 * machine be used?" before anyone writes a line of driver code.
 *
 * Nothing here touches hardware: every function is pure, so the whole mapping
 * can be tested on a laptop with no reader plugged in.
 */

/**
 * Per-platform capability, expressed as strings rather than booleans so the
 * "we have not tested this" state is representable instead of silently false.
 *
 * - "yes"      vendor or spec states support, and it is the documented path
 * - "likely"   support is expected but not verified on our hardware
 * - "no"       structurally impossible (see `reason` on the family)
 */
const FAMILIES = [
  {
    id: "acs-acr1252u",
    match: /\bACR\s*1252/i,
    label: "ACS ACR1252U USB NFC Reader III",
    vendor: "Advanced Card Systems (ACS)",
    confidence: "high",
    standards: [
      "ISO/IEC 14443 Type A & B (T=CL)",
      "ISO/IEC 18092 (NFC) reader/writer + peer-to-peer",
      "MIFARE Classic / Ultralight / Plus / DESFire",
      "FeliCa",
      "NFC Forum T1–T4 tag types",
      "PC/SC + USB CCID (driver-free on macOS/Windows/Linux)",
    ],
    notSupported: [
      "ISO/IEC 15693 (vicinity / ICODE) — not in the ACR1252U card list",
      "ISO/IEC 14443 cards behind a SAM-only profile (SAM slot is ISO 7816 Class A)",
    ],
    platforms: {
      macosPcsc: "yes",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "yes",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "This is the reader doc 14 §4.1 names as the recommended replacement for the EOL ACR122U.",
      "Reader name usually ends in 'PICC' — that is the contactless interface, which is the one NDEF needs.",
      "macOS needs no vendor driver: PC/SC + CCID are built in. Installing the ACS driver is the known way to break it.",
    ],
  },
  {
    id: "acs-acr122u",
    match: /\bACR\s*122/i,
    label: "ACS ACR122U (PN532, end-of-life)",
    vendor: "Advanced Card Systems (ACS)",
    confidence: "high",
    standards: [
      "ISO/IEC 14443 A/B",
      "ISO/IEC 18092 (NFC)",
      "MIFARE Classic / Ultralight, NTAG21x",
      "FeliCa",
    ],
    notSupported: ["ISO/IEC 15693 (vicinity)"],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "yes",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "EOL since ~2023; clones are common and their APDU behaviour varies.",
      "This is the device `nfc-pcsc` lists as its own test reader.",
    ],
  },
  {
    id: "acs-acr1255u",
    match: /\bACR\s*1255/i,
    label: "ACS ACR1255U-J1 (Bluetooth NFC reader)",
    vendor: "Advanced Card Systems (ACS)",
    confidence: "high",
    standards: ["ISO/IEC 14443 A/B", "ISO/IEC 18092", "MIFARE", "FeliCa"],
    notSupported: [
      "ISO/IEC 15693 (vicinity)",
      "PC/SC over USB (it is Bluetooth/BLE)",
    ],
    transports: { usbCcId: "no", bleApdu: "likely", bleHid: "unknown" },
    platforms: {
      macosPcsc: "no",
      windowsPcsc: "no",
      linuxPcsc: "no",
      androidUsbVendorSdk: "none",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "Battery-powered Bluetooth reader: not a PC/SC device, so the `nfc-pcsc` path does not apply.",
      "Usable only through the vendor SDK, and charging becomes an event-day problem.",
    ],
  },
  {
    id: "acs-acr128x",
    match: /\bACR\s*128/i,
    label: "ACS ACR1281U / ACR128 series (multi-protocol)",
    vendor: "Advanced Card Systems (ACS)",
    confidence: "high",
    standards: [
      "ISO/IEC 14443 A/B",
      "ISO/IEC 15693 (vicinity) — present on this series",
      "ISO/IEC 18092",
      "MIFARE",
    ],
    notSupported: [],
    platforms: {
      macosPcsc: "yes",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "yes",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "This is what 'supports many protocols' usually means in practice: 15693 on top of 14443.",
      "LinkCard badges are NTAG215 (14443-A), so the extra protocols buy nothing for this project.",
    ],
  },
  {
    id: "acs-acr1555u",
    match: /\bACR\s*1555/i,
    label: "ACS ACR1555U Secure Bluetooth NFC Reader",
    vendor: "Advanced Card Systems (ACS)",
    confidence: "high",
    standards: [
      "ISO/IEC 14443 Type A & B (Parts 1–4)",
      "ISO/IEC 15693 (vicinity)",
      "ISO/IEC 18092 (NFC)",
      "MIFARE Classic / Ultralight / Plus / DESFire",
      "FeliCa",
      "NFC Forum tag types 1–4 (type 5 is not listed)",
      "Bluetooth 5.2 LE (AES-128, 2 Mbps high-speed mode)",
      "USB CCID over USB-C (USB 2.0 full speed, USB 3.0 compatible)",
      "ISO 7816 Class A/B/C SAM slot",
    ],
    notSupported: [
      "NFC Forum tag type 5 (ISO 15693 tag-types are read via 15693, not T5 NDEF)",
      "Apple Lightning — Apple support is USB-C or Bluetooth only",
    ],
    // Three separate transports. HID and APDU are device modes, not simultaneous.
    transports: { usbCcId: "yes", bleApdu: "yes", bleHid: "yes" },
    platforms: {
      macosPcsc: "yes",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "yes",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "This is the device actually purchased (listing: 'ACR1555U, replacement for ACR1255U', ¥399).",
      "USB side is real CCID, so the laptop batch path needs no vendor SDK at all.",
      "Bluetooth side exposes APDU-over-BLE: a third-party Flutter SDK documents 'CCID commands + generic PC/SC APDU transceiving', so a tablet app can send the same READ/WRITE APDUs.",
      "Bluetooth HID keyboard mode types the UID as keystrokes: enough for 'read tagUid', never enough to write a badge.",
      "Mode is a device setting: switching to HID stops APDU service until switched back.",
      "Rechargeable 3.7 V 450 mAh battery; ~31.5 g without the card holder.",
    ],
  },
  {
    id: "acs-acr155x",
    match: /\bACR\s*155/i,
    label: "ACS ACR1552 / ACR1555 series",
    vendor: "Advanced Card Systems (ACS)",
    confidence: "high",
    standards: ["ISO/IEC 14443 A/B", "MIFARE", "NFC Forum tag types"],
    notSupported: [],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "yes",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "Smaller/cheaper ACS family; still PC/SC, so the same spike applies.",
    ],
  },
  {
    id: "identiv-utrust",
    match: /uTrust|Identiv|SCM\s*Micro|SCM\s*SDI/i,
    label: "Identiv uTrust series (dual-frequency)",
    vendor: "Identiv",
    confidence: "medium",
    standards: [
      "ISO/IEC 14443 A/B",
      "ISO/IEC 15693",
      "125 kHz low frequency (on dual-frequency models)",
      "NFC Forum tag types (model dependent)",
    ],
    notSupported: [],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "unknown",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "Its open-source tooling example reads NTAG NDEF through PC/SC, so the write path is plausible.",
      "Low-frequency support is irrelevant to NTAG215 but is a common reason these get bought.",
    ],
  },
  {
    id: "sony-pasori",
    match: /PaSoRi|RC-?S3\d0/i,
    label: "Sony PaSoRi (RC-S380 / RC-S300)",
    vendor: "Sony",
    confidence: "high",
    standards: ["ISO/IEC 14443 A/B", "FeliCa", "NFC Forum tag types"],
    notSupported: ["ISO/IEC 15693 (vicinity)"],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "none",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "First-class citizen of `nfcpy` (Python) rather than `nfc-pcsc`.",
      "If this is the device, the spike should use Python, not Node.",
    ],
  },
  {
    id: "hid-omnikey",
    match: /OMNIKEY|HID\s+Global|iCLASS\s*SE/i,
    label: "HID OMNIKEY series",
    vendor: "HID Global",
    confidence: "medium",
    standards: [
      "ISO/IEC 14443 A/B",
      "ISO/IEC 15693 (model dependent)",
      "MIFARE",
    ],
    notSupported: [],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "unknown",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "Common in access-control fleets; PC/SC so the spike still applies.",
      "Some OMNIKEY models are configured for card-serial-only use and cannot write NDEF.",
    ],
  },
  {
    id: "springcard",
    match: /SpringCard|Prox['’]?n['’]?Roll|PUCK/i,
    label: "SpringCard reader",
    vendor: "SpringCard",
    confidence: "medium",
    standards: [
      "ISO/IEC 14443 A/B",
      "MIFARE",
      "ISO/IEC 15693 (model dependent)",
    ],
    notSupported: [],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "unknown",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "PC/SC compliant; NDEF handling is model specific and must be measured.",
    ],
  },
  {
    id: "generic-pcsc",
    match: /PICC|Smart\s*Card|Contactless|NFC\s*Reader|ICC/i,
    label: "Unrecognised PC/SC contactless reader",
    vendor: "unknown",
    confidence: "generic",
    standards: ["Reported by the OS as a PC/SC reader — capabilities unknown"],
    notSupported: [],
    platforms: {
      macosPcsc: "likely",
      windowsPcsc: "yes",
      linuxPcsc: "yes",
      androidUsbVendorSdk: "unknown",
      ipadExternalReader: "no",
      expoAppDirect: "no",
    },
    notes: [
      "The reader enumerates over PC/SC, which is the hard part; everything else is measurable.",
      "Send the printed fingerprint back so this table can gain a real entry.",
    ],
  },
];

const UNKNOWN_FAMILY = {
  id: "unknown",
  label: "Not identifiable from the device name",
  vendor: "unknown",
  confidence: "none",
  standards: [],
  notSupported: [],
  platforms: {
    macosPcsc: "unknown",
    windowsPcsc: "unknown",
    linuxPcsc: "unknown",
    androidUsbVendorSdk: "unknown",
    ipadExternalReader: "no",
    expoAppDirect: "no",
  },
  notes: [
    "No PC/SC reader matched. Either nothing is plugged in, or the device is not a PC/SC reader at all (e.g. a Bluetooth or serial reader).",
  ],
};

/** Normalises a raw OS reader string for matching and for display. */
function normaliseReaderName(name) {
  return String(name == null ? "" : name)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps one OS reader name onto a known family.
 *
 * @param {string} name raw `reader.name` from PC/SC
 * @returns {object} family description plus the exact name that was matched
 */
function classifyReaderName(name) {
  const readerName = normaliseReaderName(name);
  const family =
    FAMILIES.find((candidate) => candidate.match.test(readerName)) ||
    UNKNOWN_FAMILY;

  return {
    readerName,
    familyId: family.id,
    familyLabel: family.label,
    vendor: family.vendor,
    confidence: family.confidence,
    standards: family.standards,
    notSupported: family.notSupported,
    transports: family.transports || {},
    platforms: family.platforms,
    notes: family.notes,
    isContactlessInterface: /PICC|Contactless|NFC/i.test(readerName),
  };
}

/**
 * The one-line answer to "can we use it?".
 *
 * Deliberately splits the answer by where the reader is plugged in, because the
 * purchased device and the tablet are two different questions.
 */
function verdictFor(family) {
  const p = family.platforms || {};
  const t = family.transports || {};
  const laptop = [p.macosPcsc, p.windowsPcsc, p.linuxPcsc];
  const laptopOk = laptop.some((v) => v === "yes" || v === "likely");
  const usbWorks = t.usbCcId === "no" ? false : laptopOk;

  const androidTablet =
    t.bleApdu === "yes" || t.bleApdu === "likely"
      ? "ble-apdu"
      : p.androidUsbVendorSdk === "yes"
        ? "vendor-sdk"
        : "no";

  return {
    laptopBatchWrite: usbWorks ? "yes" : "no",
    androidTablet,
    androidHidKeyboard: t.bleHid === "yes" ? "yes" : "no",
    ipadTablet: "no",
    expoAppDirect: "no",
    summary: usbWorks
      ? "Usable as a desktop batch-writing reader; " +
        (androidTablet === "ble-apdu"
          ? "a tablet app can also write over BLE APDU, but that is new native work."
          : "not usable as a tablet accessory for this app.")
      : "No USB CCID transport, so the desktop batch path does not apply.",
  };
}

/** Classifies a list of reader names and attaches a verdict to each. */
function classifyReaders(names) {
  const list = Array.isArray(names) ? names : [];
  return list.map((name) => {
    const family = classifyReaderName(name);
    return { ...family, verdict: verdictFor(family) };
  });
}

module.exports = {
  FAMILIES,
  UNKNOWN_FAMILY,
  normaliseReaderName,
  classifyReaderName,
  classifyReaders,
  verdictFor,
};
