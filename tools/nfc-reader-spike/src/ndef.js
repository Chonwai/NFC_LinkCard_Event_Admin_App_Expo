"use strict";

/**
 * Minimal NDEF writer/reader for a single URI record.
 *
 * LinkCard only ever puts one well-known URI record on a badge, so this module
 * deliberately implements exactly that and refuses everything else loudly
 * instead of pretending to be a general NDEF library. That keeps the bytes
 * auditable, which matters because a wrong payload is only discovered at the
 * gate when a badge fails to open.
 *
 * Layout produced for `https://linkcard.xyz/t/EV/UID`:
 *
 *   03 2C                       TLV tag + length (short form)
 *   D1 01 28 55                 record header, type length, payload length, 'U'
 *   04                          URI prefix code -> "https://"
 *   6C 69 6E 6B ...             "linkcard.xyz/t/EV/UID"
 *   FE                          terminator
 */

/** NFC Forum URI Record Type Definition prefix table (0x00–0x23). */
const URI_PREFIXES = [
  "",
  "http://www.",
  "https://www.",
  "http://",
  "https://",
  "tel:",
  "mailto:",
  "ftp://anonymous:anonymous@",
  "ftp://ftp.",
  "ftps://",
  "sftp://",
  "smb://",
  "nfs://",
  "ftp://",
  "dav://",
  "news:",
  "telnet://",
  "imap:",
  "rtsp://",
  "urn:",
  "pop:",
  "sip:",
  "sips:",
  "tftp:",
  "btspp://",
  "btl2cap://",
  "btgoep://",
  "tcpobex://",
  "irdaobex://",
  "file://",
  "urn:epc:id:",
  "urn:epc:tag:",
  "urn:epc:pat:",
  "urn:epc:raw:",
  "urn:epc:",
  "urn:nfc:",
];

const TNF_WELL_KNOWN = 0x01;
const TYPE_URI = 0x55; // 'U'
const TLV_NDEF = 0x03;
const TLV_TERMINATOR = 0xfe;

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

/**
 * Chooses the longest prefix that still matches, which is what the NFC Forum
 * intends: `https://www.x` must become 0x02, not 0x04 + "www.x".
 */
function pickUriPrefix(url) {
  let bestCode = 0;
  for (let code = 1; code < URI_PREFIXES.length; code += 1) {
    const prefix = URI_PREFIXES[code];
    if (
      url.startsWith(prefix) &&
      prefix.length > URI_PREFIXES[bestCode].length
    ) {
      bestCode = code;
    }
  }
  return { code: bestCode, rest: url.slice(URI_PREFIXES[bestCode].length) };
}

/** Encodes one URI as a complete NDEF message (record header included). */
function encodeUriMessage(url) {
  assertNonEmptyString(url, "url");

  const { code, rest } = pickUriPrefix(url);
  const restBytes = Buffer.from(rest, "utf8");
  const payload = Buffer.concat([Buffer.from([code]), restBytes]);

  const shortRecord = payload.length < 0x100;
  const header = shortRecord ? 0xd1 : 0xc1;
  const lengthField = shortRecord
    ? Buffer.from([payload.length])
    : (() => {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32BE(payload.length, 0);
        return buffer;
      })();

  return Buffer.concat([
    Buffer.from([header, 0x01]),
    lengthField,
    Buffer.from([TYPE_URI]),
    payload,
  ]);
}

/** Wraps an NDEF message in a Type 2 Tag TLV (tag, length, message, FE). */
function encodeTlv(message) {
  if (!Buffer.isBuffer(message)) {
    throw new Error("encodeTlv expects a Buffer");
  }
  const header =
    message.length < 0xff
      ? Buffer.from([TLV_NDEF, message.length])
      : Buffer.from([
          TLV_NDEF,
          0xff,
          message.length >> 8,
          message.length & 0xff,
        ]);
  return Buffer.concat([header, message, Buffer.from([TLV_TERMINATOR])]);
}

/** Extracts the NDEF message from a Type 2 Tag TLV block. */
function extractNdefFromTlv(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("extractNdefFromTlv expects a Buffer");
  }
  const start = buffer.indexOf(TLV_NDEF);
  if (start === -1) {
    throw new Error("no NDEF TLV (0x03) found in tag data");
  }
  const first = buffer[start + 1];
  if (first === undefined) {
    throw new Error("truncated TLV: missing length byte");
  }
  let length = first;
  let offset = start + 2;
  if (first === 0xff) {
    const high = buffer[start + 2];
    const low = buffer[start + 3];
    if (high === undefined || low === undefined) {
      throw new Error("truncated TLV: 3-byte length form is incomplete");
    }
    length = (high << 8) | low;
    offset = start + 4;
  }
  const end = offset + length;
  if (end > buffer.length) {
    throw new Error(
      `truncated NDEF message: TLV claims ${length} bytes, only ${buffer.length - offset} available`,
    );
  }
  return buffer.subarray(offset, end);
}

/**
 * Decodes a single-record URI message.
 *
 * Throws on anything that is not exactly one well-known 'U' record, because a
 * silently-ignored second record is how "it looked like it wrote" bugs start.
 */
function decodeUriMessage(message) {
  if (!Buffer.isBuffer(message) || message.length < 3) {
    throw new Error("decodeUriMessage expects a Buffer with at least 3 bytes");
  }
  const header = message[0];
  const tnf = header & 0x07;
  const isShort = (header & 0x10) !== 0;
  const hasIdLength = (header & 0x08) !== 0;
  const typeLength = message[1];
  let cursor = 2;
  let payloadLength;
  if (isShort) {
    payloadLength = message[cursor];
    cursor += 1;
  } else {
    payloadLength = message.readUInt32BE(cursor);
    cursor += 4;
  }
  if (hasIdLength) {
    cursor += 1; // ID length byte
  }
  const type = message.subarray(cursor, cursor + typeLength);
  cursor += typeLength;
  const payload = message.subarray(cursor, cursor + payloadLength);
  if (payload.length !== payloadLength) {
    throw new Error(
      `truncated payload: header claims ${payloadLength} bytes, got ${payload.length}`,
    );
  }

  if (tnf !== TNF_WELL_KNOWN || type.length !== 1 || type[0] !== TYPE_URI) {
    throw new Error(
      `unsupported record: expected well-known URI ('U'), got TNF=${tnf} type=${type.toString("hex")}`,
    );
  }

  const prefixCode = payload[0];
  const prefix = URI_PREFIXES[prefixCode];
  if (prefix === undefined) {
    throw new Error(`unknown URI prefix code 0x${prefixCode.toString(16)}`);
  }
  return {
    uri: prefix + payload.subarray(1).toString("utf8"),
    prefixCode,
    // Count of bytes that were saved by prefix compression, useful in reports.
    compressedBytes: prefix.length - 1,
  };
}

/** Convenience: whole pipeline from a URL to the bytes that go on the tag. */
function encodeUriTlv(url) {
  const message = encodeUriMessage(url);
  const tlv = encodeTlv(message);
  return { message, tlv };
}

module.exports = {
  URI_PREFIXES,
  pickUriPrefix,
  encodeUriMessage,
  encodeTlv,
  encodeUriTlv,
  extractNdefFromTlv,
  decodeUriMessage,
};
