import { describe, expect, it } from "vitest";
import { canClaimDelivery, type DeliveryState } from "./delivery";

describe("delivery dispatch claims", () => {
  it.each(["queued", "failed"] satisfies DeliveryState[])(
    "allows %s deliveries to be claimed",
    (state) => {
      expect(canClaimDelivery(state)).toBe(true);
    },
  );

  it.each(["dispatching", "streaming", "accepted"] satisfies DeliveryState[])(
    "rejects a second claim for %s deliveries",
    (state) => {
      expect(canClaimDelivery(state)).toBe(false);
    },
  );
});
