"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { TagSession, TagError } = require("../src/tag-session");
const { encodeUriTlv } = require("../src/ndef");

const BADGE_URL = "https://linkcard.xyz/t/EVT1/04A1B2C3D4E5F6";

/**
 * A fake NTAG21x that stores pages in a Buffer and answers read/write the same
 * way `nfc-pcsc` does. This is what lets the write path be tested at all before
 * a reader is plugged in.
 */
function createFakeTag({
  cc = [0xe1, 0x10, 0x3e, 0x00],
  totalPages = 135,
  dropWrites = false,
} = {}) {
  const memory = Buffer.alloc(totalPages * 4);
  Buffer.from([0x04, 0xa2, 0xb3, 0xc4]).copy(memory, 0);
  Buffer.from(cc).copy(memory, 12);

  const reads = [];
  const writes = [];
  const reader = {
    async read(page, length) {
      reads.push({ page, length });
      const start = page * 4;
      return Buffer.from(memory.subarray(start, start + length));
    },
    async write(page, data) {
      writes.push({ page, data: [...data] });
      if (!dropWrites) Buffer.from(data).copy(memory, page * 4);
    },
  };
  return { memory, reader, reads, writes };
}

test("identifies the tag from its capability container, not from its name", async () => {
  const { reader } = createFakeTag();
  const session = new TagSession({ reader, card: { uid: "04a2b3c4" } });

  const identity = await session.identify();
  assert.equal(identity.variant, "NTAG215");
  assert.equal(identity.dataAreaBytes, 496);
  assert.equal(identity.uid, "04a2b3c4");
  assert.deepEqual(identity.capabilityContainer, [0xe1, 0x10, 0x3e, 0x00]);
});

test("reads a blank tag as empty rather than as an error", async () => {
  const { reader } = createFakeTag();
  const session = new TagSession({ reader });
  assert.equal(await session.readUri(), null);
});

test("writes the URI starting at page 4 and reads it back", async () => {
  const { reader, writes, memory } = createFakeTag();
  const session = new TagSession({ reader, card: { uid: "04a2b3c4" } });

  const result = await session.writeUri(BADGE_URL);

  assert.equal(result.uri, BADGE_URL);
  assert.equal(result.pages, 11, "42-byte TLV rounds up to 11 pages");
  assert.equal(result.bytes, 44);
  assert.equal(writes[0].page, 4);
  assert.deepEqual(writes[0].data, [0x03, 0x27, 0xd1, 0x01]);
  assert.equal(await session.readUri(), BADGE_URL);
  assert.equal(memory[16], 0x03, "TLV must live at the start of user memory");
});

test("re-writing the same URL is idempotent", async () => {
  const { reader } = createFakeTag();
  const session = new TagSession({ reader });

  const first = await session.writeUri(BADGE_URL);
  const second = await session.writeUri(BADGE_URL);

  assert.equal(first.pages, second.pages);
  assert.equal(await session.readUri(), BADGE_URL);
});

test("overwrites a tag that already holds someone else's URI", async () => {
  const { reader, memory } = createFakeTag();
  encodeUriTlv("https://old.example.com/legacy").tlv.copy(memory, 16);
  const session = new TagSession({ reader });

  assert.equal(await session.readUri(), "https://old.example.com/legacy");
  await session.writeUri(BADGE_URL);
  assert.equal(await session.readUri(), BADGE_URL);
});

test("fails loudly when the write did not stick", async () => {
  const { reader } = createFakeTag({ dropWrites: true });
  const session = new TagSession({ reader });

  await assert.rejects(
    () => session.writeUri(BADGE_URL),
    (error) => {
      assert.ok(error instanceof TagError);
      assert.equal(error.kind, "verify-failed");
      return true;
    },
  );
});

test("refuses a payload bigger than the tag and says which variant it found", async () => {
  const { reader } = createFakeTag({ cc: [0xe1, 0x10, 0x12, 0x00] });
  const session = new TagSession({ reader });
  const longUrl = `https://${"e".repeat(200)}`;

  await assert.rejects(
    () => session.writeUri(longUrl),
    (error) => {
      assert.equal(error.kind, "too-large");
      assert.match(error.message, /NTAG213/);
      assert.match(error.message, /144/);
      return true;
    },
  );
});

test("refuses a tag that is not NDEF formatted", async () => {
  const { reader } = createFakeTag({ cc: [0x00, 0x00, 0x00, 0x00] });
  const session = new TagSession({ reader });
  await assert.rejects(() => session.identify(), /not NDEF formatted/);
});

test("surfaces a short read instead of padding it silently", async () => {
  const reader = {
    async read() {
      return Buffer.alloc(4);
    },
  };
  const session = new TagSession({ reader });
  await assert.rejects(() => session.readBytes(4, 16), /needed 16/);
});

test("treats GET_VERSION as optional", async () => {
  const { reader } = createFakeTag();
  assert.equal(await new TagSession({ reader }).version(), null);

  const withVersion = {
    ...reader,
    async transmit() {
      return Buffer.from([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03]);
    },
  };
  const version = await new TagSession({ reader: withVersion }).version();
  assert.equal(version.variant, "NTAG215");
});

test("requires a reader", () => {
  assert.throws(() => new TagSession({}), /needs a reader/);
});
