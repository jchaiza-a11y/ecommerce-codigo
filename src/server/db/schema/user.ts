import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Espejo local de Clerk (003 §8.1): Clerk es la fuente de verdad de la
 * autenticación y esta tabla la de la autorización. Se sincroniza por webhook.
 */
export const user = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: varchar("clerk_id", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 80 }),
    lastName: varchar("last_name", { length: 80 }),
    imageUrl: text("image_url"),
    // Nullable a propósito (010): el Customer de Stripe se crea con la primera
    // tarjeta o compra, no en el alta. El índice único es el que impide que dos
    // filas acaben apuntando al mismo Customer.
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_clerk_id_unique").on(t.clerkId),
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_stripe_customer_id_unique").on(t.stripeCustomerId),
  ],
);

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;
