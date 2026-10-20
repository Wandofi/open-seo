// Wandofi layer (see docs/WANDOFI.md). Mirrors ../wandofi.schema.ts.
import { index, pgTable, real, text } from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

export const wandofiDataforseoCalls = pgTable(
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

export const wandofiProjectSpendCaps = pgTable("wandofi_project_spend_caps", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  monthlyCapUsd: real("monthly_cap_usd").notNull(),
});
