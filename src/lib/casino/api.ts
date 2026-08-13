import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseOp } from "./parse";
import type { HandRow, PitStats, PitView } from "./types";

export const tableAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => parseOp(raw))
  .handler(async ({ context, data }): Promise<PitView> => {
    const { runTable } = await import("./table.server");
    return runTable(context.userId, data);
  });

export const fetchTable = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PitView> => {
    const { runTable } = await import("./table.server");
    return runTable(context.userId, { op: "sync" });
  });

export const fetchHands = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<HandRow[]> => {
    const { listHands } = await import("./table.server");
    return listHands(context.userId);
  });

export const fetchPitStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PitStats> => {
    const { listStats } = await import("./table.server");
    return listStats(context.userId);
  });
