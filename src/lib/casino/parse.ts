import { isTableChip, TABLE_MAX } from "@/lib/blackjack/money";
import type { PitOp } from "./types";

const OPS = new Set([
  "seat",
  "sync",
  "addChip",
  "clearBet",
  "rebet",
  "rebetDeal",
  "countBet",
  "deal",
  "hit",
  "stand",
  "double",
  "split",
  "surrender",
  "insure",
  "setSoft17",
  "refill",
  "newSession",
  "setLossLimit",
  "cooloff",
  "selfExclude",
  "ackReality",
]);

export function parseOp(raw: unknown): PitOp {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("invalid action");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.op !== "string" || !OPS.has(o.op)) throw new Error("invalid action");
  switch (o.op) {
    case "seat":
      if (o.ageAttest !== true) throw new Error("confirm you are of legal age");
      return { op: "seat", ageAttest: true };
    case "addChip":
      if (!isTableChip(o.n)) throw new Error("invalid chip");
      if (o.rail !== "main" && o.rail !== "plus3") throw new Error("invalid rail");
      return { op: "addChip", n: o.n, rail: o.rail };
    case "insure":
      if (typeof o.yes !== "boolean") throw new Error("invalid insurance");
      return { op: "insure", yes: o.yes };
    case "setSoft17":
      if (typeof o.v !== "boolean") throw new Error("invalid rule");
      return { op: "setSoft17", v: o.v };
    case "setLossLimit": {
      const amount = o.amount;
      if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0 || amount > TABLE_MAX * 40) {
        throw new Error("invalid loss limit");
      }
      return { op: "setLossLimit", amount };
    }
    case "cooloff": {
      const hours = o.hours;
      if (hours !== 1 && hours !== 24 && hours !== 72) throw new Error("invalid cool-off");
      return { op: "cooloff", hours };
    }
    case "selfExclude": {
      const days = o.days;
      if (days !== 1 && days !== 7 && days !== 30) throw new Error("invalid self-exclude");
      return { op: "selfExclude", days };
    }
    default:
      return { op: o.op } as PitOp;
  }
}
