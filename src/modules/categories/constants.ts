export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
};

export const CATEGORY_STATUS_OPTIONS = [
  { label: "Activas", value: "true" },
  { label: "Inactivas", value: "false" },
] as const;
