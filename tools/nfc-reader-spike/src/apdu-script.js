"use strict";

/**
 * Turns a badge URL into an APDU script the vendor app can replay.
 *
 * Why this exists: the tablet has no NFC radio, and the vendor app's NDEF tab
 * does not write tags — it stores a record in the reader for emulation. What
 * the app *can* do is send arbitrary APDU, and the ACR1555U Reference Manual
 * (v2.02 §5.5.4.1) defines the pass-through that reaches a tag in the field:
 *
 *     FF 00 00 00 <Lc> <ISO14443 command>
 *
 * So the tablet path is: generate the NTAG page writes once on the laptop,
 * then replay them on the tablet. That is far less work than a native module,
 * and it uses only documented behaviour.
 *
 * What is NOT verified: the exact file format the app's "select script file"
 * picker expects. Plain one-APDU-per-line hex is the least surprising guess and
 * is also what a human can paste into the APDU input box by hand.
 */

const { encodeUriTlv } = require("./ndef");
const {
  FIRST_USER_PAGE,
  NDEF_CAPACITY_BYTES,
  PAGE_SIZE,
  getVersionCommand,
  planPageWrites,
  readPageCommand,
  writePageCommand,
} = require("./ntag");

// `FF 00 00 00 <Lc>` is a vendor pseudo-APDU: FF is the CLA, and the two
// zero bytes are P1/P2. Naming them CLA/INS invites a "fix" in the wrong place.
const PASS_THROUGH_CLA = 0xff;
const PASS_THROUGH_P1 = 0x00;
const PASS_THROUGH_P2 = 0x00;

function toHex(buffer) {
  return buffer
    .toString("hex")
    .toUpperCase()
    .replace(/(..)(?=.)/g, "$1 ");
}

/**
 * Wraps a native ISO 14443 command in the reader's pass-through APDU.
 *
 * @param {Buffer} command e.g. `A2 04 ...` or `60`
 * @returns {Buffer} `FF 00 00 00 <Lc> <command>`
 */
function passThrough(command) {
  if (!Buffer.isBuffer(command) || command.length === 0) {
    throw new Error("passThrough expects a non-empty command Buffer");
  }
  if (command.length > 0xff) {
    throw new Error(`command too long for one APDU: ${command.length} bytes`);
  }
  return Buffer.concat([
    Buffer.from([
      PASS_THROUGH_CLA,
      PASS_THROUGH_P1,
      PASS_THROUGH_P2,
      0x00,
      command.length,
    ]),
    command,
  ]);
}

/**
 * Builds the full replay script for one badge URL.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {"NTAG213"|"NTAG215"|"NTAG216"} [options.variant]
 * @param {boolean} [options.selfTest]  prepend GET_VERSION (default true)
 * @param {boolean} [options.verify]    append a read-back of the first pages
 * @returns {{lines: string[], steps: object[], fitted: boolean, bytes: number,
 *            capacityBytes: number, pages: number, variant: string}}
 */
function buildScript(url, options = {}) {
  const variant = options.variant || "NTAG215";
  const capacityBytes = NDEF_CAPACITY_BYTES[variant];
  if (!capacityBytes) {
    throw new Error(`unknown NTAG variant: ${variant}`);
  }

  const { tlv } = encodeUriTlv(url);
  const plan = planPageWrites(tlv, {
    startPage: FIRST_USER_PAGE,
    userBytes: capacityBytes,
  });

  const steps = [];

  if (options.selfTest !== false) {
    steps.push({
      kind: "self-test",
      apdu: passThrough(getVersionCommand()),
      note: "GET_VERSION — proves the reader is relaying to a tag at all",
    });
  }

  for (const page of plan.pages) {
    steps.push({
      kind: "write",
      apdu: passThrough(writePageCommand(page.page, page.data)),
      note: `WRITE page ${page.page}`,
    });
  }

  if (options.verify !== false) {
    // One READ returns 4 pages; asking for the first few is enough to show the
    // TLV header and the start of the URI.
    const readPages = Math.min(plan.requiredPages, 4);
    steps.push({
      kind: "verify",
      apdu: passThrough(readPageCommand(FIRST_USER_PAGE)),
      note: `READ pages ${FIRST_USER_PAGE}..${FIRST_USER_PAGE + readPages - 1} — compare with the payload`,
    });
  }

  return {
    variant,
    bytes: plan.bytes,
    capacityBytes: plan.capacityBytes,
    pages: plan.requiredPages,
    fitted: plan.fits,
    overflow: !plan.fits,
    steps,
    lines: steps.map((step) => toHex(step.apdu)),
  };
}

/**
 * Renders a script for humans: the same APDUs, with the reason above each one.
 *
 * @param {ReturnType<typeof buildScript>} script
 * @param {{comments?: boolean}} [options]
 * @returns {string}
 */
function renderScript(script, options = {}) {
  const withComments = options.comments !== false;
  const lines = [];
  if (script.overflow) {
    // A script that cannot fit must never look sendable, even to someone who
    // calls the library directly instead of going through the CLI.
    lines.push(
      "###############################################################",
      "# DO NOT SEND — payload does not fit this chip.",
      `# needs ${script.bytes} bytes, ${script.variant} holds ${script.capacityBytes}.`,
      "# Writes past the end of user memory will be rejected at best;",
      "# use a bigger tag or a shorter URL. Shown for inspection only.",
      "###############################################################",
      "",
    );
  }
  if (withComments) {
    lines.push(
      `# ACR1555U badge script — ${script.variant}, ${script.bytes} bytes over ${script.pages} pages`,
    );
    lines.push(
      "# Paste each line into the app's APDU input box, or save this file and load it.",
    );
    lines.push(
      "# Format: FF 00 00 00 <Lc> <ISO14443 command> (Reference Manual §5.5.4.1)",
    );
    lines.push("");
  }
  for (let i = 0; i < script.steps.length; i += 1) {
    if (withComments) {
      lines.push(`# ${i + 1}) ${script.steps[i].note}`);
    }
    lines.push(script.lines[i]);
  }
  return lines.join("\n") + "\n";
}

module.exports = {
  buildScript,
  renderScript,
  passThrough,
  toHex,
};
