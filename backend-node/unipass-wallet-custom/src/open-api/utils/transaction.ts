export const getTransactionList = <T>(
    customTransactions: T[],
    feeTransaction?: T | null,
): T[] => {
    let transactions = [...customTransactions];
    if (feeTransaction) {
        transactions = [...customTransactions, feeTransaction];
    }
    return transactions;
};
