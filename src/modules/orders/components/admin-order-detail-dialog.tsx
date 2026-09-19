import { Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/modules/audit-logs/constants";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_VARIANTS,
} from "@/modules/orders/constants";
import { useAdminOrderDetail } from "@/modules/orders/hooks/use-admin-order-detail";
import { useAdminOrderReceipt } from "@/modules/orders/hooks/use-admin-order-receipt";
import type { AdminOrderListItem } from "@/modules/orders/schemas/admin-order.schema";
import { formatPrice } from "@/modules/products/constants";

type AdminOrderDetailDialogProps = {
  order: AdminOrderListItem | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Detalle de un pedido. La cabecera ya viene en la fila del listado, así que el
 * diálogo se abre lleno y solo va a la red por las líneas y por la boleta
 * (§Decisiones 4 y 5).
 */
export function AdminOrderDetailDialog({
  order,
  onOpenChange,
}: AdminOrderDetailDialogProps) {
  const isOpen = order !== null;
  const detailQuery = useAdminOrderDetail(order?.id ?? "", isOpen);
  // Solo el pedido pagado tiene boleta que pedirle a Stripe (AC10).
  const receiptQuery = useAdminOrderReceipt(
    order?.id ?? "",
    isOpen && order?.status === "paid",
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle>Detalle del pedido</DialogTitle>
              <DialogDescription>
                {formatDateTime(order.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-medium">
                  {order.customer.name ?? "Sin nombre"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {order.customer.email}
                </span>
              </div>

              <Badge variant={ORDER_STATUS_VARIANTS[order.status]}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>

            <Separator />

            {detailQuery.isPending ? (
              <div className="flex flex-col gap-2" aria-busy>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : detailQuery.isError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  No se pudieron cargar las líneas del pedido
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getApiErrorMessage(
                    detailQuery.error,
                    "Inténtalo de nuevo en unos momentos.",
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => detailQuery.refetch()}
                  disabled={detailQuery.isFetching}
                >
                  Reintentar
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">
                        Precio unitario
                      </TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailQuery.data.items.map((item) => (
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
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              {/* Leído de `orders.total_cents`, nunca recalculado sumando las
                  líneas: el importe cobrado es el que guardó el webhook (AC9). */}
              <span className="text-lg font-semibold tabular-nums">
                {formatPrice(order.totalCents)}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>

              {/* Un pedido sin pagar no ofrece boleta (AC10). */}
              {order.status === "paid" ? (
                receiptQuery.data?.url ? (
                  // Enlace real y no `window.open()` tras un `await`: el
                  // navegador lo bloquearía por popup (009 §Notas).
                  <Button asChild>
                    <a
                      href={receiptQuery.data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Receipt />
                      Ver boleta
                    </a>
                  </Button>
                ) : (
                  <Button type="button" disabled>
                    <Receipt />
                    {receiptQuery.isPending
                      ? "Buscando boleta…"
                      : "Boleta no disponible"}
                  </Button>
                )
              ) : null}
            </DialogFooter>

            {/* Stripe puede tardar en publicar la boleta: se informa sin romper. */}
            {order.status === "paid" &&
            !receiptQuery.isPending &&
            !receiptQuery.data?.url ? (
              <p className="text-xs text-muted-foreground">
                {receiptQuery.isError
                  ? getApiErrorMessage(
                      receiptQuery.error,
                      "No pudimos consultar la boleta. Inténtalo de nuevo en unos momentos.",
                    )
                  : "Stripe todavía no ha publicado la boleta de este pago. Estará disponible en unos minutos."}
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
