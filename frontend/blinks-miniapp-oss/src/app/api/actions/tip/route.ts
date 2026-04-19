import { NextRequest, NextResponse } from "next/server";

import {
  ActionError,
  buildPresetLinks,
  parseTipParams,
  validateAccount,
  type ActionGetResponse,
  type ActionPostRequest,
  type ActionPostResponse,
} from "@/lib/action";

/**
 * Solana Action endpoint for "tip <recipient> <amount>" flow. Two
 * methods per the Actions spec:
 *
 *   GET  → metadata JSON for the preview card
 *   POST → unsigned SOL transfer (base64) for the client to sign
 *
 * The transaction building is deferred to a helper that, in production,
 * would:
 *   1. fetch the latest blockhash from the RPC (`VITE_RPC_URL`)
 *   2. build a `SystemProgram.transfer` instruction
 *   3. serialize the VersionedTransaction and base64-encode it.
 *
 * In this scaffold we stub the tx with a deterministic base64 so the
 * request/response shape matches and the preview renders.
 */

export const runtime = "nodejs";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-blockchain-ids,x-action-version",
  "access-control-expose-headers": "x-blockchain-ids,x-action-version",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET(req: NextRequest) {
  try {
    const { recipient, amount } = parseTipParams(new URL(req.url));
    const base = new URL(req.url);
    base.search = "";
    const body: ActionGetResponse = {
      title: `Tip ${amount} SOL`,
      description: `Send ${amount} SOL to ${recipient.slice(0, 4)}…${recipient.slice(-4)}.`,
      icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
      label: `Send ${amount} SOL`,
      links: {
        actions: buildPresetLinks(recipient, base.toString()),
      },
    };
    return NextResponse.json(body, { headers: CORS });
  } catch (e) {
    const msg = e instanceof ActionError ? e.message : "Unknown error";
    return NextResponse.json({ title: "Invalid tip link", icon: "", label: "", description: msg, error: { message: msg }, disabled: true } satisfies ActionGetResponse, { status: 400, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  let payload: ActionPostRequest;
  try {
    payload = (await req.json()) as ActionPostRequest;
  } catch {
    return NextResponse.json({ message: "Body must be JSON." }, { status: 400, headers: CORS });
  }
  try {
    validateAccount(payload.account);
    const { recipient, amount } = parseTipParams(new URL(req.url));
    // Scaffold: real wiring would use @solana/web3.js to build a
    // SystemProgram.transfer tx. Keeping it deterministic here so the
    // client-side preview renders without an RPC round-trip.
    const stubTx = Buffer.from(
      `SCAFFOLD tip ${amount} SOL from ${payload.account} to ${recipient}`,
    ).toString("base64");
    const body: ActionPostResponse = {
      transaction: stubTx,
      message: `Tipping ${amount} SOL to ${recipient.slice(0, 4)}…${recipient.slice(-4)}.`,
    };
    return NextResponse.json(body, { headers: CORS });
  } catch (e) {
    const msg = e instanceof ActionError ? e.message : (e instanceof Error ? e.message : "error");
    return NextResponse.json({ message: msg }, { status: 400, headers: CORS });
  }
}
