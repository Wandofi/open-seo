// Wandofi layer (see docs/WANDOFI.md): logs every billed DataForSEO request
// and enforces monthly USD caps, globally and per project. Self-hosted
// OpenSEO has no metering of its own, so this is the only spend limit.
//
// registerDataforseoSpendGuard() installs the hooks that core.ts calls around
// every DataForSEO request (see spendHooks.ts). src/server.ts and
// src/audit-worker.ts call it at load so both Workers are covered.
import { and, eq, gte, sum } from "drizzle-orm";
import { db } from "@/db";
import { wandofiDataforseoCalls, wandofiProjectSpendCaps } from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { setDataforseoSpendHooks } from "@/server/wandofi/spendHooks";

const GLOBAL_CAP_ENV = "WANDOFI_DATAFORSEO_MONTHLY_CAP_USD";
const WARN_RATIO = 0.8;

function monthStartIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

async function monthToDateSpendUsd(projectId?: string): Promise<number> {
  const since = gte(wandofiDataforseoCalls.createdAt, monthStartIso());
  const [row] = await db
    .select({ value: sum(wandofiDataforseoCalls.costUsd) })
    .from(wandofiDataforseoCalls)
    .where(
      projectId
        ? and(since, eq(wandofiDataforseoCalls.projectId, projectId))
        : since,
    );
  return Number(row?.value ?? 0);
}

async function globalCapUsd(): Promise<number | null> {
  const raw = await getOptionalEnvValue(GLOBAL_CAP_ENV);
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function projectCapUsd(projectId: string): Promise<number | null> {
  const [row] = await db
    .select({ cap: wandofiProjectSpendCaps.monthlyCapUsd })
    .from(wandofiProjectSpendCaps)
    .where(eq(wandofiProjectSpendCaps.projectId, projectId));
  return row?.cap ?? null;
}

function checkCap(label: string, spentUsd: number, capUsd: number | null) {
  if (capUsd === null) return;
  if (spentUsd >= capUsd) {
    throw new AppError(
      "INSUFFICIENT_CREDITS",
      `Tecto mensal de gasto DataForSEO atingido (${label}): ${spentUsd.toFixed(2)} de ${capUsd.toFixed(2)} USD. Aumente o tecto ou aguarde pelo próximo mês.`,
    );
  }
  if (spentUsd >= capUsd * WARN_RATIO) {
    console.warn("wandofi.spend-cap-warning", {
      event: "wandofi.spend-cap-warning",
      scope: label,
      spentUsd,
      capUsd,
    });
  }
}

export function registerDataforseoSpendGuard(): void {
  setDataforseoSpendHooks({
    // A soft cap: requests running at the same moment are each checked against
    // the spend recorded before them, so one batch can run past the cap.
    async beforeBilledRequest(context) {
      const [globalCap, globalSpent] = await Promise.all([
        globalCapUsd(),
        monthToDateSpendUsd(),
      ]);
      checkCap("global", globalSpent, globalCap);
      const projectId = context?.projectId;
      if (!projectId) return;
      const [projectCap, projectSpent] = await Promise.all([
        projectCapUsd(projectId),
        monthToDateSpendUsd(projectId),
      ]);
      checkCap(`projecto ${projectId}`, projectSpent, projectCap);
    },

    // Never throws: logging must not fail a call that DataForSEO already billed.
    async afterResponse(context, path, costUsd) {
      if (!(costUsd > 0)) return;
      try {
        await db.insert(wandofiDataforseoCalls).values({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          path,
          costUsd,
          projectId: context?.projectId ?? null,
          organizationId: context?.organizationId ?? null,
        });
      } catch (error) {
        console.error("wandofi.spend-log-failed", { path, costUsd, error });
      }
    },
  });
}
