import { describe, expect, it, vi } from "vitest";
import {
  createEveSessionOnce,
  EveReceiptError,
  EveRequestRejectedError,
  sendEveInput,
} from "./create-eve-session";

describe("idempotent Eve session creation", () => {
  it("sends the stable operation ID and accepts a validated session ID", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { ok: true, sessionId: "session-1", deliveryId: "native-1" },
          { status: 202 },
        ),
      );

    await expect(
      createEveSessionOnce(
        {
          host: "https://agent.example.com",
          message: "hello",
          operationId: "delivery-1",
          token: "secret",
        },
        request,
      ),
    ).resolves.toEqual({ sessionId: "session-1", deliveryId: "native-1" });

    const [url, init] = request.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://agent.example.com/eve/v1/session");
    expect(init?.body).toBe(
      JSON.stringify({ message: "hello", operationId: "delivery-1" }),
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
  });

  it("distinguishes a known HTTP rejection", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("not active", { status: 409 }));

    await expect(
      createEveSessionOnce(
        {
          host: "https://agent.example.com",
          message: "hello",
          operationId: "delivery-1",
        },
        request,
      ),
    ).rejects.toBeInstanceOf(EveRequestRejectedError);
  });

  it("treats an accepted response without a session ID as ambiguous", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }, { status: 202 }));

    await expect(
      createEveSessionOnce(
        {
          host: "https://agent.example.com",
          message: "hello",
          operationId: "delivery-1",
        },
        request,
      ),
    ).rejects.toBeInstanceOf(EveReceiptError);
  });
});

describe("keyed v27 input delivery", () => {
  it("sends a stable message key and refuses a different session receipt", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ sessionId: "session-1", deliveryId: "native-1" }),
      );
    const args = {
      host: "https://agent.example.com",
      token: "secret",
      sessionId: "session-1",
      idempotencyKey: "convex-eve:message-1",
      input: { message: "hello", turnPolicy: "queue" as const },
    };
    await expect(sendEveInput(args, request)).resolves.toEqual({
      sessionId: "session-1",
      deliveryId: "native-1",
    });
    const [url, init] = request.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://agent.example.com/eve/v1/session/session-1",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      message: "hello",
      turnPolicy: "queue",
      idempotencyKey: "convex-eve:message-1",
    });
    expect(init?.redirect).toBe("error");
    request.mockResolvedValue(
      Response.json({ sessionId: "other", deliveryId: "native-1" }),
    );
    await expect(sendEveInput(args, request)).rejects.toBeInstanceOf(
      EveReceiptError,
    );
  });
  it("uses answers and interactionId for approval responses", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ deliveryId: "answer-1" }));
    await sendEveInput(
      {
        host: "https://agent.example.com",
        sessionId: "session-1",
        idempotencyKey: "answer-key",
        input: {
          answers: [{ interactionId: "interaction-1", optionId: "deny" }],
        },
      },
      request,
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
      idempotencyKey: "answer-key",
      answers: [{ interactionId: "interaction-1", optionId: "deny" }],
    });
  });
});
