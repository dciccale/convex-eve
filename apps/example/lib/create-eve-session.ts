import type { Answer } from "eve/events";

export class EveRequestRejectedError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EveRequestRejectedError";
  }
}
export class EveReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EveReceiptError";
  }
}
interface BridgeTarget {
  host: string;
  token?: string;
}
interface Receipt {
  sessionId: string;
  deliveryId: string;
}
type Fetch = typeof fetch;

async function post(
  args: BridgeTarget,
  path: string,
  payload: unknown,
  expectedSessionId: string | undefined,
  request: Fetch,
): Promise<Receipt> {
  const headers = new Headers({ "content-type": "application/json" });
  if (args.token) headers.set("authorization", `Bearer ${args.token}`);
  const response = await request(new URL(path, args.host), {
    body: JSON.stringify(payload),
    headers,
    method: "POST",
    redirect: "error",
  });
  if (!response.ok)
    throw new EveRequestRejectedError(
      response.status,
      (await response.text()).slice(0, 1_000),
    );
  const body: unknown = await response.json().catch(() => undefined);
  if (
    !body ||
    typeof body !== "object" ||
    !("deliveryId" in body) ||
    typeof body.deliveryId !== "string" ||
    !body.deliveryId
  )
    throw new EveReceiptError(
      "Eve accepted input but returned no delivery ID.",
    );
  const sessionId = "sessionId" in body ? body.sessionId : expectedSessionId;
  if (
    typeof sessionId !== "string" ||
    !sessionId ||
    (expectedSessionId && sessionId !== expectedSessionId)
  ) {
    throw new EveReceiptError(
      "Eve returned a missing or different session ID.",
    );
  }
  return { sessionId, deliveryId: body.deliveryId };
}

/** Create once under the authenticated caller's stable operation ID. */
export function createEveSessionOnce(
  args: BridgeTarget & { message: string; operationId: string },
  request: Fetch = fetch,
): Promise<Receipt> {
  return post(
    args,
    "/eve/v1/session",
    { message: args.message, operationId: args.operationId },
    undefined,
    request,
  );
}

/** rc.7 supports idempotencyKey on HTTP, but not in its client send options. */
export function sendEveInput(
  args: BridgeTarget & {
    sessionId: string;
    idempotencyKey: string;
    input:
      | { message: string; turnPolicy: "queue" }
      | { answers: readonly Answer[] };
  },
  request: Fetch = fetch,
): Promise<Receipt> {
  return post(
    args,
    `/eve/v1/session/${encodeURIComponent(args.sessionId)}`,
    { ...args.input, idempotencyKey: args.idempotencyKey },
    args.sessionId,
    request,
  );
}
