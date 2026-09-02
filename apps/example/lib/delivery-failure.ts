import { ClientError } from "eve/client";
import { EveCreateRejectedError } from "./create-eve-session";

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
    (error instanceof ClientError || error instanceof EveCreateRejectedError)
  ) {
    return "failed";
  }
  return "unknown";
}
