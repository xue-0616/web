/// Registry of all payment merchants (HIGH-11 fix: add missing CoinsPhMerchant and WindMerchant)

pub use super::alchemy_pay_merchant::merchant::AlchemyPayMerchant;
pub use super::paypal_merchant::merchant::PayPalMerchant;
pub use super::bitrefill_merchant::merchant::BitrefillMerchant;
pub use super::coins_merchant::merchant::CoinsMerchant;
pub use super::coins_ph_merchant::merchant::CoinsPhMerchant;
pub use super::wind_merchant::merchant::WindMerchant;
