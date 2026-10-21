#!/usr/bin/env node
"use strict";

/**
 * Gate 1 spike CLI.
 *
 * The point of this file is to answer three questions with measurements rather
 * than opinions:
 *
 *   readers  is the purchased reader enumerated as a PC/SC reader at all?
 *   doctor   is this machine able to talk PC/SC, independent of the reader?
 *   read     (later) does the reader see an NTAG215 and can it read its NDEF?
 *   write    (later) can it write a URL and read that URL back byte for byte?
 *
 * Hardware only enters through `nfc-pcsc`, and only through `loadNfcPcsc()`,
 * so the CLI still prints a useful answer when the native module is missing.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { classifyReaders } = require("../src/reader-model");
const { encodeUriTlv } = require("../src/ndef");
const { planPageWrites } = require("../src/ntag");
const { TagSession } = require("../src/tag-session");

const DIM = "\u001b[2m";
const BOLD = "\u001b[1m";
const RED = "\u001b[31m";
const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const RESET = "\u001b[0m";

const useColour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code, text) => (useColour ? `${code}${text}${RESET}` : text);
const dim = (text) => paint(DIM, text);
const bold = (text) => paint(BOLD, text);

/** Resolves `nfc-pcsc` lazily so a missing native build is a message, not a stack. */
function loadNfcPcsc() {
  try {
    return { module: require("nfc-pcsc") };
  } catch (error) {
    const code = error && error.code;
    return {
      error:
        code === "MODULE_NOT_FOUND"
          ? "nfc-pcsc is not installed — run `npm install` inside tools/nfc-reader-spike"
          : `nfc-pcsc failed to load (${code || "unknown"}): ${error.message}`,
    };
  }
}

/** True when `name` is an executable found on PATH. */
function hasBinary(name) {
  const separator = process.platform === "win32" ? ";" : ":";
  const dirs = (process.env.PATH || "").split(separator).filter(Boolean);
  return dirs.some((dir) => {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Collects reader names from PC/SC.
 *
 * PC/SC has no "listing finished" event: readers announce themselves as they are
 * discovered, so the only honest way to enumerate is to listen for a short,
 * bounded window.
 */
function collectReaderNames({ timeoutMs = 1200 } = {}) {
  const { module, error } = loadNfcPcsc();
  if (error) return Promise.resolve({ names: [], error });

  return new Promise((resolve) => {
    const names = [];
    let settled = false;
    const nfc = new module.NFC();

    const finish = (failure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (typeof nfc.close === "function") nfc.close();
      } catch {
        // Closing a readerless NFC instance is allowed to fail quietly.
      }
      resolve({ names, error: failure });
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    nfc.on("reader", (reader) => {
      names.push(reader.name);
      // A reader that errors during enumeration is still a discovered reader;
      // its fault should not hide the fact that it enumerated.
      reader.on("error", () => {});
    });

    nfc.on("error", (failure) => {
      finish(failure && failure.message ? failure.message : String(failure));
    });
  });
}

function describeHost() {
  return {
    os: `${os.type()} ${os.release()}`,
    arch: process.arch,
    node: process.version,
  };
}

function printReader(entry, index) {
  const lines = [];
  lines.push(
    `${bold(`[${index + 1}] ${entry.readerName || "(unnamed reader)"}`)}`,
  );
  lines.push(`    family      ${entry.familyLabel} (${entry.familyId})`);
  lines.push(`    vendor      ${entry.vendor}`);
  lines.push(`    confidence  ${entry.confidence}`);
  lines.push(
    `    contactless ${entry.isContactlessInterface ? "yes (PICC interface)" : "not reported in the name"}`,
  );
  if (entry.standards.length) {
    lines.push(`    standards   ${entry.standards.join("\n                ")}`);
  }
  if (entry.notSupported.length) {
    lines.push(
      `    missing     ${entry.notSupported.join("\n                ")}`,
    );
  }
  const verdict = entry.verdict;
  lines.push(
    `    verdict     laptop batch-write: ${verdict.laptopBatchWrite} | ` +
      `android tablet: ${verdict.androidTablet} | ipad: ${verdict.ipadTablet} | ` +
      `this app: ${verdict.expoAppDirect}`,
  );
  if (entry.notes.length) {
    lines.push(`    notes       ${entry.notes.join("\n                ")}`);
  }
  return lines.join("\n");
}

async function commandReaders(argv) {
  const asJson = argv.includes("--json");
  const { names, error } = await collectReaderNames();

  if (asJson) {
    const payload = {
      host: describeHost(),
      readers: classifyReaders(names),
      error: error || null,
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return error ? 1 : 0;
  }

  const host = describeHost();
  console.log(bold("NFC Gate 1 — reader report"));
  console.log(dim(`host       ${host.os} ${host.arch}, node ${host.node}`));

  if (error) {
    console.log(paint(RED, `error      ${error}`));
    return 1;
  }
  if (!names.length) {
    console.log(paint(YELLOW, "readers    0 found"));
    console.log(
      dim(
        "           Plug the reader in, then re-run. On macOS also check:\n" +
          "           system_profiler SPUSBDataType | grep -i -A8 'smart\\|CCID\\|ACR\\|NFC'",
      ),
    );
    return 1;
  }

  console.log(`readers    ${names.length} found`);
  classifyReaders(names).forEach((entry, index) => {
    console.log("");
    console.log(printReader(entry, index));
  });
  return 0;
}

async function commandDoctor(argv) {
  const asJson = argv.includes("--json");
  const host = describeHost();
  const { names, error } = await collectReaderNames();
  const nfcPcsc = loadNfcPcsc();

  const checks = [
    {
      name: "node >= 20",
      pass: Number(process.versions.node.split(".")[0]) >= 20,
      detail: host.node,
    },
    {
      name: "pcsc test tool present",
      pass: hasBinary("pcsctest") || hasBinary("pcsc_scan"),
      detail: hasBinary("pcsctest")
        ? "/usr/bin/pcsctest (built into macOS)"
        : hasBinary("pcsc_scan")
          ? "pcsc_scan"
          : "none — PC/SC stack may be absent",
    },
    {
      name: "nfc-pcsc loadable",
      pass: !nfcPcsc.error,
      detail: nfcPcsc.error || "ok",
    },
    {
      name: "reader enumerated",
      pass: names.length > 0,
      detail: error || `${names.length} reader(s)`,
    },
  ];

  const gate = names.length > 0 && !nfcPcsc.error ? "PASS" : "BLOCKED";

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify({ host, checks, gate, readers: classifyReaders(names) }, null, 2)}\n`,
    );
    return gate === "PASS" ? 0 : 1;
  }

  console.log(bold("NFC Gate 1 — environment doctor"));
  console.log(dim(`host       ${host.os} ${host.arch}, node ${host.node}`));
  console.log("");
  for (const check of checks) {
    const mark = check.pass ? paint(GREEN, "PASS") : paint(RED, "FAIL");
    console.log(`  ${mark}  ${check.name.padEnd(24)} ${dim(check.detail)}`);
  }
  console.log("");
  console.log(
    `  gate       ${gate === "PASS" ? paint(GREEN, gate) : paint(YELLOW, gate)}`,
  );
  if (gate !== "PASS") {
    console.log(
      dim(
        "             A BLOCKED gate here is an environment answer, not a device\n" +
          "             answer: fix the FAIL lines first, then re-run `readers`.",
      ),
    );
  }
  return gate === "PASS" ? 0 : 1;
}

function usage() {
  console.log(`${bold("nfc spike")} — LinkCard NFC Gate 1 checks

  node bin/spike.js readers [--json]      list PC/SC readers and classify them
  node bin/spike.js doctor  [--json]      check this machine's PC/SC toolchain
  node bin/spike.js read    [--json]      tap a tag, print UID + variant + URI
  node bin/spike.js write --url <url>     show the page plan for this tag (dry run)
  node bin/spike.js write --url <url> --yes    write it, then read it back

Common options: --timeout <seconds> (tag wait, default 30)
                --reader-timeout <seconds> (default 15)
Exit codes: 0 = the checked question is a yes, 1 = no (or an error was reported).
`);
}

function readOption(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function timeoutMsFrom(argv, fallbackSeconds = 30) {
  const raw = readOption(argv, "--timeout");
  const seconds = raw === undefined ? fallbackSeconds : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(
      `--timeout must be a positive number of seconds, got "${raw}"`,
    );
  }
  return seconds * 1000;
}

function readerTimeoutMsFrom(argv, fallbackSeconds = 15) {
  const raw = readOption(argv, "--reader-timeout");
  const seconds = raw === undefined ? fallbackSeconds : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(
      `--reader-timeout must be a positive number of seconds, got "${raw}"`,
    );
  }
  return seconds * 1000;
}

/**
 * Opens the first available reader and runs `handler` against it, then releases
 * PC/SC. A reader appearing is an event, so "is one there?" can only be answered
 * by waiting a bounded amount of time.
 */
function withReader(timeoutMs, handler) {
  const { module, error } = loadNfcPcsc();
  if (error) return Promise.reject(new Error(error));

  return new Promise((resolve, reject) => {
    const nfc = new module.NFC();
    let settled = false;

    const release = () => {
      try {
        if (typeof nfc.close === "function") nfc.close();
      } catch {
        // Releasing a reader that never fully opened is allowed to fail.
      }
    };

    const fail = (failure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      release();
      reject(failure instanceof Error ? failure : new Error(String(failure)));
    };

    const timer = setTimeout(
      () =>
        fail(
          new Error(
            `no PC/SC reader appeared within ${timeoutMs}ms — plug the reader in, then run \`node bin/spike.js readers\``,
          ),
        ),
      timeoutMs,
    );

    nfc.on("error", fail);

    nfc.on("reader", (reader) => {
      reader.once("error", fail);
      Promise.resolve(handler(reader))
        .then((value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          release();
          resolve(value);
        })
        .catch(fail);
    });
  });
}

/** Waits for a tag to be presented to `reader`. */
function waitForCard(reader, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      if (typeof reader.removeListener === "function") {
        reader.removeListener("card", onCard);
        reader.removeListener("error", onError);
      }
    };
    const onCard = (card) => {
      cleanup();
      resolve(card);
    };
    const onError = (failure) => {
      cleanup();
      reject(failure instanceof Error ? failure : new Error(String(failure)));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`no tag tapped within ${timeoutMs}ms`));
    }, timeoutMs);

    reader.once("card", onCard);
    reader.once("error", onError);
  });
}

function describeIdentity(identity) {
  const cc = identity.capabilityContainer
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
  const version = identity.version
    ? `, GET_VERSION says ${identity.version.variant}`
    : "";
  return `${identity.variant} (CC ${cc}, data area ${identity.dataAreaBytes} bytes${version})`;
}

async function commandRead(argv) {
  const asJson = argv.includes("--json");
  const tagTimeout = timeoutMsFrom(argv);
  const readerTimeout = readerTimeoutMsFrom(argv);

  const result = await withReader(readerTimeout, async (reader) => {
    const card = await waitForCard(reader, tagTimeout);
    const session = new TagSession({ reader, card });
    const identity = await session.identify();
    const uri = await session.readUri();
    return {
      reader: reader.name,
      cardType: card.type,
      atr: card.atr ? card.atr.toString("hex") : null,
      identity,
      uri,
    };
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  console.log(bold("NFC Gate 1 — read"));
  console.log(`reader     ${result.reader}`);
  console.log(
    `uid        ${result.identity.uid || "(reader did not report a UID)"}`,
  );
  console.log(`variant    ${describeIdentity(result.identity)}`);
  console.log(
    `ndef       ${result.uri === null ? dim("(empty — no NDEF TLV on this tag)") : result.uri}`,
  );
  return 0;
}

async function commandWrite(argv) {
  const url = readOption(argv, "--url");
  if (!url) {
    throw new Error("write needs --url <https://...>");
  }
  const apply = argv.includes("--yes");
  const asJson = argv.includes("--json");
  const tagTimeout = timeoutMsFrom(argv);
  const readerTimeout = readerTimeoutMsFrom(argv);
  const expected = encodeUriTlv(url);

  const result = await withReader(readerTimeout, async (reader) => {
    const card = await waitForCard(reader, tagTimeout);
    const session = new TagSession({ reader, card });
    const identity = await session.identify();
    const plan = planPageWrites(expected.tlv, {
      userBytes: identity.dataAreaBytes,
    });

    if (!apply) {
      return { dryRun: true, reader: reader.name, identity, url, plan };
    }
    const written = await session.writeUri(url);
    return { dryRun: false, reader: reader.name, identity, url, plan, written };
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.plan.fits ? 0 : 1;
  }

  console.log(
    bold(result.dryRun ? "NFC Gate 1 — write (dry run)" : "NFC Gate 1 — write"),
  );
  console.log(`reader     ${result.reader}`);
  console.log(`variant    ${describeIdentity(result.identity)}`);
  console.log(`url        ${result.url}`);
  console.log(
    `plan       ${result.plan.requiredPages} pages / ${result.plan.bytes} bytes ` +
      dim(`(tag holds ${result.plan.capacityPages} pages)`),
  );
  const first = result.plan.pages[0];
  console.log(
    `page ${String(first.page).padEnd(6)} ${first.data.toString("hex").match(/../g).join(" ")}   ${dim("<- TLV starts here")}`,
  );

  if (!result.plan.fits) {
    console.log(
      paint(
        RED,
        `\nREFUSED    payload does not fit this tag; nothing was written.`,
      ),
    );
    return 1;
  }
  if (result.dryRun) {
    console.log(
      dim("\nNothing written. Re-run with --yes to write and read back."),
    );
    return 0;
  }

  console.log(
    paint(
      GREEN,
      `\nVERIFIED   read back ${result.written.bytes} bytes over ${result.written.pages} pages; URI matches.`,
    ),
  );
  return 0;
}

async function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case "readers":
      return commandReaders(rest);
    case "doctor":
      return commandDoctor(rest);
    case "read":
      return commandRead(rest);
    case "write":
      return commandWrite(rest);
    case undefined:
    case "-h":
    case "--help":
    case "help":
      usage();
      return 0;
    default:
      console.error(`unknown command: ${command}`);
      usage();
      return 2;
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(paint(RED, `fatal: ${error && error.message}`));
      process.exitCode = 1;
    });
}

module.exports = { main, collectReaderNames, hasBinary };
