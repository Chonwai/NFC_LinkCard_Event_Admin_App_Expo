"use strict";

/**
 * One tag, one session.
 *
 * The session deliberately takes a plain `{ reader, card }` shape (anything with
 * `read(page, length)` and `write(page, data)`) rather than importing
 * `nfc-pcsc` itself. Two reasons:
 *
 * 1. the whole write path can be tested against an in-memory tag, so bugs are
 *    found here instead of at the door with 300 badges in a box;
 * 2. `nfc-pcsc` is an optional native dependency, and nothing above this layer
 *    should fail to load because it is missing.
 *
 * Read-back verification is not optional. A tag that accepted a write but kept
 * old bytes looks identical to a success until someone taps it.
 */

const {
  encodeUriTlv,
  extractNdefFromTlv,
  decodeUriMessage,
} = require("./ndef");
const {
  CC_PAGE,
  FIRST_USER_PAGE,
  parseCapabilityContainer,
  planPageWrites,
  variantFromVersionByte,
  getVersionCommand,
} = require("./ntag");

class TagError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "TagError";
    this.kind = kind;
  }
}

class TagSession {
  constructor({ reader, card }) {
    if (!reader || typeof reader.read !== "function") {
      throw new TagError("no-reader", "TagSession needs a reader with read()");
    }
    this.reader = reader;
    this.card = card || null;
  }

  get uid() {
    return this.card && this.card.uid ? this.card.uid : null;
  }

  async readBytes(startPage, byteLength) {
    const padded = Math.ceil(byteLength / 4) * 4;
    const buffer = await this.reader.read(startPage, padded);
    if (!Buffer.isBuffer(buffer)) {
      throw new TagError(
        "read-failed",
        "reader.read() did not return a Buffer",
      );
    }
    if (buffer.length < byteLength) {
      throw new TagError(
        "read-failed",
        `reader returned ${buffer.length} bytes, needed ${byteLength}`,
      );
    }
    return buffer.subarray(0, byteLength);
  }

  /** Reads GET_VERSION when the transport supports it; harmless when it does not. */
  async version() {
    if (typeof this.reader.transmit !== "function") return null;
    try {
      const response = await this.reader.transmit(getVersionCommand());
      if (!Buffer.isBuffer(response) || response.length < 8) return null;
      return {
        raw: [...response.subarray(0, 8)],
        variant: variantFromVersionByte(response[6]),
      };
    } catch {
      return null;
    }
  }

  /** Reads the capability container, which is the only trustworthy capacity. */
  async identify() {
    const head = await this.readBytes(0, 16);
    const cc = head.subarray(CC_PAGE * 4, CC_PAGE * 4 + 4);
    const parsed = parseCapabilityContainer(cc);
    const version = await this.version();
    return {
      uid: this.uid,
      capabilityContainer: [...cc],
      ...parsed,
      version,
    };
  }

  /**
   * Returns the URI currently on the tag, or `null` when the user area holds no
   * NDEF TLV (a blank or never-formatted tag).
   */
  async readUri() {
    const head = await this.readBytes(FIRST_USER_PAGE, 16);
    const tagIndex = head.indexOf(0x03);
    if (tagIndex === -1) return null;

    const lengthByte = head[tagIndex + 1];
    if (lengthByte === undefined) {
      throw new TagError("truncated", "TLV length byte is missing");
    }

    let headerBytes = 2;
    let messageLength = lengthByte;
    if (lengthByte === 0xff) {
      headerBytes = 4;
      messageLength = (head[tagIndex + 2] << 8) | head[tagIndex + 3];
    }

    const total = headerBytes + messageLength + 1;
    const block = await this.readBytes(FIRST_USER_PAGE, total);
    return decodeUriMessage(extractNdefFromTlv(block)).uri;
  }

  /**
   * Writes the URI where the TLV must start (page 4), then reads it back.
   *
   * @returns {{uri: string, pages: number, bytes: number, uid: string|null}}
   */
  async writeUri(url) {
    const identity = await this.identify();
    const { tlv } = encodeUriTlv(url);
    const plan = planPageWrites(tlv, { userBytes: identity.dataAreaBytes });

    if (!plan.fits) {
      throw new TagError(
        "too-large",
        `payload needs ${plan.bytes} bytes but this ${identity.variant} only has ${plan.capacityBytes}`,
      );
    }

    for (const { page, data } of plan.pages) {
      await this.reader.write(page, data);
    }

    const written = await this.readBytes(FIRST_USER_PAGE, plan.bytes);
    // The plan pads the TLV to a whole number of pages, so the expectation has
    // to be padded the same way — comparing against the raw TLV would fail on
    // the trailing zeroes every single time.
    const expected = Buffer.alloc(plan.bytes);
    tlv.copy(expected);
    if (!written.equals(expected)) {
      throw new TagError(
        "verify-failed",
        "read-back bytes do not match what was written",
      );
    }

    const readBack = decodeUriMessage(extractNdefFromTlv(written)).uri;
    if (readBack !== url) {
      throw new TagError(
        "verify-failed",
        `read-back URI is "${readBack}", expected "${url}"`,
      );
    }

    return {
      uri: readBack,
      pages: plan.requiredPages,
      bytes: plan.bytes,
      uid: this.uid,
      variant: identity.variant,
    };
  }
}

module.exports = { TagSession, TagError };
