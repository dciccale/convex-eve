export class EveCreateRejectedError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EveCreateRejectedError";
  }
}

export class EveCreateResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EveCreateResponseError";
  }
}

interface CreateEveSessionArgs {
  host: string;
  message: string;
  operationId: string;
  token?: string;
}

interface CreatedEveSession {
  sessionId: string;
}

type Fetch = typeof fetch;

/** Create one Eve session for one authenticated bridge operation. */
export async function createEveSessionOnce(
  args: CreateEveSessionArgs,
  request: Fetch = fetch,
): Promise<CreatedEveSession> {
  const headers = new Headers({ "content-type": "application/json" });
  if (args.token) headers.set("authorization", `Bearer ${args.token}`);

  const response = await request(new URL("/eve/v1/session", args.host), {
    body: JSON.stringify({
      message: args.message,
      operationId: args.operationId,
    }),
    headers,
    method: "POST",
    redirect: args.token ? "error" : undefined,
  });
  if (!response.ok) {
    throw new EveCreateRejectedError(
      response.status,
      (await response.text()).slice(0, 1_000),
    );
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (
    !body ||
    typeof body !== "object" ||
    !("sessionId" in body) ||
    typeof body.sessionId !== "string" ||
    body.sessionId.length === 0
  ) {
    throw new EveCreateResponseError(
      "Eve accepted the create request but returned no session ID.",
    );
  }
  return { sessionId: body.sessionId };
}
