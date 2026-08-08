export type DeliveryState =
  | "accepted"
  | "dispatching"
  | "failed"
  | "queued"
  | "streaming";

/** Only queued and explicitly failed deliveries may acquire a dispatch claim. */
export function canClaimDelivery(state: DeliveryState): boolean {
  return state === "queued" || state === "failed";
}
