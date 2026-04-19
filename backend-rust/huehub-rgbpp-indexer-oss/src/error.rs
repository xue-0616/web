#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("config: {0}")]
    Config(#[from] crate::config::ConfigError),
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("dao: {0}")]
    Dao(String),
    #[error("chain: {0}")]
    Chain(String),
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl From<Error> for jsonrpsee::types::ErrorObjectOwned {
    fn from(e: Error) -> Self {
        use jsonrpsee::types::ErrorObjectOwned;
        let (code, msg): (i32, String) = match &e {
            Error::NotFound => (-32004, "not found".into()),
            Error::BadRequest(m) => (-32602, m.clone()),
            Error::Config(_) | Error::Chain(_) | Error::Dao(_) | Error::Internal(_) | Error::Serde(_) => {
                (-32603, e.to_string())
            }
        };
        ErrorObjectOwned::owned::<()>(code, msg, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonrpsee::types::ErrorObjectOwned;

    #[test]
    fn not_found_is_32004() {
        let e: ErrorObjectOwned = Error::NotFound.into();
        assert_eq!(e.code(), -32004);
    }
    #[test]
    fn bad_request_is_invalid_params() {
        let e: ErrorObjectOwned = Error::BadRequest("x".into()).into();
        assert_eq!(e.code(), -32602);
    }
    #[test]
    fn internal_is_32603() {
        let e: ErrorObjectOwned = Error::Internal("x".into()).into();
        assert_eq!(e.code(), -32603);
    }
    #[test]
    fn dao_is_32603() {
        let e: ErrorObjectOwned = Error::Dao("db".into()).into();
        assert_eq!(e.code(), -32603);
    }
}
