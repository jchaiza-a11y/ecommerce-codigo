import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// `src/testing/resolve-alias.mjs` -> la raíz de `src/` es un nivel arriba.
const SRC_DIR = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PROJECT_ROOT = path.join(SRC_DIR, "..");
const NODE_MODULES_DIR = path.join(PROJECT_ROOT, "node_modules");

// `server-only` lanza fuera del bundler de Next: su export map solo evita el
// throw bajo la condición "react-server", y activarla globalmente rompe la
// resolución de paquetes internos de Next/Clerk (exports condicionados sin
// contraparte ejecutable fuera de webpack). Se redirige directo al stub vacío
// que el propio paquete expone para ese caso.
const SERVER_ONLY_STUB = path.join(NODE_MODULES_DIR, "server-only", "empty.js");

// Los `dist/esm` de Next no cargan bajo ESM estricto de Node fuera de su
// propio bundler (imports de JSON sin atributo `type: "json"`). Se
// reemplazan por réplicas mínimas en src/test/stubs/ — ver ese archivo.
const STUB_SPECIFIERS = {
  "next/server": path.join(SRC_DIR, "testing", "stubs", "next-server.mjs"),
  "next/navigation": path.join(SRC_DIR, "testing", "stubs", "next-navigation.mjs"),
};

const FILE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".js", ".mjs"];
const INDEX_SUFFIXES = ["/index.ts", "/index.tsx", "/index.js", "/index.mjs"];
const RETRYABLE_ERRORS = new Set([
  "ERR_MODULE_NOT_FOUND",
  "ERR_UNSUPPORTED_DIR_IMPORT",
]);

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function findCandidate(base) {
  for (const suffix of [...FILE_SUFFIXES, ...INDEX_SUFFIXES]) {
    const candidate = base + suffix;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function toCandidateBase(specifier, context) {
  if (specifier.startsWith("@/")) {
    return path.join(SRC_DIR, specifier.slice(2));
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file://")) {
    return path.resolve(
      path.dirname(fileURLToPath(context.parentURL)),
      specifier,
    );
  }

  // Subpath legado sin "exports" en el package.json (ej. `next/server`,
  // que Next resuelve vía bundler, no vía extensión explícita).
  if (!path.isAbsolute(specifier) && !specifier.startsWith("node:")) {
    return path.join(NODE_MODULES_DIR, specifier);
  }

  return null;
}

/**
 * Deja que Node resuelva todo de forma nativa primero; solo interviene
 * cuando eso falla por falta de extensión o por ser un import "estilo
 * bundler" (`@/*`, extensionless, directorio con index) — los tres casos que
 * `tsconfig.json` (`moduleResolution: bundler`) permite y Node en solitario
 * no. Así el hook no reemplaza la resolución real de `node_modules`
 * (`exports`, condiciones, etc.), solo la completa.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return nextResolve(pathToFileURL(SERVER_ONLY_STUB).href, context);
  }

  if (specifier in STUB_SPECIFIERS) {
    return nextResolve(pathToFileURL(STUB_SPECIFIERS[specifier]).href, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!RETRYABLE_ERRORS.has(error?.code)) {
      throw error;
    }

    const base = toCandidateBase(specifier, context);
    const candidate = base && findCandidate(base);
    if (!candidate) {
      throw error;
    }

    return nextResolve(pathToFileURL(candidate).href, context);
  }
}
