import Decimal from 'decimal.js';
import moment, { duration as momentDuration, unix } from 'moment';
import { encode } from 'bs58';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

require("dotenv/config");
export function sleep(t: number): Promise<void> {
    return new Promise((res) => setTimeout(res, t));
}
export function shortenAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
export function formatCountdown(startTimestamp: number, countdown: number): string | null {
    const start = unix(startTimestamp);
    const end = start.add(countdown, 'hours');
    const now = moment();
    if (now.isAfter(end)) {
        return null;
    }
    const d = momentDuration(end.diff(now));
    const hours = Math.floor(d.asHours());
    const minutes = d.minutes();
    const seconds = d.seconds();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
export const encodeBase58 = (jsonString: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonString);
    const base58String = encode(bytes);
    return base58String;
};
export const calculateBounty = (initialAmount: Decimal, settledAmount: Decimal): Decimal => {
    return Decimal.max(0, settledAmount.minus(initialAmount));
};
export const lamportsToSol = (lamports: Decimal.Value): Decimal => {
    return new Decimal(lamports).div(LAMPORTS_PER_SOL);
};
export const calculatePlayerReward = (lotteryDrawAmount: Decimal.Value, pledgeAmount: Decimal.Value): Decimal => {
    return lamportsToSol(lotteryDrawAmount).minus(pledgeAmount);
};
