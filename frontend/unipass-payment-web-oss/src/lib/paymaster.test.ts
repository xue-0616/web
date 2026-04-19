import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPaymasterClient, PaymasterError, validateUserOp, type UserOperation } from "./paymaster";

const VALID_OP: UserOperation = {
  sender: "0x" + "a".repeat(40),
  nonce: "0x1",
  initCode: "0x",
  callData: "0x",
  callGasLimit: "0x9c40",
  verificationGasLimit: "0xf4240",
  preVerificationGas: "0x5208",
  maxFeePerGas: "0x59682f00",
  maxPriorityFeePerGas: "0x59682f00",
  paymasterAndData: "0x",
  signature: "0x",
};

function mkResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("validateUserOp", () => {
  it("accepts well-formed op", () => {
    expect(validateUserOp(VALID_OP)).toBe(true);
  });
  it("rejects missing fields", () => {
    const { callData, ...partial } = VALID_OP;
    expect(validateUserOp(partial)).toBe(false);
    // satisfy unused-var lint
    void callData;
  });
  it("rejects non-hex values", () => {
    expect(validateUserOp({ ...VALID_OP, nonce: "1" })).toBe(false);
  });
});

describe("createPaymasterClient", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
  const captureFetch = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

  it("supportedEntryPoints returns the result field", async () => {
    captureFetch().mockResolvedValueOnce(
      mkResp({ jsonrpc: "2.0", id: 1, result: ["0xEP1"] }),
    );
    const c = createPaymasterClient("http://rpc");
    expect(await c.supportedEntryPoints()).toEqual(["0xEP1"]);
  });

  it("sponsorUserOperation sends the op and ep as positional params", async () => {
    captureFetch().mockResolvedValueOnce(
      mkResp({ jsonrpc: "2.0", id: 1, result: { paymasterAndData: "0xabc" } }),
    );
    const c = createPaymasterClient("http://rpc");
    const out = await c.sponsorUserOperation(VALID_OP, "0xEP1");
    expect(out.paymasterAndData).toBe("0xabc");
    const init = captureFetch().mock.calls[0][1];
    const body = JSON.parse(init.body as string);
    expect(body.method).toBe("pm_sponsorUserOperation");
    expect(body.params[0]).toEqual(VALID_OP);
    expect(body.params[1]).toBe("0xEP1");
  });

  it("monotonic id increments across calls", async () => {
    captureFetch()
      .mockResolvedValueOnce(mkResp({ jsonrpc: "2.0", id: 1, result: [] }))
      .mockResolvedValueOnce(mkResp({ jsonrpc: "2.0", id: 2, result: [] }));
    const c = createPaymasterClient("http://rpc");
    await c.supportedEntryPoints();
    await c.supportedEntryPoints();
    const bodies = captureFetch().mock.calls.map((c: [string, RequestInit]) =>
      JSON.parse(c[1].body as string),
    );
    expect(bodies[1].id).toBe(bodies[0].id + 1);
  });

  it("throws PaymasterError when server returns an RPC error", async () => {
    captureFetch().mockResolvedValueOnce(
      mkResp({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "chain not supported" } }),
    );
    const c = createPaymasterClient("http://rpc");
    await expect(c.sponsorUserOperation(VALID_OP, "0xEP")).rejects.toMatchObject({
      name: "PaymasterError",
      code: -32000,
      message: "chain not supported",
    });
  });

  it("throws PaymasterError on HTTP failure", async () => {
    captureFetch().mockResolvedValueOnce(mkResp({ x: 1 }, 502));
    const c = createPaymasterClient("http://rpc");
    await expect(c.supportedEntryPoints()).rejects.toBeInstanceOf(PaymasterError);
  });

  it("throws on malformed body (no result, no error)", async () => {
    captureFetch().mockResolvedValueOnce(mkResp({ jsonrpc: "2.0", id: 1 }));
    const c = createPaymasterClient("http://rpc");
    await expect(c.supportedEntryPoints()).rejects.toBeInstanceOf(PaymasterError);
  });
});
