import { ECPairFactory, ECPairInterface } from 'ecpair';
import { Message, PrivateKey, PublicKey, crypto } from 'bitcore-lib';
import ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);
export function signMessageOfECDSA(privateKey: any, text: any) {
    const keyPair = privateKey;
    const message = new Message(text);
    return message.sign(new PrivateKey(keyPair.privateKey));
}
export function verifyMessageOfECDSA(publicKey: any, text: any, sig: any) {
    const message = new Message(text);
    var signature = crypto.Signature.fromCompact(Buffer.from(sig, 'base64'));
    var hash = message.magicHash();
    var ecdsa = new crypto.ECDSA();
    ecdsa.hashbuf = hash;
    ecdsa.sig = signature;
    const pubkeyInSig = ecdsa.toPublicKey();
    const pubkeyInSigString = new PublicKey(Object.assign({}, pubkeyInSig.toObject(), { compressed: true })).toString();
    if (pubkeyInSigString != publicKey) {
        return false;
    }
    return crypto.ECDSA.verify(hash, signature, pubkeyInSig);
}
export const validatorPsbt = (pubkey: any, msghash: any, signature: any) => ECPair.fromPublicKey(pubkey).verify(msghash, signature);
