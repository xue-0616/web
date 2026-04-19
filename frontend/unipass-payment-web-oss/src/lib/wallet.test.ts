import { describe, expect, it } from "vitest";

import { classifyError } from "./wallet";

describe("classifyError", () => {
  it.each([
    "user rejected the request",
    "User Rejected action",
    "request denied by user",
    "user_rejected",
  ])("classifies %j as user_rejected", (m) => {
    const r = classifyError(new Error(m));
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.cause).toBe("user_rejected");
  });

  it.each([
    "insufficient funds for gas",
    "INSUFFICIENT_FUNDS",
  ])("classifies %j as insufficient_funds", (m) => {
    const r = classifyError(new Error(m));
    if (r.kind === "error") expect(r.cause).toBe("insufficient_funds");
  });

  it("falls through to unknown", () => {
    const r = classifyError(new Error("network blip"));
    if (r.kind === "error") expect(r.cause).toBe("unknown");
  });

  it("handles non-Error throwables", () => {
    const r = classifyError("oops");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toBe("oops");
  });
});
