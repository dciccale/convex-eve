import type { ClientSession } from "eve/client";

type RetirableSession = Pick<ClientSession, "cancel" | "clear" | "reset">;

export async function retireEveSession(session: RetirableSession) {
  await session.cancel();
  await session.clear();
  await session.reset({ reason: "convex_thread_deleted" });
}
