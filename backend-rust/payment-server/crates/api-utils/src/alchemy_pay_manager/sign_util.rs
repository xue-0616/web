/// AlchemyPay request signing — HMAC-SHA256 based
pub fn sign_request(secret_key: &str, params: &str) -> String {
    let sig = common::crypto::hmac_sha256(secret_key.as_bytes(), params.as_bytes());
    hex::encode(sig)
}
