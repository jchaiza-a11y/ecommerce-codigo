import { Download, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { useOrderReceipt } from "@/modules/profile/hooks/use-order-receipt";
import { formatOrderTime } from "@/modules/profile/lib/group-orders-by-day";
import type { OrderHistoryItem } from "@/modules/profile/schemas/order-history.schema";
import { formatPrice } from "@/modules/products/constants";

type OrderDetailDialogProps = {
  order: OrderHistoryItem | null;
  onOpenChange: (open: boolean) => void;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" });

type ReceiptState =
  | { kind: "loading" }
  | { kind: "available"; url: string }
  | { kind: "unavailable"; reason: string };

/**
 * Detalle del pedido con su boleta. Las líneas ya vienen en el historial, así
 * que el diálogo solo va a la red por el `receipt_url` (009 §Notas, N+1).
 */
export function OrderDetailDialog({
  order,
  onOpenChange,
}: OrderDetailDialogProps) {
  const receiptQuery = useOrderReceipt(order?.id ?? "", order !== null);

  const receipt: ReceiptState = receiptQuery.isPending
    ? { kind: "loading" }
    : receiptQuery.isError
      ? {
          kind: "unavailable",
          reason: getApiErrorMessage(
            receiptQuery.error,
            "No pudimos consultar la boleta. Inténtalo de nuevo en unos momentos.",
          ),
        }
      : receiptQuery.data?.url
        ? { kind: "available", url: receiptQuery.data.url }
        : {
            kind: "unavailable",
            reason:
              "Stripe todavía no ha publicado la boleta de este pago. Estará disponible en unos minutos.",
          };

  return (
    <Dialog open={order !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle>Detalle de la compra</DialogTitle>
              <DialogDescription>
                {dateFormatter.format(new Date(order.createdAt))} a las{" "}
                {formatOrderTime(order.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.productName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(item.unitPriceCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(item.unitPriceCents * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total pagado</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatPrice(order.totalCents)}
              </span>
            </div>

            {receipt.kind === "unavailable" ? (
              <p className="text-xs text-muted-foreground">{receipt.reason}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>

              {/* Enlace real y no `window.open()` tras un `await`: el navegador
                  bloquearía la pestaña por popup (009 §Notas). */}
              {receipt.kind === "available" ? (
                <Button asChild>
                  <a
                    href={receipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download />
                    Descargar boleta
                  </a>
                </Button>
              ) : (
                <Button type="button" disabled>
                  <Receipt />
                  {receipt.kind === "loading"
                    ? "Buscando boleta…"
                    : "Boleta no disponible"}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
