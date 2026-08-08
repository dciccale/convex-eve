"use client";

import {
  type PaginatedQueryArgs,
  type UsePaginatedQueryResult,
} from "convex/react";
import type {
  FunctionReference,
  PaginationOptions,
  PaginationResult,
} from "convex/server";
import { usePaginatedQuery } from "convex-helpers/react";
import type { EveMessage, EveMessagePart } from "eve/react";

export type { EveMessage, EveMessagePart } from "eve/react";

export interface PersistedEveMessage extends EveMessage {
  _creationTime: number;
  _id: string;
  order: number;
  status: "pending" | "streaming" | "complete" | "failed";
  threadId: string;
}

export type UIMessagesQuery<Args = Record<string, never>> = FunctionReference<
  "query",
  "public",
  Args & { paginationOpts: PaginationOptions; threadId: string },
  PaginationResult<PersistedEveMessage>
>;

/** Reactive paginated Eve messages persisted through Convex. */
export function useUIMessages<Query extends UIMessagesQuery<any>>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: { initialNumItems: number },
): UsePaginatedQueryResult<PersistedEveMessage> {
  // TypeScript 7 does not normalize the equivalent mapped generic from
  // convex-helpers at this implementation boundary. The public args remain
  // constrained by Convex's PaginatedQueryArgs above.
  const helperArgs = args as Parameters<typeof usePaginatedQuery<Query>>[1];
  return usePaginatedQuery(
    query,
    helperArgs,
    options,
  ) as UsePaginatedQueryResult<PersistedEveMessage>;
}
