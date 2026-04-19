import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { MEMO_PROGRAM_ID } from '@solana/actions';

interface DistributeItem {
    type: 'bonus' | 'refund';
    account: PublicKey;
    amount: number | bigint;
}

export async function createMysteryBoxTransaction(creator: PublicKey, boxId: number | bigint, boxAmount: number | bigint, bombNumber: number | bigint, submitter: Keypair, solanaClient: Connection) {
    const instructions = createMysteryBoxInstructions(creator, boxId, boxAmount, bombNumber, submitter.publicKey);
    const { blockhash, lastValidBlockHeight } = await solanaClient.getLatestBlockhash();
    const transaction = new VersionedTransaction(new TransactionMessage({
        payerKey: creator,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message());
    transaction.sign([submitter]);
    return {
        tx: transaction,
        recentBlockHeight: lastValidBlockHeight,
    };
}
function createMysteryBoxInstructions(creator: PublicKey, boxId: number | bigint, boxAmount: number | bigint, bombNumber: number | bigint, submitterPublicKey: PublicKey) {
    const transferSolInstruction = SystemProgram.transfer({
        fromPubkey: creator,
        toPubkey: submitterPublicKey,
        lamports: boxAmount,
    });
    const memoInstruction = new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        keys: [
            {
                pubkey: submitterPublicKey,
                isSigner: true,
                isWritable: false,
            },
        ],
        data: createMysteryBoxMemo(boxId, boxAmount, bombNumber),
    });
    return [memoInstruction, transferSolInstruction];
}
function createMysteryBoxMemo(boxId: number | bigint, boxAmount: number | bigint, bombNumber: number | bigint) {
    const boxSolAmount = Number(boxAmount) / LAMPORTS_PER_SOL;
    const intl = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 9,
        useGrouping: false,
        notation: 'standard',
    });
    return Buffer.from(`${intl.format(boxId)}: Create ${intl.format(boxSolAmount)} SOL box with bomb number ${intl.format(bombNumber)} in bombfun.com`, 'utf8');
}
export async function grabMysteryBoxInstruction(boxId: number | bigint, grabId: number | bigint, grabAccount: PublicKey, grabAmount: number | bigint, submitter: Keypair, solanaClient: Connection) {
    const instructions = grabMysteryBoxInstructions(boxId, grabId, grabAccount, grabAmount, submitter.publicKey);
    const { blockhash, lastValidBlockHeight } = await solanaClient.getLatestBlockhash();
    const transaction = new VersionedTransaction(new TransactionMessage({
        payerKey: grabAccount,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message());
    transaction.sign([submitter]);
    return {
        tx: transaction,
        recentBlockHeight: lastValidBlockHeight,
    };
}
function grabMysteryBoxInstructions(boxId: number | bigint, grabId: number | bigint, grabAccount: PublicKey, grabAmount: number | bigint, submitterPublicKey: PublicKey) {
    const transferSolInstruction = SystemProgram.transfer({
        fromPubkey: grabAccount,
        toPubkey: submitterPublicKey,
        lamports: grabAmount,
    });
    const memoInstruction = new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        keys: [
            {
                pubkey: submitterPublicKey,
                isSigner: true,
                isWritable: false,
            },
        ],
        data: grabMysteryBoxMemo(boxId, grabId, grabAccount),
    });
    return [memoInstruction, transferSolInstruction];
}
function grabMysteryBoxMemo(boxId: number | bigint, grabId: number | bigint, account: PublicKey) {
    const intl = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 9,
        useGrouping: false,
        notation: 'standard',
    });
    return Buffer.from(`${intl.format(boxId)}-${intl.format(grabId)}: [${account.toBase58()}] Open in bombfun.com`, 'utf8');
}
export async function distributeMysteryBox(creator: PublicKey, boxId: number | bigint, boxLimit: number | bigint, boxCount: number | bigint, bombCount: number | bigint, distributes: DistributeItem[], submitter: Keypair, solanaClient: Connection) {
    const instructions = [
        new TransactionInstruction({
            programId: new PublicKey(MEMO_PROGRAM_ID),
            keys: [],
            data: distributeMysteryBoxMemo(creator, boxId, boxCount, boxLimit, bombCount, distributes),
        }),
    ];
    distributes.forEach((distribute: DistributeItem) => {
        switch (distribute.type) {
            case 'bonus': {
                instructions.push(...bonusMysteryBoxInstructions(boxId, distribute, submitter.publicKey));
                break;
            }
            case 'refund': {
                instructions.push(...refundMysteryBoxInstructions(boxId, distribute, submitter.publicKey));
                break;
            }
        }
    });
    const { blockhash, lastValidBlockHeight } = await solanaClient.getLatestBlockhash();
    const transaction = new VersionedTransaction(new TransactionMessage({
        payerKey: submitter.publicKey,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message());
    transaction.sign([submitter]);
    return {
        tx: transaction,
        recentBlockHeight: lastValidBlockHeight,
    };
}
function distributeMysteryBoxMemo(creator: PublicKey, boxId: number | bigint, boxCount: number | bigint, boxLimit: number | bigint, bombCount: number | bigint, distributes: DistributeItem[]) {
    const creatorDistribute = distributes.find((distribute: DistributeItem) => distribute.account.equals(creator) && distribute.type === 'bonus');
    const creatorBonus = creatorDistribute ? creatorDistribute.amount : 0n;
    const creatorSolBonus = Number(creatorBonus) / LAMPORTS_PER_SOL;
    return Buffer.from(`${boxId}: Record ${boxCount}/${boxLimit} hit ${bombCount} win ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 9,
        useGrouping: false,
        notation: 'standard',
    }).format(creatorSolBonus)} SOL`, 'utf8');
}
function bonusMysteryBoxInstructions(boxId: number | bigint, box: DistributeItem, submitterPublicKey: PublicKey) {
    const { account, amount } = box;
    const bonusInstruction = SystemProgram.transfer({
        fromPubkey: submitterPublicKey,
        toPubkey: account,
        lamports: amount,
    });
    const memoInstruction = new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        keys: [],
        data: bonusMysteryBoxMemo(boxId, box),
    });
    return [memoInstruction, bonusInstruction];
}
function bonusMysteryBoxMemo(boxId: number | bigint, box: DistributeItem) {
    const { amount, account } = box;
    const solAmount = Number(amount) / LAMPORTS_PER_SOL;
    return Buffer.from(`${boxId}: Reward ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 9,
        useGrouping: false,
        notation: 'standard',
    }).format(solAmount)} SOL to [${account.toBase58()}]`, 'utf8');
}
function refundMysteryBoxInstructions(boxId: number | bigint, box: DistributeItem, submitterPublicKey: PublicKey) {
    const { account, amount } = box;
    const refundInstruction = SystemProgram.transfer({
        fromPubkey: submitterPublicKey,
        toPubkey: account,
        lamports: amount,
    });
    const memoInstruction = new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        keys: [],
        data: refundMysteryBoxMemo(boxId, box),
    });
    return [memoInstruction, refundInstruction];
}
function refundMysteryBoxMemo(boxId: number | bigint, box: DistributeItem) {
    const { amount, account } = box;
    const solAmount = Number(amount) / LAMPORTS_PER_SOL;
    return Buffer.from(`${boxId}: Refund ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 9,
        useGrouping: false,
        notation: 'standard',
    }).format(solAmount)} SOL to [${account.toBase58()}]`, 'utf8');
}
