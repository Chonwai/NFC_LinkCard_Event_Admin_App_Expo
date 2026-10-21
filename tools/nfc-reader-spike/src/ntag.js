"use strict";

/**
 * NTAG21x page-level helpers.
 *
 * The gap this closes: "we wrote the card" is not verifiable unless we can say
 * exactly which pages were written and how many bytes the chip claims to have.
 * Everything here is pure so the plan can be reviewed before a single byte
 * reaches hardware.
 *
 * Memory map that matters (NTAG213/215/216, ISO 14443-A Type 2 Tag):
 *
 *   page 0-1  UID + BCC (read only)
 *   page 2    internal + lock bytes
 *   page 3    Capability Container: E1 10 (userBytes/8) 00
 *   page 4..  user memory, where the NDEF TLV starts
 *
 * `docs/research/14-nfc-hardware-and-batch-write-research.md` §2.2 places the
 * capability container on page 4; that is one page too late. The CC is page 3,
 * which is easy to confirm by reading pages 0..4 on a real tag (this CLI does).
 */

/**
 * Writable data area per variant, as the capability container reports it.
 *
 * Note these are 8 bytes smaller than the datasheet "user memory" figures
 * (504 for NTAG215, 888 for NTAG216): the CC encodes the data area available to
 * NDEF, which is what a writer must respect. Trusting 504 would overrun the
 * area the chip advertises.
 */
const NDEF_CAPACITY_BYTES = {
  NTAG213: 144,
  NTAG215: 496,
  NTAG216: 872,
};

/** GET_VERSION storage-size byte -> variant. */
const VERSION_STORAGE_BYTE = {
  0x0f: "NTAG213",
  0x11: "NTAG215",
  0x13: "NTAG216",
};

const CC_PAGE = 3;
const FIRST_USER_PAGE = 4;
const PAGE_SIZE = 4;

/** READ (0x30) returns four pages starting at the requested page. */
function readPageCommand(page) {
  if (!Number.isInteger(page) || page < 0 || page > 0xff) {
    throw new Error(`invalid page for READ: ${page}`);
  }
  return Buffer.from([0x30, page]);
}

/** WRITE (0xA2) always writes exactly one 4-byte page. */
function writePageCommand(page, bytes) {
  if (!Number.isInteger(page) || page < FIRST_USER_PAGE) {
    throw new Error(
      `refusing to WRITE page ${page}: user memory starts at page ${FIRST_USER_PAGE}`,
    );
  }
  if (!Buffer.isBuffer(bytes) || bytes.length !== PAGE_SIZE) {
    throw new Error(`WRITE needs exactly ${PAGE_SIZE} bytes per page`);
  }
  return Buffer.concat([Buffer.from([0xa2, page]), bytes]);
}

/** GET_VERSION (0x60) identifies the chip family. */
function getVersionCommand() {
  return Buffer.from([0x60]);
}

/** Splits an APDU response into data + status word. */
function stripStatusWord(response) {
  if (!Buffer.isBuffer(response) || response.length < 2) {
    throw new Error("response must be a Buffer with a status word");
  }
  const data = response.subarray(0, response.length - 2);
  const sw1 = response[response.length - 2];
  const sw2 = response[response.length - 1];
  return { data, sw1, sw2, ok: sw1 === 0x90 && sw2 === 0x00 };
}

/** Parses the 4-byte capability container. */
function parseCapabilityContainer(cc) {
  if (!Buffer.isBuffer(cc) || cc.length !== 4) {
    throw new Error("capability container must be 4 bytes");
  }
  if (cc[0] !== 0xe1) {
    throw new Error(
      `tag is not NDEF formatted (CC0=0x${cc[0].toString(16)}, expected 0xe1)`,
    );
  }
  const userBytes = cc[2] * 8;
  return {
    majorVersion: cc[1] >> 4,
    minorVersion: cc[1] & 0x0f,
    dataAreaBytes: userBytes,
    readAccess: cc[3] >> 4,
    writeAccess: cc[3] & 0x0f,
    variant: variantFromUserBytes(userBytes),
  };
}

function variantFromUserBytes(userBytes) {
  const match = Object.entries(NDEF_CAPACITY_BYTES).find(
    ([, bytes]) => bytes === userBytes,
  );
  return match ? match[0] : "unknown";
}

function variantFromVersionByte(storageByte) {
  return VERSION_STORAGE_BYTE[storageByte] || "unknown";
}

/**
 * Turns a TLV block into the exact page writes needed to store it.
 *
 * Returns `fits: false` instead of throwing when the payload is too large: the
 * caller may want to report "this needs NTAG215, not NTAG213" rather than fail.
 */
function planPageWrites(
  tlv,
  { startPage = FIRST_USER_PAGE, userBytes = 0 } = {},
) {
  if (!Buffer.isBuffer(tlv) || tlv.length === 0) {
    throw new Error("planPageWrites expects a non-empty Buffer");
  }
  const padded = Buffer.alloc(Math.ceil(tlv.length / PAGE_SIZE) * PAGE_SIZE);
  tlv.copy(padded);

  const pages = [];
  for (let offset = 0; offset < padded.length; offset += PAGE_SIZE) {
    pages.push({
      page: startPage + offset / PAGE_SIZE,
      data: padded.subarray(offset, offset + PAGE_SIZE),
    });
  }

  const capacity = userBytes || NDEF_CAPACITY_BYTES.NTAG215;
  return {
    fits: padded.length <= capacity,
    bytes: padded.length,
    pages,
    requiredPages: pages.length,
    capacityBytes: capacity,
    capacityPages: Math.floor(capacity / PAGE_SIZE),
  };
}

module.exports = {
  NDEF_CAPACITY_BYTES,
  CC_PAGE,
  FIRST_USER_PAGE,
  PAGE_SIZE,
  readPageCommand,
  writePageCommand,
  getVersionCommand,
  stripStatusWord,
  parseCapabilityContainer,
  variantFromUserBytes,
  variantFromVersionByte,
  planPageWrites,
};
