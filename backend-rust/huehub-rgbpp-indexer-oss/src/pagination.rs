//! Opaque pagination cursor helpers.
//!
//! Contract: `next` is `None` iff the server has no more records to
//! return. A client loop terminates when `next == None`. The cursor
//! itself is opaque — callers MUST treat it as a black-box string.

use crate::{
    error::Error,
    types::{PageCursor, TokenHolder},
};

pub const DEFAULT_LIMIT: u32 = 50;
pub const MAX_LIMIT: u32 = 500;

pub fn resolve_limit(requested: Option<u32>) -> u32 {
    match requested.unwrap_or(DEFAULT_LIMIT) {
        0 => DEFAULT_LIMIT,
        n if n > MAX_LIMIT => MAX_LIMIT,
        n => n,
    }
}

/// Given a fully-sorted slice of holders and a cursor, slice out the
/// next page + compute the new cursor. Pure function — easy to test.
pub fn page_holders(
    holders: &[TokenHolder],
    cursor: Option<&PageCursor>,
) -> Result<(Vec<TokenHolder>, Option<PageCursor>), Error> {
    let limit = resolve_limit(cursor.map(|c| c.limit));
    let after = cursor.and_then(|c| c.after.clone());

    let start = match &after {
        Some(a) => match holders.iter().position(|h| cursor_key(h) == *a) {
            Some(i) => i + 1,
            None => return Err(Error::BadRequest(format!("unknown cursor: {a:?}"))),
        },
        None => 0,
    };
    let end = (start + limit as usize).min(holders.len());
    let slice = holders[start..end].to_vec();

    let next = if end < holders.len() {
        Some(PageCursor {
            limit,
            after: slice.last().map(cursor_key),
        })
    } else {
        None
    };
    Ok((slice, next))
}

/// Derive the opaque cursor key for a holder. We use `"{token}:{account}"`
/// to be unique within a token-scoped page.
pub fn cursor_key(h: &TokenHolder) -> String {
    format!("{}:{}", h.token, h.account)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h(token: &str, account: &str, amount: &str) -> TokenHolder {
        TokenHolder {
            token: token.into(),
            account: account.into(),
            amount: amount.into(),
        }
    }

    fn sample() -> Vec<TokenHolder> {
        vec![
            h("T", "a1", "10"),
            h("T", "a2", "20"),
            h("T", "a3", "30"),
            h("T", "a4", "40"),
            h("T", "a5", "50"),
        ]
    }

    #[test]
    fn resolve_limit_defaults_on_none_or_zero() {
        assert_eq!(resolve_limit(None), DEFAULT_LIMIT);
        assert_eq!(resolve_limit(Some(0)), DEFAULT_LIMIT);
    }

    #[test]
    fn resolve_limit_caps_at_max() {
        assert_eq!(resolve_limit(Some(MAX_LIMIT + 1)), MAX_LIMIT);
    }

    #[test]
    fn resolve_limit_passes_through_valid() {
        assert_eq!(resolve_limit(Some(42)), 42);
    }

    #[test]
    fn first_page_uses_default_limit_when_no_cursor() {
        let s = sample();
        let (page, next) = page_holders(&s, None).unwrap();
        assert_eq!(page.len(), 5); // less than default → single page
        assert!(next.is_none());
    }

    #[test]
    fn small_limit_produces_pagination() {
        let s = sample();
        let c = PageCursor { limit: 2, after: None };
        let (page, next) = page_holders(&s, Some(&c)).unwrap();
        assert_eq!(page.len(), 2);
        assert_eq!(page[0].account, "a1");
        let next = next.expect("more pages");
        assert_eq!(next.after.as_deref(), Some("T:a2"));

        let (page2, next2) = page_holders(&s, Some(&next)).unwrap();
        assert_eq!(page2[0].account, "a3");
        assert_eq!(page2.len(), 2);
        assert!(next2.is_some());

        let (page3, next3) = page_holders(&s, Some(&next2.unwrap())).unwrap();
        assert_eq!(page3.len(), 1);
        assert_eq!(page3[0].account, "a5");
        assert!(next3.is_none(), "last page yields no cursor");
    }

    #[test]
    fn unknown_cursor_is_bad_request() {
        let s = sample();
        let c = PageCursor { limit: 2, after: Some("T:ghost".into()) };
        assert!(matches!(page_holders(&s, Some(&c)), Err(Error::BadRequest(_))));
    }

    #[test]
    fn cursor_key_is_token_account() {
        assert_eq!(cursor_key(&h("X", "Y", "1")), "X:Y");
    }
}
