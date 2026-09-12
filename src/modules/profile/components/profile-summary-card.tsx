import Link from "next/link";
import { AtSign, CalendarDays, Clock3, Mail } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ProfileSummaryCardProps = {
  imageUrl: string;
  displayName: string;
  email: string;
  /** `null` cuando la cuenta no tiene username en Clerk. */
  username: string | null;
  /** Ya formateada en el servidor: este componente no formatea fechas. */
  createdAt: string;
  /** `null` en la primera sesión, cuando Clerk aún no registró un acceso previo. */
  lastSignInAt: string | null;
};

type ProfileFieldProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function ProfileField({ icon, label, value }: ProfileFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

/**
 * Presentacional puro (007 T3): sin hooks ni acceso a Clerk. Recibe solo
 * primitivas para que el objeto `User` del Backend API no cruce la frontera
 * servidor→cliente (AC6).
 */
export function ProfileSummaryCard({
  imageUrl,
  displayName,
  email,
  username,
  createdAt,
  lastSignInAt,
}: ProfileSummaryCardProps) {
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={imageUrl} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{displayName}</CardTitle>
            <CardDescription className="truncate">{email}</CardDescription>
          </div>
        </div>

        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/profile">Editar perfil</Link>
          </Button>
        </CardAction>
      </CardHeader>

      <Separator />

      <CardContent className="grid gap-4 sm:grid-cols-2">
        <ProfileField
          icon={<Mail className="size-4" />}
          label="Correo principal"
          value={email}
        />
        <ProfileField
          icon={<AtSign className="size-4" />}
          label="Usuario"
          value={username ?? "Sin usuario"}
        />
        <ProfileField
          icon={<CalendarDays className="size-4" />}
          label="Miembro desde"
          value={createdAt}
        />
        <ProfileField
          icon={<Clock3 className="size-4" />}
          label="Último acceso"
          value={lastSignInAt ?? "Esta es tu primera sesión"}
        />
      </CardContent>
    </Card>
  );
}
