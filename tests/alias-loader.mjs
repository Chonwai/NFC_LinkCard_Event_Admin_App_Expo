/**
 * Node ESM resolve hook：讓測試能以 App 的 `@/` 別名（與 App 原始碼內的**無副檔名**
 * 相對匯入）載入 TypeScript 模組。
 *
 * 為什麼需要這支檔案：
 * - App 的 `@/*` → `src/*` 別名原本由 Metro / TS 解析，Node 原生不認。
 * - Node ESM **不做副檔名推斷**，而 App 原始碼大量使用 `import { apiClient } from './api'`
 *   這種寫法（Metro bundler 才會補 `.ts`）。
 *
 * 為什麼不用 jest：本 repo devDependencies 沒有 jest／vitest，也沒有既有測試檔，
 * 而 `WP-ADM-06` 的硬約束是「不引入新依賴」→ 採用 Node 內建 test runner
 * ＋ 內建 type stripping，零新增套件。
 *
 * 邏輯逐字移植自 `LinkCard_Promoter_App_Expo/tests/alias-loader.mjs`
 * （僅依本 repo 的 prettier 預設值正規化引號與縮排，行為相同）。
 *
 * 掛載方式見 `tests/register-alias-loader.mjs`。
 */
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SRC_ROOT = path.join(REPO_ROOT, "src");

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".json"];

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function firstExistingFile(candidates) {
  return candidates.find(isFile) ?? null;
}

function withExtensions(base) {
  return [
    ...EXTENSIONS.map((extension) => `${base}${extension}`),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
}

/** `@/x` → `<repo>/src/x`（再補副檔名／index 檔） */
function resolveAliasTarget(specifier) {
  return firstExistingFile(
    withExtensions(path.join(SRC_ROOT, specifier.slice(2))),
  );
}

/** `./x` / `../x` → 以 `parentURL` 為基準補副檔名 */
function resolveRelativeTarget(specifier, parentURL) {
  if (parentURL == null) {
    return null;
  }

  const base = path.resolve(path.dirname(fileURLToPath(parentURL)), specifier);
  return firstExistingFile(withExtensions(base));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveAliasTarget(specifier);
    if (target != null) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      const target = resolveRelativeTarget(specifier, context.parentURL);
      if (target != null) {
        return { url: pathToFileURL(target).href, shortCircuit: true };
      }

      throw error;
    }
  }

  return nextResolve(specifier, context);
}
