/**
 * Mock token list. Real deployment would query the pumpdotfun-sdk's
 * indexed token feed (or an RPC scan of PumpProgram state accounts).
 * Shape mirrors the SDK's `BondingCurveAccount` so swapping in real
 * data is a drop-in.
 */
import { DEFAULT_PARAMS, type CurveParams } from "./curve";

export interface LaunchedToken {
  mint: string;
  name: string;
  symbol: string;
  emoji: string;
  creator: string;
  description: string;
  createdAt: number;
  curve: CurveParams;
}

const NOW = Date.now();

function mkCurve(realSol: bigint, realToken: bigint): CurveParams {
  return { ...DEFAULT_PARAMS, realSol, realToken };
}

export const MOCK_TOKENS: LaunchedToken[] = [
  {
    mint: "Bomb1KittEn9999999999999999999999999999999999",
    name: "Bomb Kitten",
    symbol: "BKITTY",
    emoji: "🧨",
    creator: "8oGc…3k1",
    description: "The cat that lights its own fuse.",
    createdAt: NOW - 1000 * 60 * 14,
    curve: mkCurve(42_500_000_000n, 540_000_000_000_000n),
  },
  {
    mint: "Bomb2RugBoy8888888888888888888888888888888888",
    name: "Rug Boy",
    symbol: "RUGBOY",
    emoji: "🪤",
    creator: "3Fqm…xQe",
    description: "Definitely not a rug. Trust me.",
    createdAt: NOW - 1000 * 60 * 3,
    curve: mkCurve(2_100_000_000n, 770_000_000_000_000n),
  },
  {
    mint: "Bomb3ChadCoin77777777777777777777777777777777",
    name: "Chad Coin",
    symbol: "CHAD",
    emoji: "💪",
    creator: "9aRx…pLs",
    description: "For gentlemen and scholars. No paper hands.",
    createdAt: NOW - 1000 * 60 * 60 * 2,
    curve: mkCurve(80_000_000_000n, 150_000_000_000_000n),
  },
  {
    mint: "Bomb4PepeSol66666666666666666666666666666666",
    name: "Pepe on Sol",
    symbol: "SPEPE",
    emoji: "🐸",
    creator: "DbHc…f2e",
    description: "The one, the only, now on Solana.",
    createdAt: NOW - 1000 * 60 * 90,
    curve: mkCurve(18_700_000_000n, 680_000_000_000_000n),
  },
  {
    mint: "Bomb5DogWifHat55555555555555555555555555555555",
    name: "Dog Wif Hat",
    symbol: "DWH",
    emoji: "🐶",
    creator: "5Zkp…nTr",
    description: "He's a good boy. He has a hat.",
    createdAt: NOW - 1000 * 60 * 24,
    curve: mkCurve(31_200_000_000n, 620_000_000_000_000n),
  },
  {
    mint: "Bomb6Launch4444444444444444444444444444444444",
    name: "To The Moon",
    symbol: "MOON",
    emoji: "🚀",
    creator: "7wZy…Q4a",
    description: "Literally going to the moon. Bullish.",
    createdAt: NOW - 1000 * 30,
    curve: mkCurve(500_000_000n, 792_000_000_000_000n),
  },
];
