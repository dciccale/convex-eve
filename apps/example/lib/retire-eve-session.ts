import { type ClientSession, SessionNotActiveError } from "eve/client";

type RetirableSession = Pick<
  ClientSession,
  "cancel" | "clear" | "end" | "stream"
>;

export async function retireEveSession(session: RetirableSession) {
  try {
    for (const control of [
      () => session.cancel(),
      () => session.clear(),
      () => session.end({ reason: "convex_thread_deleted" }),
    ]) {
      const delivery = await control();
      let outcome: string | undefined;
      let settled = false;
      // rc.7's end Delivery.result() uses a bounded read. That read can reach
      // its tail before end settles. Follow the session until this receipt's
      // complete settlement line instead.
      for await (const event of session.stream({
        startIndex: 0,
        follow: true,
        signal: AbortSignal.timeout(60_000),
      })) {
        if (
          event.type === "delivery.settled" &&
          event.data.deliveryId === delivery.deliveryId
        )
          outcome = event.data.outcome;
        if (outcome && event.meta.endOfLine !== false) {
          settled = true;
          break;
        }
      }
      if (!settled || !outcome || outcome === "failed" || outcome === "refused")
        throw new Error("Eve session control did not complete.");
    }
  } catch (error) {
    if (!SessionNotActiveError.is(error) || error.code !== "session_not_active")
      throw error;
  }
}
