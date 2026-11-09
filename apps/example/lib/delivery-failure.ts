import { ClientError } from "eve/client";
import { EveRequestRejectedError } from "./create-eve-session";

export type DispatchPhase = "accepted" | "preflight" | "request";

export type DeliveryFailureKind = "failed" | "unknown";

/** Classify whether Eve is known to have rejected the request. */
export function classifyDeliveryFailure(
  phase: DispatchPhase,
  error: unknown,
): DeliveryFailureKind {
  if (phase === "preflight") return "failed";
  if (
    phase === "request" &&
    ((ClientError.is(error) && error.status >= 400 && error.status < 500) ||
      (error instanceof EveRequestRejectedError &&
        error.status >= 400 &&
        error.status < 500))
  ) {
    return "failed";
  }
  return "unknown";
}
