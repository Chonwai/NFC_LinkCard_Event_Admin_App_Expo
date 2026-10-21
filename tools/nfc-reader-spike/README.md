# nfc-reader-spike

Gate 1 hardware check for the LinkCard NFC badge pipeline: **can this reader and
this machine actually write an NTAG215 badge, and can we prove it?**

This is a standalone Node CLI, not app code. It exists because
`docs/research/14-nfc-hardware-and-batch-write-research.md` left Gate 1 unrun,
and because "the reader works" is a claim that needs bytes behind it.

## Why not just use the app?

The Event Admin App writes badges with `react-native-nfc-manager`, i.e. the
**tablet's built-in NFC**. It has no code path for an external USB reader, and
cannot get one: the library talks to Android's `NfcAdapter` and iOS CoreNFC
sessions only. A USB reader is a desktop tool.

## Run it (3 minutes)

```bash
cd LinkCard_Event_Admin_App_Expo/tools/nfc-reader-spike
npm install                      # builds the PC/SC native binding

node bin/spike.js doctor         # is this machine able to do PC/SC at all?
node bin/spike.js readers        # plug the reader in first: what did macOS see?
```

Then, with a tag on the reader:

```bash
node bin/spike.js read                                   # UID + variant + current URI
node bin/spike.js write --url https://linkcard.xyz/t/EVT1/04A1B2C3D4E5F6
node bin/spike.js write --url https://linkcard.xyz/t/EVT1/04A1B2C3D4E5F6 --yes
```

`write` is a **dry run unless `--yes` is passed**: it prints the exact page plan
first. When it does write, it reads the bytes back and refuses to report success
unless the URI on the tag matches what was asked for.

## Commands

| Command   | Question it answers                                     | Non-zero exit means                      |
| --------- | ------------------------------------------------------- | ---------------------------------------- |
| `doctor`  | Is Node, PC/SC and the native binding usable here?      | something in the toolchain is missing    |
| `readers` | Is the purchased reader enumerated, and what is it?     | no PC/SC reader was seen                 |
| `read`    | Does the reader see the tag, and what is already on it? | no tag, or tag not NDEF formatted        |
| `write`   | Would this payload fit, and does it verify?             | payload too large, or read-back mismatch |

All commands accept `--json` for evidence capture, and `--timeout <seconds>`
(tag wait) / `--reader-timeout <seconds>`.

## Tests

```bash
npm test        # 42 tests, no hardware and no native build required
```

The write path is tested against an **in-memory NTAG21x** (`tests/tag-session.test.js`),
so byte layout, page alignment, capacity refusal and read-back verification are
all covered before a reader is plugged in.

## What this does not do (yet)

- It is not the batch writer. CSV in → many badges out, retry, backend
  `/nfc/batch/:id/complete` reporting is still WP-N1.
- It does not touch the backend and does not read any secret.
- It only writes the single-record URI payload LinkCard uses.

## Reading the result

| `readers` says                               | Meaning                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ACS ACR1252U ...` (or another known family) | PC/SC path is live; go straight to `read`                                             |
| `generic-pcsc`                               | It enumerates, which is the hard part; measure `read` before trusting it              |
| `0 found`                                    | Either not plugged in, or it is not a PC/SC device (Bluetooth/serial readers are not) |
