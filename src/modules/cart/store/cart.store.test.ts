import test from "node:test";
import assert from "node:assert/strict";

// El middleware `persist` de Zustand escribe en `localStorage` en cada
// cambio de estado (aunque `skipHydration` difiera la LECTURA inicial). Node
// no trae `localStorage` global sin `--experimental-webstorage`; se instala
// un polyfill mínimo en memoria antes de importar el store, para no depender
// de flags de Node ni tocar disco en los tests.
const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => (memory.has(key) ? (memory.get(key) as string) : null),
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
};

const { useCartStore, selectCartCount, selectCartSubtotalCents } = await import(
  "@/modules/cart/store/cart.store.ts"
);

function snapshot(productId: string, priceCents: number) {
  return { productId, name: `Producto ${productId}`, slug: productId, priceCents, imageUrl: null };
}

test.beforeEach(() => {
  // Merge, no replace: reemplazar borraría las acciones del store.
  useCartStore.setState({ lines: [], isOpen: false });
});

test("addLine() appends a new line with the given quantity", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 2);

  const lines = useCartStore.getState().lines;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
});

test("addLine() defaults to quantity 1", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000));
  assert.equal(useCartStore.getState().lines[0].quantity, 1);
});

test("addLine() sums quantity into an existing line for the same product", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 2);
  useCartStore.getState().addLine(snapshot("p1", 1000), 3);

  const lines = useCartStore.getState().lines;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 5);
});

test("addLine() clamps the quantity at 99", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 150);
  assert.equal(useCartStore.getState().lines[0].quantity, 99);
});

test("addLine() clamps a zero or negative quantity up to 1", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 0);
  assert.equal(useCartStore.getState().lines[0].quantity, 1);
});

test("addLine() opens the drawer", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000));
  assert.equal(useCartStore.getState().isOpen, true);
});

test("setQuantity() updates the quantity of an existing line", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 1);
  useCartStore.getState().setQuantity("p1", 5);

  assert.equal(useCartStore.getState().lines[0].quantity, 5);
});

test("setQuantity() removes the line when the quantity drops below 1", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 1);
  useCartStore.getState().setQuantity("p1", 0);

  assert.equal(useCartStore.getState().lines.length, 0);
});

test("setQuantity() clamps at 99 for an existing line", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 1);
  useCartStore.getState().setQuantity("p1", 150);

  assert.equal(useCartStore.getState().lines[0].quantity, 99);
});

test("setQuantity() is a no-op for a product not in the cart", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 1);
  useCartStore.getState().setQuantity("p2", 5);

  assert.equal(useCartStore.getState().lines.length, 1);
});

test("removeLine() removes only the matching product", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 1);
  useCartStore.getState().addLine(snapshot("p2", 2000), 1);
  useCartStore.getState().removeLine("p1");

  const lines = useCartStore.getState().lines;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productId, "p2");
});

test("clear() empties the cart", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 1);
  useCartStore.getState().clear();

  assert.equal(useCartStore.getState().lines.length, 0);
});

test("selectCartCount() sums the quantity across lines", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 2);
  useCartStore.getState().addLine(snapshot("p2", 2000), 3);

  assert.equal(selectCartCount(useCartStore.getState()), 5);
});

test("selectCartCount() is 0 for an empty cart", () => {
  assert.equal(selectCartCount(useCartStore.getState()), 0);
});

test("selectCartSubtotalCents() sums priceCents times quantity across lines", () => {
  useCartStore.getState().addLine(snapshot("p1", 1000), 2); // 2000
  useCartStore.getState().addLine(snapshot("p2", 500), 3); // 1500

  assert.equal(selectCartSubtotalCents(useCartStore.getState()), 3500);
});

test("selectCartSubtotalCents() is 0 for an empty cart", () => {
  assert.equal(selectCartSubtotalCents(useCartStore.getState()), 0);
});
