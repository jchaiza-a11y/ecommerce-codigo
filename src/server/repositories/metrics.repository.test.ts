import test from "node:test";
import assert from "node:assert/strict";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { orderItem } from "@/server/db/schema/order-item.ts";
import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { getSalesSummary, getDailySales, getTopProducts, findLowStockProducts } =
  await import("@/server/repositories/metrics.repository.ts");

const dialect = new PgDialect();

/**
 * El stub de `db` no ejecuta SQL, así que los filtros y el orden solo se pueden
 * comprobar sobre el fragmento que el repositorio le pasa a Drizzle: se
 * renderiza con el dialecto real y se mira el texto.
 */
function queryFor(method: string): { sql: string; params: unknown[] } {
  const rendered = (db.argsFor(method) ?? []).map((arg) =>
    dialect.sqlToQuery(arg as SQL),
  );

  return {
    sql: rendered
      .map((part) => part.sql)
      .join(" , ")
      .toLowerCase(),
    params: rendered.flatMap((part) => part.params),
  };
}

const SINCE = new Date("2026-08-17T00:00:00.000Z");

test.beforeEach(() => {
  db.resetCalls();
});

test("getSalesSummary() returns zeros when there are no paid orders in range", async () => {
  db.set([{ salesCents: null, orders: 0 }]);

  assert.deepEqual(await getSalesSummary(SINCE), { salesCents: 0, orders: 0 });
});

test("getSalesSummary() returns zeros when the aggregate yields no row at all", async () => {
  db.set([]);

  assert.deepEqual(await getSalesSummary(SINCE), { salesCents: 0, orders: 0 });
});

test("getSalesSummary() turns the numeric sum of the driver into an integer", async () => {
  db.set([{ salesCents: "125000", orders: 3 }]);

  assert.deepEqual(await getSalesSummary(SINCE), {
    salesCents: 125000,
    orders: 3,
  });
});

test("getSalesSummary() only counts paid orders from the window start", async () => {
  db.set([]);
  await getSalesSummary(SINCE);

  const where = queryFor("where");

  assert.ok(where.sql.includes('"orders"."status" ='));
  assert.ok(where.sql.includes('"orders"."created_at" >='));
  assert.ok(where.params.includes("paid"));
});

test("getDailySales() keeps the rows in the ascending order the query returns", async () => {
  db.set([
    { date: "2026-08-17", salesCents: "1000", orders: 1 },
    { date: "2026-08-19", salesCents: "2500", orders: 2 },
  ]);

  assert.deepEqual(await getDailySales(SINCE), [
    { date: "2026-08-17", salesCents: 1000, orders: 1 },
    { date: "2026-08-19", salesCents: 2500, orders: 2 },
  ]);
});

test("getDailySales() groups and sorts by the UTC day, ascending", async () => {
  db.set([]);
  await getDailySales(SINCE);

  assert.ok(queryFor("groupBy").sql.includes("date_trunc('day'"));
  assert.ok(queryFor("groupBy").sql.includes("at time zone 'utc'"));

  const orderBy = queryFor("orderBy").sql;

  assert.ok(orderBy.includes("date_trunc('day'"));
  assert.ok(orderBy.trimEnd().endsWith("asc"));
});

test("getDailySales() returns [] when no day in the window had sales", async () => {
  db.set([]);

  assert.deepEqual(await getDailySales(SINCE), []);
});

test("getTopProducts() passes the limit straight to the query", async () => {
  db.set([]);
  await getTopProducts(SINCE, 10);

  assert.deepEqual(db.argsFor("limit"), [10]);
});

test("getTopProducts() sorts by units sold, descending", async () => {
  db.set([]);
  await getTopProducts(SINCE, 10);

  const orderBy = queryFor("orderBy").sql;

  assert.ok(orderBy.includes('sum("order_items"."quantity")'));
  assert.ok(orderBy.trimEnd().endsWith("desc"));
});

test("getTopProducts() maps the aggregated row and keeps the ranking order", async () => {
  db.set([
    { productId: "prod_1", name: "Teclado", units: "12", salesCents: "60000" },
    { productId: "prod_2", name: "Mouse", units: "5", salesCents: "10000" },
  ]);

  assert.deepEqual(await getTopProducts(SINCE, 10), [
    { productId: "prod_1", name: "Teclado", units: 12, salesCents: 60000 },
    { productId: "prod_2", name: "Mouse", units: 5, salesCents: 10000 },
  ]);
});

test("getTopProducts() groups by product id alone, so a renamed product is one row", async () => {
  db.set([]);
  await getTopProducts(SINCE, 10);

  // Agrupar por `(product_id, product_name)` partiría en dos barras el mismo
  // producto si se renombró entre dos compras: el grupo es solo el id.
  assert.deepEqual(db.argsFor("groupBy"), [orderItem.productId]);
});

test("getTopProducts() takes the name from the most recent paid order of each product", async () => {
  db.set([]);
  await getTopProducts(SINCE, 10);

  const selection = db.argsFor("select")?.[0] as Record<string, SQL>;
  const name = dialect.sqlToQuery(selection.name).sql.toLowerCase();

  assert.ok(name.includes('array_agg("order_items"."product_name"'));
  assert.ok(name.includes('order by "orders"."created_at" desc'));
  assert.ok(name.trimEnd().endsWith(")[1]"));
});

test("getTopProducts() maps the deduplicated row of a renamed product", async () => {
  // Fila tal y como la devuelve el `group by`: las dos compras (con los dos
  // nombres) ya colapsaron en un único producto con el nombre más reciente.
  db.set([
    {
      productId: "prod_1",
      name: "Teclado Pro",
      units: "7",
      salesCents: "35000",
    },
  ]);

  assert.deepEqual(await getTopProducts(SINCE, 10), [
    { productId: "prod_1", name: "Teclado Pro", units: 7, salesCents: 35000 },
  ]);
});

test("getTopProducts() only aggregates lines of paid orders in range", async () => {
  db.set([]);
  await getTopProducts(SINCE, 10);

  const where = queryFor("where");

  assert.ok(where.sql.includes('"orders"."status" ='));
  assert.ok(where.sql.includes('"orders"."created_at" >='));
  assert.ok(where.params.includes("paid"));
});

test("findLowStockProducts() excludes inactive and soft-deleted products", async () => {
  db.set([]);
  await findLowStockProducts(10);

  const where = queryFor("where");

  assert.ok(
    where.sql.includes(
      '"products"."stock" <= "products"."low_stock_threshold"',
    ),
  );
  assert.ok(where.sql.includes('"products"."is_active" ='));
  assert.ok(where.params.includes(true));
  assert.ok(where.sql.includes('"products"."deleted_at" is null'));
});

test("findLowStockProducts() sorts by stock ascending and respects the limit", async () => {
  db.set([]);
  await findLowStockProducts(5);

  assert.ok(queryFor("orderBy").sql.includes('"products"."stock" asc'));
  assert.deepEqual(db.argsFor("limit"), [5]);
});

test("findLowStockProducts() returns the row already shaped for the payload", async () => {
  const row = {
    id: "prod_1",
    name: "Teclado",
    sku: "TEC-001",
    stock: 2,
    threshold: 5,
  };

  db.set([row]);

  assert.deepEqual(await findLowStockProducts(10), [row]);
});

test("findLowStockProducts() returns [] when nothing is below its threshold", async () => {
  db.set([]);

  assert.deepEqual(await findLowStockProducts(10), []);
});
