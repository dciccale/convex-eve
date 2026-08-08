/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    messages: {
      createPending: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          clientMessageId: string;
          message: string;
          scopeId: string;
          subjectId: string;
          threadId: string;
        },
        { deliveryId: string; messageId: string },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          scopeId: string;
          subjectId: string;
          threadId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            id: string;
            metadata: {
              status: "submitted" | "streaming" | "complete" | "failed";
              turnId?: string;
            };
            order: number;
            parts: Array<any>;
            role: "user" | "assistant";
            status: "pending" | "streaming" | "complete" | "failed";
            threadId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        Name
      >;
    };
    runtime: {
      bindSession: FunctionReference<
        "mutation",
        "internal",
        {
          eveSessionId: string;
          scopeId: string;
          subjectId: string;
          threadId: string;
        },
        string,
        Name
      >;
      failDelivery: FunctionReference<
        "mutation",
        "internal",
        {
          clientMessageId: string;
          error: string;
          scopeId: string;
          subjectId: string;
          threadId: string;
        },
        null,
        Name
      >;
      getDelivery: FunctionReference<
        "query",
        "internal",
        {
          clientMessageId: string;
          scopeId: string;
          subjectId: string;
          threadId: string;
        },
        {
          delivery: {
            _creationTime: number;
            _id: string;
            attemptCount: number;
            clientMessageId: string;
            createdAt: number;
            error?: string;
            generationId: string;
            messageId: string;
            state:
              "queued" | "dispatching" | "streaming" | "accepted" | "failed";
            threadId: string;
            updatedAt: number;
          };
          generation: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            eveSessionId?: string;
            generation: number;
            nextStreamIndex: number;
            projection: any;
            status: "unbound" | "active" | "waiting" | "failed" | "retired";
            threadId: string;
            updatedAt: number;
          };
          message: string;
          thread: {
            _creationTime: number;
            _id: string;
            agentId: string;
            createdAt: number;
            currentGeneration: number;
            ownerSubjectId: string;
            scopeId: string;
            status:
              | "ready"
              | "queued"
              | "streaming"
              | "waiting_input"
              | "failed"
              | "closed";
            title: string;
            updatedAt: number;
          };
        },
        Name
      >;
      ingestEvent: FunctionReference<
        "mutation",
        "internal",
        {
          eveSessionId: string;
          event: any;
          scopeId: string;
          streamIndex: number;
          subjectId: string;
          threadId: string;
        },
        { duplicate: boolean },
        Name
      >;
      markDispatching: FunctionReference<
        "mutation",
        "internal",
        {
          clientMessageId: string;
          scopeId: string;
          subjectId: string;
          threadId: string;
        },
        { claimed: boolean; deliveryId: string },
        Name
      >;
    };
    threads: {
      create: FunctionReference<
        "mutation",
        "internal",
        { agentId: string; scopeId: string; subjectId: string; title?: string },
        string,
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { scopeId: string; subjectId: string; threadId: string },
        {
          _creationTime: number;
          _id: string;
          agentId: string;
          createdAt: number;
          currentGeneration: number;
          generation: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            eveSessionId?: string;
            generation: number;
            nextStreamIndex: number;
            projection: any;
            status: "unbound" | "active" | "waiting" | "failed" | "retired";
            threadId: string;
            updatedAt: number;
          };
          ownerSubjectId: string;
          scopeId: string;
          status:
            | "ready"
            | "queued"
            | "streaming"
            | "waiting_input"
            | "failed"
            | "closed";
          title: string;
          updatedAt: number;
        },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        { agentId?: string; scopeId: string; subjectId: string },
        Array<{
          _creationTime: number;
          _id: string;
          agentId: string;
          createdAt: number;
          currentGeneration: number;
          ownerSubjectId: string;
          scopeId: string;
          status:
            | "ready"
            | "queued"
            | "streaming"
            | "waiting_input"
            | "failed"
            | "closed";
          title: string;
          updatedAt: number;
        }>,
        Name
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { scopeId: string; subjectId: string; threadId: string },
        null,
        Name
      >;
    };
  };
