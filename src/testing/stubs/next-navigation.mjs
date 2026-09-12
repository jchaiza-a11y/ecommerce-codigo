// Stub de `next/navigation` para `node --test` (mismo motivo que
// next-server.mjs). `redirect()` real interrumpe el render lanzando un error
// especial que Next intercepta; esta réplica lanza uno reconocible por
// mensaje para que un test pueda `assert.throws(fn, /NEXT_REDIRECT:\/ruta/)`.
export function redirect(url) {
  throw new Error(`NEXT_REDIRECT:${url}`);
}
