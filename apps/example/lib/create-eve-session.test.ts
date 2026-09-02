import { describe, expect, it, vi } from "vitest";
import {
  createEveSessionOnce,
  EveCreateRejectedError,
  EveCreateResponseError,
} from "./create-eve-session";

describe("idempotent Eve session creation", () => {
  it("sends the stable operation ID and accepts a validated session ID", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { ok: true, sessionId: "session-1", status: "accepted" },
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
    ).resolves.toEqual({ sessionId: "session-1" });

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
    ).rejects.toBeInstanceOf(EveCreateRejectedError);
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
    ).rejects.toBeInstanceOf(EveCreateResponseError);
  });
});
