// Wandofi layer (see docs/WANDOFI.md): DataForSEO spend log and monthly caps.
import { index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";

// One row per billed DataForSEO request, written from the single fetch seam in
// src/server/lib/dataforseo/core.ts. `createdAt` is an ISO-8601 UTC string so
// month-to-date sums are a plain string comparison on both dialects.
export const wandofiDataforseoCalls = sqliteTable(
  "wandofi_dataforseo_calls",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    path: text("path").notNull(),
    costUsd: real("cost_usd").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id"),
  },
  (table) => [
    index("wandofi_dataforseo_calls_created_at_idx").on(table.createdAt),
    index("wandofi_dataforseo_calls_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// Monthly USD cap per project. The global cap lives in the
// WANDOFI_DATAFORSEO_MONTHLY_CAP_USD environment variable.
export const wandofiProjectSpendCaps = sqliteTable(
  "wandofi_project_spend_caps",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    monthlyCapUsd: real("monthly_cap_usd").notNull(),
  },
);
