export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export const USER_STATUS_OPTIONS = [
  { label: "Activos", value: "true" },
  { label: "Inactivos", value: "false" },
] as const;

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

export function getFullName(user: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  return name.length > 0 ? name : "Sin nombre";
}
