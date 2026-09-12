"use client";

import { useQuery } from "@tanstack/react-query";

import { auditLogKeys } from "@/modules/audit-logs/constants";
import type { AuditLogFiltersInput } from "@/modules/audit-logs/schemas/audit-log.schema";
import { getAuditLogs } from "@/modules/audit-logs/services/audit-log.service";

export function useAuditLogs(filters: AuditLogFiltersInput) {
  return useQuery({
    queryKey: auditLogKeys.list(filters),
    queryFn: () => getAuditLogs(filters),
  });
}
