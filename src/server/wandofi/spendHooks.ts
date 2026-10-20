// Wandofi layer (see docs/WANDOFI.md). Dependency-free seam between the
// DataForSEO fetch (core.ts, client.ts) and the spend guard, so those modules
// stay importable in tests without the database. spendGuard.ts registers the
// hooks; each Worker entrypoint imports it once.
import { AsyncLocalStorage } from "node:async_hooks";

type SpendContext = { projectId?: string; organizationId?: string };

type DataforseoSpendHooks = {
  beforeBilledRequest: (context: SpendContext | undefined) => Promise<void>;
  afterResponse: (
    context: SpendContext | undefined,
    path: string,
    costUsd: number,
  ) => Promise<void>;
};

const spendContextStore = new AsyncLocalStorage<SpendContext>();
let hooks: DataforseoSpendHooks | null = null;

export function setDataforseoSpendHooks(next: DataforseoSpendHooks): void {
  hooks = next;
}

/** Attributes DataForSEO requests made inside `fn` to a project. */
export function runWithSpendContext<T>(
  context: SpendContext,
  fn: () => Promise<T>,
): Promise<T> {
  return spendContextStore.run(context, fn);
}

export async function beforeBilledDataforseoRequest(): Promise<void> {
  await hooks?.beforeBilledRequest(spendContextStore.getStore());
}

export async function afterDataforseoResponse(
  path: string,
  costUsd: number,
): Promise<void> {
  await hooks?.afterResponse(spendContextStore.getStore(), path, costUsd);
}
