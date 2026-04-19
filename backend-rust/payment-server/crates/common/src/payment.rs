use serde::{Deserialize, Serialize};

/// Payment type enum matching DB values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaymentType {
    Payment = 0,
    Bitrefill = 100,
    AlchemyPay = 1000,
    Wind = 1001,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Refunded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RampType {
    OnRamp,
    OffRamp,
}
