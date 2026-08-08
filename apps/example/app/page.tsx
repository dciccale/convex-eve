"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { type PersistedEveMessage, useUIMessages } from "convex-eve/react";
import {
  Bot,
  CircleAlert,
  Dumbbell,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { ModeToggle } from "@/components/mode-toggle";
import { OperationsPanel } from "@/components/operations-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../convex/_generated/api";

const suggestedPrompt =
  "I’m still sore after my intervals. Adjust this week without losing progress.";

export default function Home() {
  const ensureThread = useMutation(api.chat.ensureThread);
  const createThread = useMutation(api.chat.createThread);
  const deleteThread = useAction(api.chat.deleteThread);
  const sendMessage = useMutation(api.chat.sendMessage);
  const respondToInput = useMutation(api.chat.respondToInput);
  const threads = useQuery(api.chat.listThreads);
  const [threadId, setThreadId] = useState<string>();
  const [message, setMessage] = useState(suggestedPrompt);
  const [submitting, setSubmitting] = useState(false);
  const [deletingThreadIds, setDeletingThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  useEffect(() => {
    if (threadId || threads === undefined) return;
    if (threads.length > 0) {
      setThreadId(threads[0]?._id);
      return;
    }
    void ensureThread({}).then(setThreadId);
  }, [ensureThread, threadId, threads]);

  const thread = useQuery(api.chat.getThread, threadId ? { threadId } : "skip");
  const paginated = useUIMessages(
    api.chat.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 30 },
  );
  const messages = useMemo(
    () => [...paginated.results].reverse(),
    [paginated.results],
  );
  const latestMessage = messages.at(-1);
  const deleteTarget = threads?.find((item) => item._id === deleteTargetId);
  const currentThreadDeleting = Boolean(
    threadId && deletingThreadIds.has(threadId),
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, latestMessage?.parts.length, latestMessage?.status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!threadId || !text || submitting || currentThreadDeleting) return;
    setSubmitting(true);
    setMessage("");
    try {
      await sendMessage({
        clientMessageId: crypto.randomUUID(),
        message: text,
        threadId,
      });
    } catch {
      setMessage(text);
    } finally {
      setSubmitting(false);
    }
  }

  async function startThread() {
    const id = await createThread({});
    setThreadId(id);
    setMessage(suggestedPrompt);
  }

  async function removeThread(targetId: string) {
    setDeleteTargetId(undefined);
    setDeletingThreadIds((current) => new Set(current).add(targetId));
    setDeleteError(undefined);
    try {
      await deleteThread({ threadId: targetId });
      if (threadIdRef.current === targetId) {
        const remaining =
          threads?.filter(
            (item) => item._id !== targetId && !deletingThreadIds.has(item._id),
          ) ?? [];
        setThreadId(remaining[0]?._id);
        if (remaining.length === 0) {
          setThreadId(await createThread({}));
        }
      }
    } catch {
      setDeleteError("Could not delete the conversation. Please try again.");
    } finally {
      setDeletingThreadIds((current) => {
        const next = new Set(current);
        next.delete(targetId);
        return next;
      });
    }
  }

  return (
    <div className="grid h-svh min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)_360px]">
      <aside className="hidden min-h-0 overflow-hidden border-r lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Dumbbell className="size-4" /> Performance Coach
        </div>
        <div className="p-3">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => void startThread()}
          >
            <MessageSquarePlus /> New conversation
          </Button>
        </div>
        <Separator />
        <ScrollArea className="min-h-0 flex-1 p-3">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
            RECENT THREADS
          </p>
          <div className="space-y-1">
            {threads?.map((item) => {
              const isDeleting = deletingThreadIds.has(item._id);
              return (
                <div
                  key={item._id}
                  aria-busy={isDeleting}
                  className={`group relative min-w-0 transition-opacity ${
                    isDeleting ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  <Button
                    variant={item._id === threadId ? "secondary" : "ghost"}
                    className="grid h-auto w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] justify-start gap-2 overflow-hidden py-2 pr-9 text-left"
                    onClick={() => setThreadId(item._id)}
                    disabled={isDeleting}
                  >
                    <span className="truncate" title={item.title}>
                      {item.title}
                    </span>
                    {item.status === "failed" ? (
                      <Badge
                        variant="destructive"
                        className="shrink-0 group-hover:invisible group-focus-within:invisible"
                      >
                        failed
                      </Badge>
                    ) : null}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-muted data-[state=open]:opacity-100"
                        aria-label={`Conversation options for ${item.title}`}
                        disabled={isDeleting}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      className="w-40"
                    >
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setDeleteError(undefined);
                          setDeleteTargetId(item._id);
                        }}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md p-2">
            <Avatar className="size-8">
              <AvatarFallback>AM</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Alex Morgan</p>
              <p className="text-xs text-muted-foreground">Example profile</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu />
                  <span className="sr-only">Open agent operations</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[90vw] p-0 sm:max-w-sm">
                <SheetTitle className="sr-only">Agent operations</SheetTitle>
                <OperationsPanel thread={thread} />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-sm font-medium">
                {thread?.title ?? "Recovery-aware training"}
              </p>
              <p className="text-xs text-muted-foreground">
                Performance coach · Eve session
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {currentThreadDeleting
                ? "deleting"
                : formatStatus(thread?.status)}
            </Badge>
            <AlertDialog
              open={Boolean(deleteTargetId)}
              onOpenChange={(open) => {
                if (!open) setDeleteTargetId(undefined);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes “{deleteTarget?.title}” and its
                    messages from Convex. Its Eve session will also be
                    cancelled, cleared, and retired. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (deleteTargetId) void removeThread(deleteTargetId);
                    }}
                  >
                    Delete conversation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ModeToggle />
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-lg py-20 text-center">
                <Dumbbell className="mx-auto mb-4 size-8 text-muted-foreground" />
                <h1 className="text-xl font-semibold">
                  Meet your performance coach
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  One Eve agent can delegate to training, recovery, and
                  nutrition specialists while Convex keeps this conversation
                  reactive and resumable across devices.
                </p>
              </div>
            ) : (
              messages.map((item) => (
                <Message
                  key={item._id}
                  message={item}
                  disabled={
                    thread?.status === "streaming" || currentThreadDeleting
                  }
                  onRespond={(requestId, optionId) =>
                    threadId
                      ? respondToInput({
                          responses: [{ optionId, requestId }],
                          threadId,
                        })
                      : Promise.resolve()
                  }
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-4">
          {deleteError ? (
            <div
              role="alert"
              className="mx-auto mb-3 flex max-w-3xl items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              <CircleAlert className="size-4 shrink-0 text-destructive" />
              <p>{deleteError}</p>
            </div>
          ) : null}
          {thread?.status === "failed" ? (
            <div
              role="alert"
              className="mx-auto mb-3 flex max-w-3xl items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              <div className="flex min-w-0 items-start gap-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">This conversation stopped</p>
                  <p className="text-muted-foreground">
                    The Eve run failed before it produced a response. Start a
                    new conversation after checking the deployment and model
                    access.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => void startThread()}
              >
                New conversation
              </Button>
            </div>
          ) : null}
          <form onSubmit={submit} className="mx-auto max-w-3xl">
            <div className="relative">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message your performance coach…"
                className="min-h-24 resize-none pr-14"
                disabled={
                  !threadId ||
                  currentThreadDeleting ||
                  thread?.status === "streaming" ||
                  thread?.status === "failed"
                }
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-3 bottom-3"
                disabled={
                  submitting ||
                  !threadId ||
                  currentThreadDeleting ||
                  !message.trim() ||
                  thread?.status === "streaming" ||
                  thread?.status === "failed"
                }
              >
                <Send />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Convex persists the app-facing thread; Eve owns the durable agent
              session and execution.
            </p>
          </form>
        </div>
      </main>

      <aside className="hidden min-h-0 overflow-hidden border-l lg:block">
        <OperationsPanel thread={thread} />
      </aside>
    </div>
  );
}

function Message({
  message,
  disabled,
  onRespond,
}: {
  message: PersistedEveMessage;
  disabled: boolean;
  onRespond: (requestId: string, optionId: string) => Promise<unknown>;
}) {
  const user = message.role === "user";
  return (
    <div className="flex gap-3">
      <Avatar className="size-8">
        <AvatarFallback>
          {user ? <UserRound className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={
          user
            ? "max-w-[85%] rounded-lg bg-muted px-4 py-3 text-sm"
            : "min-w-0 flex-1 space-y-3 text-sm leading-6"
        }
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            if (user) {
              return <p key={`${part.type}-${index}`}>{part.text}</p>;
            }
            return (
              <Streamdown
                key={`${part.type}-${index}`}
                animated
                isAnimating={message.status === "streaming"}
              >
                {part.text}
              </Streamdown>
            );
          }
          if (part.type === "dynamic-tool") {
            const request = part.toolMetadata?.eve?.inputRequest;
            return (
              <div
                key={part.toolCallId}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{part.toolName}</p>
                    <p className="text-xs text-muted-foreground">
                      {part.state}
                    </p>
                  </div>
                  <Badge variant="outline">Eve tool</Badge>
                </div>
                {request ? (
                  <div className="mt-4 space-y-3">
                    <p>{request.prompt}</p>
                    <div className="flex flex-wrap gap-2">
                      {request.options?.map((option) => (
                        <Button
                          key={option.id}
                          size="sm"
                          variant={
                            option.style === "primary" ? "default" : "outline"
                          }
                          disabled={
                            disabled || part.state !== "approval-requested"
                          }
                          onClick={() =>
                            void onRespond(request.requestId, option.id)
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }
          if (part.type === "authorization") {
            return (
              <div
                key={`${part.type}-${index}`}
                className="rounded-lg border p-4"
              >
                <p className="font-medium">{part.displayName}</p>
                <p>{part.description}</p>
                {part.authorization?.url ? (
                  <Button asChild size="sm" className="mt-3">
                    <a href={part.authorization.url}>Connect</a>
                  </Button>
                ) : null}
              </div>
            );
          }
          return null;
        })}
        {message.status === "failed" ? (
          <p className="text-xs text-destructive">
            Delivery failed. Check the Eve deployment settings.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatStatus(status?: string) {
  if (!status) return "Loading";
  return status.replace("_", " ");
}
