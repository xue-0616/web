export interface ILotteryDrawResults {
    creator: IBoxResults;
    grabs: IBoxResults[];
}
export interface IBoxResults {
    id: bigint;
    amount: string;
    type: 'bonus' | 'refund';
    isBomb: boolean;
}
