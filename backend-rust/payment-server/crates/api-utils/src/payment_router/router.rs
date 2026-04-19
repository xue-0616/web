use anyhow::Result;

/// Route payments to appropriate merchant based on type
pub enum PaymentRoute {
    AlchemyPay,
    PayPal,
    Bitrefill,
    Coins,
    Wind,
    Bridge,
}

/// Countries supported by Wind for off-ramp
const WIND_SUPPORTED_COUNTRIES: &[&str] = &[
    "US", "GB", "CA", "AU", "DE", "FR", "ES", "IT", "NL", "SE",
    "NO", "DK", "FI", "AT", "BE", "IE", "PT", "CH", "SG", "HK",
    "JP", "KR", "IN", "BR", "MX", "CO", "CL", "AR", "PE", "NG",
    "KE", "ZA", "GH", "TZ", "UG",
];

/// Validate ISO 3166-1 alpha-2 country code format (HIGH-07 fix)
fn is_valid_country_code(code: &str) -> bool {
    code.len() == 2 && code.chars().all(|c| c.is_ascii_uppercase())
}

/// Determine best payment route for a given request (HIGH-07 fix: validate country, check merchant support)
pub fn route_payment(
    payment_type: &str,
    fiat_currency: &str,
    country: &str,
) -> Result<PaymentRoute> {
    match payment_type {
        "on_ramp" => Ok(PaymentRoute::AlchemyPay),
        "off_ramp" => {
            // HIGH-07 fix: validate country code format
            if !country.is_empty() && !is_valid_country_code(country) {
                anyhow::bail!("Invalid country code '{}': must be ISO 3166-1 alpha-2 (e.g., 'US', 'PH')", country);
            }

            if country == "PH" {
                Ok(PaymentRoute::Coins)
            } else if country.is_empty() {
                anyhow::bail!("Country code is required for off-ramp routing");
            } else if WIND_SUPPORTED_COUNTRIES.contains(&country) {
                Ok(PaymentRoute::Wind)
            } else {
                anyhow::bail!(
                    "Off-ramp not supported for country '{}'. Supported countries: PH (Coins), and {} via Wind",
                    country,
                    WIND_SUPPORTED_COUNTRIES.join(", ")
                );
            }
        }
        "gift_card" => Ok(PaymentRoute::Bitrefill),
        "paypal" => Ok(PaymentRoute::PayPal),
        "bridge" => Ok(PaymentRoute::Bridge),
        _ => Err(anyhow::anyhow!("unknown payment type: {}", payment_type)),
    }
}
