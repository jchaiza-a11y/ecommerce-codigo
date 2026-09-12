import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Snapshot de presentación del producto. Existe para pintar el drawer sin pedir
 * nada a la API; **no** es fuente de verdad del precio: el checkout de una fase
 * futura recalculará contra la BD (004 §8.4).
 */
export type CartLine = {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
};

export type CartSnapshot = Omit<CartLine, "quantity">;

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  hasHydrated: boolean;
  addLine: (snapshot: CartSnapshot, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  setOpen: (isOpen: boolean) => void;
};

const MAX_QUANTITY_PER_LINE = 99;

function clampQuantity(quantity: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_QUANTITY_PER_LINE);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      hasHydrated: false,

      addLine: (snapshot, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find(
            (line) => line.productId === snapshot.productId,
          );

          const lines = existing
            ? state.lines.map((line) =>
                line.productId === snapshot.productId
                  ? {
                      ...line,
                      ...snapshot,
                      quantity: clampQuantity(line.quantity + quantity),
                    }
                  : line,
              )
            : [...state.lines, { ...snapshot, quantity: clampQuantity(quantity) }];

          return { lines, isOpen: true };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines:
            quantity < 1
              ? state.lines.filter((line) => line.productId !== productId)
              : state.lines.map((line) =>
                  line.productId === productId
                    ? { ...line, quantity: clampQuantity(quantity) }
                    : line,
                ),
        })),

      removeLine: (productId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.productId !== productId),
        })),

      clear: () => set({ lines: [] }),

      setOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: "nexo-cart",
      storage: createJSONStorage(() => localStorage),
      // Solo el contenido persiste: recuperar `isOpen` abriría el drawer solo
      // al recargar.
      partialize: (state) => ({ lines: state.lines }),
      // Sin `skipHydration` el servidor pinta 0 líneas y el cliente N en el
      // primer render → error de hidratación (004 §10). La rehidratación la
      // dispara un efecto del drawer.
      skipHydration: true,
      // La marca la pone el middleware al terminar, haya o no datos guardados:
      // hasta entonces la UI no debe pintar cantidades.
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hasHydrated: true });
      },
    },
  ),
);

export function selectCartCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function selectCartSubtotalCents(state: CartState): number {
  return state.lines.reduce(
    (total, line) => total + line.priceCents * line.quantity,
    0,
  );
}
