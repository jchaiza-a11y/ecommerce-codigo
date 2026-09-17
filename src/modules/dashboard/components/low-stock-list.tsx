import { PackageX } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardEmpty } from "@/modules/dashboard/components/dashboard-empty";
import { formatUnits } from "@/modules/dashboard/constants";
import type { LowStockItem } from "@/modules/dashboard/types/dashboard.types";

type LowStockListProps = {
  data: LowStockItem[];
};

/**
 * Productos por debajo de su umbral (011 T19, AC5). El orden llega resuelto
 * del repositorio (`stock` ascendente) y no se reordena aquí.
 */
export function LowStockList({ data }: LowStockListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock bajo</CardTitle>
        <CardDescription>
          Productos activos cuyo stock no supera su umbral
        </CardDescription>
      </CardHeader>

      <CardContent>
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Stock actual</TableHead>
                <TableHead className="text-right">Umbral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.sku}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnits(item.stock)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatUnits(item.threshold)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DashboardEmpty
            icon={PackageX}
            title="Sin productos con stock bajo"
            description="Todos los productos activos están por encima de su umbral de reposición."
          />
        )}
      </CardContent>
    </Card>
  );
}
