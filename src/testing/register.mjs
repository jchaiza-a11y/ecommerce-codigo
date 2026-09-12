import { register } from "node:module";

// Entry point de `--import`: registra el hook que resuelve `@/*` para que
// `node --test` pueda importar módulos del proyecto sin bundler ni tsconfig-paths.
register("./resolve-alias.mjs", import.meta.url);
