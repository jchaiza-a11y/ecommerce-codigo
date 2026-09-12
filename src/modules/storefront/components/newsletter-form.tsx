"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  newsletterEmailSchema,
  type NewsletterEmailInput,
} from "@/modules/storefront/schemas/catalog.schema";

/**
 * §8.6: deliberadamente **sin backend**. Valida el correo y confirma con un
 * toast; no persiste nada ni llama a ninguna API. No es un bug pendiente: la
 * suscripción real tendrá su propia spec con almacenamiento y doble opt-in.
 */
export function NewsletterForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterEmailInput>({
    resolver: zodResolver(newsletterEmailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    toast.success("Suscripción registrada", {
      description: `Te avisaremos de las próximas ofertas en ${values.email}.`,
    });
    reset();
  });

  return (
    <div className="flex flex-col gap-6 rounded-3xl bg-linear-to-br from-brand/15 via-card to-brand-2/15 p-8 ring-1 ring-foreground/10 md:flex-row md:items-center md:justify-between md:p-12">
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-brand">
          <Mail className="size-4" />
          Boletín
        </span>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">
          Recibe las bajadas de precio antes que nadie
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Un correo a la semana con las ofertas que de verdad valen la pena.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-2">
        <Field data-invalid={Boolean(errors.email)}>
          <div className="flex gap-2">
            <Input
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              aria-label="Correo electrónico"
              aria-invalid={Boolean(errors.email)}
              className="h-10 rounded-full"
              {...register("email")}
            />
            <Button
              type="submit"
              size="lg"
              className="rounded-full px-6"
              disabled={isSubmitting}
            >
              Suscribirme
            </Button>
          </div>
          <FieldError errors={errors.email ? [errors.email] : undefined} />
        </Field>
      </form>
    </div>
  );
}
