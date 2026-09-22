/**
 * `npm test` 的前置守衛（`F-04`）。
 *
 * 測試用 `node --test` 加 `--experimental-test-module-mocks`，該旗標需要
 * Node >= 22.3。太舊的 Node 會在**解析旗標時**就以
 * `node: bad option: --experimental-test-module-mocks` 中止（exit 9），
 * 那個訊息不會告訴任何人「你該換 Node」——而它正是本 repo 預設環境的狀態。
 *
 * 這支守衛只使用舊版 Node 也支援的語法，因此它自己一定跑得起來，能把
 * 那個晦澀的失敗換成可行動的訊息。`package.json` 的 `engines` 是**宣告**
 * （npm 會印 EBADENGINE 警告），這裡是**實際的 gate**；兩者互補。
 */
const REQUIRED = { major: 22, minor: 3 };

const current = process.versions.node;
const [major, minor] = current.split(".").map(Number);
const supported =
  major > REQUIRED.major ||
  (major === REQUIRED.major && minor >= REQUIRED.minor);

if (!supported) {
  console.error(
    [
      "",
      `npm test 需要 Node >= ${REQUIRED.major}.${REQUIRED.minor}，目前是 v${current}。`,
      "",
      "測試使用 node --test 的 --experimental-test-module-mocks；較舊的 Node 會在",
      "解析旗標時直接失敗（node: bad option），不會說明是版本問題。",
      "",
      "切換方式（任一）：",
      "  nvm install 22 && nvm use 22",
      "  fnm install 22 && fnm use 22",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
