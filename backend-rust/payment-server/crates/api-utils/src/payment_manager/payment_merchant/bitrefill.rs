/// HIGH-03 fix: Removed duplicate BitrefillMerchant definition.
/// The canonical implementation is in `bitrefill_merchant::merchant::BitrefillMerchant`
/// which uses the correct `basic_auth` (API key + secret) and configurable `api_url`.
///
/// This module re-exports the canonical type for backward compatibility.
pub use super::bitrefill_merchant::merchant::BitrefillMerchant;
