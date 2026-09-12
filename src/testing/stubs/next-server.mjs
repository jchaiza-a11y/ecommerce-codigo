// Stub de `next/server` para `node --test`: los internos de Next (dist/esm)
// no cargan bajo la resolución ESM estricta de Node fuera del bundler de
// Next (imports de JSON sin atributo `type: "json"`). `NextResponse` es en la
// práctica un `Response` del Fetch API estándar (global en Node), así que la
// réplica preserva el comportamiento real que los tests necesitan: status,
// headers y `.json()`.
export class NextResponse extends Response {
  static json(body, init) {
    return Response.json(body, init);
  }
}
