import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  PaginationOptions,
} from "convex/server";
import type { ComponentApi } from "./component/_generated/component.js";

export interface ThreadSummary {
  _creationTime: number;
  _id: string;
  agentId: string;
  createdAt: number;
  currentGeneration: number;
  ownerSubjectId: string;
  scopeId: string;
  status:
    | "closed"
    | "failed"
    | "queued"
    | "ready"
    | "streaming"
    | "waiting_input";
  title: string;
  updatedAt: number;
}

export type EveComponent = ComponentApi;

export interface ComponentActor {
  scopeId: string;
  subjectId: string;
}

export interface AgentConfig {
  agentId: string;
}

export interface PendingMessage {
  clientMessageId: string;
  message: string;
  threadId: string;
}

type MutationCtx =
  | Pick<GenericMutationCtx<GenericDataModel>, "runMutation">
  | Pick<GenericActionCtx<GenericDataModel>, "runMutation">;
type QueryCtx =
  | Pick<GenericQueryCtx<GenericDataModel>, "runQuery">
  | Pick<GenericActionCtx<GenericDataModel>, "runQuery">;

/**
 * Convex-facing binding for one authored Eve agent.
 *
 * This class deliberately contains no model, prompt, tool, or execution
 * configuration. Those remain native Eve concerns. It only binds the host
 * application to the component's thread and message persistence APIs.
 */
export class Agent {
  constructor(
    public readonly component: EveComponent,
    public readonly config: AgentConfig,
  ) {}

  async createThread(
    ctx: MutationCtx,
    actor: ComponentActor,
    options: { title?: string } = {},
  ): Promise<string> {
    return await ctx.runMutation(this.component.threads.create, {
      ...actor,
      agentId: this.config.agentId,
      ...(options.title ? { title: options.title } : {}),
    });
  }

  async saveMessage(
    ctx: MutationCtx,
    actor: ComponentActor,
    input: PendingMessage,
  ): Promise<{ deliveryId: string; messageId: string }> {
    return await ctx.runMutation(this.component.messages.createPending, {
      ...actor,
      ...input,
      agentId: this.config.agentId,
    });
  }

  async getThread(ctx: QueryCtx, actor: ComponentActor, threadId: string) {
    return await ctx.runQuery(this.component.threads.get, {
      ...actor,
      threadId,
    });
  }

  /**
   * Deletes the component-owned thread projection and its child records.
   * Retire a bound Eve session in the host action before calling this method.
   */
  async deleteThread(
    ctx: MutationCtx,
    actor: ComponentActor,
    threadId: string,
  ): Promise<void> {
    await ctx.runMutation(this.component.threads.remove, {
      ...actor,
      threadId,
    });
  }

  async listThreads(ctx: QueryCtx, actor: ComponentActor) {
    return await ctx.runQuery(this.component.threads.list, {
      ...actor,
      agentId: this.config.agentId,
    });
  }

  async listUIMessages(
    ctx: QueryCtx,
    actor: ComponentActor,
    args: { paginationOpts: PaginationOptions; threadId: string },
  ) {
    return await ctx.runQuery(this.component.messages.list, {
      ...actor,
      ...args,
    });
  }
}
