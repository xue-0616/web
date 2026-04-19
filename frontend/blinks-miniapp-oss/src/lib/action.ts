/**
 * Pure helpers for the Solana Actions spec (ActionGetResponse +
 * ActionPostRequest + ActionPostResponse). Kept separate from the
 * Next.js route handlers so the business logic is unit-testable
 * without spinning up Next.
 *
 * Spec: https://solana.com/docs/advanced/actions
 */

export interface ActionLink {
  label: string;
  href: string;
  parameters?: ActionParameter[];
}

export interface ActionParameter {
  name: string;
  label: string;
  required?: boolean;
}

export interface ActionGetResponse {
  title: string;
  description: string;
  icon: string;
  label: string;
  disabled?: boolean;
  error?: { message: string };
  links?: { actions: ActionLink[] };
}

export interface ActionPostRequest {
  account: string;
}

export interface ActionPostResponse {
  transaction: string; // base64-encoded unsigned tx
  message?: string;
}

/**
 * Tight URL-param extractor with defaults. Returns a typed shape so
 * route handlers don't sprinkle `searchParams.get("amount") ?? "0.01"`
 * everywhere.
 */
export interface TipParams {
  recipient: string;
  amount: number;
}

export class ActionError extends Error {
  constructor(public readonly code: "bad-param" | "invalid-account", message: string) {
    super(message);
    this.name = "ActionError";
  }
}

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function parseTipParams(url: URL): TipParams {
  const recipient = url.searchParams.get("recipient") ?? "";
  const raw = url.searchParams.get("amount") ?? "0.01";
  if (!SOLANA_ADDR_RE.test(recipient)) {
    throw new ActionError("bad-param", `Recipient must be a base58 Solana address; got "${recipient}".`);
  }
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ActionError("bad-param", `Amount must be a positive number; got "${raw}".`);
  }
  if (amount > 1000) {
    throw new ActionError("bad-param", "Amount capped at 1000 SOL for safety.");
  }
  return { recipient, amount };
}

export function validateAccount(acc: string): void {
  if (!SOLANA_ADDR_RE.test(acc)) {
    throw new ActionError("invalid-account", `Payer is not a valid Solana address: "${acc}".`);
  }
}

/**
 * Build a preset-amount action menu from a single recipient. Returned
 * shape matches ActionGetResponse.links.actions and is rendered as
 * pill buttons by Blink clients.
 */
export function buildPresetLinks(recipient: string, baseHref: string, presets = [0.01, 0.05, 0.1, 0.5]): ActionLink[] {
  return presets.map((amt) => ({
    label: `${amt} SOL`,
    href: `${baseHref}?recipient=${recipient}&amount=${amt}`,
  }));
}
