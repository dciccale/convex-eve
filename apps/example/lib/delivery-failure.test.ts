import { ClientError } from "eve/client";
import { describe, expect, it } from "vitest";
import { EveCreateRejectedError } from "./create-eve-session";
import { classifyDeliveryFailure } from "./delivery-failure";

describe("delivery failure classification", () => {
  it("allows retry after preflight and explicit HTTP rejection", () => {
    expect(classifyDeliveryFailure("preflight", new Error("bad config"))).toBe(
      "failed",
    );
    expect(
      classifyDeliveryFailure("request", new ClientError(409, "rejected")),
    ).toBe("failed");
    expect(
      classifyDeliveryFailure(
        "request",
        new EveCreateRejectedError(401, "unauthorized"),
      ),
    ).toBe("failed");
  });

  it("blocks retry after transport ambiguity or accepted dispatch", () => {
    expect(
      classifyDeliveryFailure("request", new TypeError("socket reset")),
    ).toBe("unknown");
    expect(classifyDeliveryFailure("accepted", new Error("stream lost"))).toBe(
      "unknown",
    );
  });
});
