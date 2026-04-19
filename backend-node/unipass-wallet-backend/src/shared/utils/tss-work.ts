import { li17_p2_key_gen1, li17_p2_key_gen2, li17_p2_sign1, li17_p2_sign2 } from 'tss-wasm-node';

const getP2KeyGen1 = async (tssRes: any) => {
    const [context2, p2FirstMsg] = await li17_p2_key_gen1(tssRes.msg);
    return [context2, p2FirstMsg];
};
const getP2KeyGen2 = async (tssRes: any, content2: any) => {
    const [signContext2, pubkey] = await li17_p2_key_gen2(content2, tssRes.msg);
    return [signContext2, pubkey];
};
const getLi17P2Sign1 = async (localKey: any, msgHash: any) => {
    const [context1, message1] = await li17_p2_sign1(localKey, msgHash);
    return [context1, message1];
};
const getLi17P2Sign2 = async (context1: any, msgHash: any) => {
    const [partialSig, message2] = await li17_p2_sign2(context1, msgHash);
    return [partialSig, message2];
};
export const TssWorker = {
    getP2KeyGen1,
    getP2KeyGen2,
    getLi17P2Sign1,
    getLi17P2Sign2,
};
