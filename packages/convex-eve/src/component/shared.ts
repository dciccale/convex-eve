import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const MAX_MESSAGE_LENGTH = 32_000;
export const MAX_TITLE_LENGTH = 120;

export type Actor = { scopeId: string; subjectId: string };

export async function requireThread(
  ctx: QueryCtx | MutationCtx,
  threadId: Id<"threads">,
  actor: Actor,
): Promise<Doc<"threads">> {
  const thread = await ctx.db.get(threadId);
  if (!thread) throw new ConvexError("thread_not_found");
  if (
    thread.scopeId !== actor.scopeId ||
    thread.ownerSubjectId !== actor.subjectId
  ) {
    throw new ConvexError("thread_access_denied");
  }
  return thread;
}

export async function currentGeneration(
  ctx: QueryCtx | MutationCtx,
  thread: Doc<"threads">,
): Promise<Doc<"generations">> {
  const generation = await ctx.db
    .query("generations")
    .withIndex("by_thread_generation", (q) =>
      q.eq("threadId", thread._id).eq("generation", thread.currentGeneration),
    )
    .unique();
  if (!generation) throw new ConvexError("thread_generation_not_found");
  return generation;
}

export function safeError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.slice(0, 1_000);
}
