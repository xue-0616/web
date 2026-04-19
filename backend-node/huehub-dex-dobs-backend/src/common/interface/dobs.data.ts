export interface DobsData {
    dob_id: string;
    dob_dna: string;
    'prev.type': string;
    'prev.bg': string;
    'prev.bgcolor': string;
    Background: string;
    Suit: string;
    'Upper body': string;
    'Lower body': string;
    Headwear: string;
    Mask: string;
    Eyewear: string;
    Mouth: string;
    Ears: string;
    Tattoo: string;
    Accessory: string;
    Handheld: string;
    Special: string;
    protocol: string;
    media_type: string;
    asset: string;
}
export interface DobsResponse {
    dobs: DobsData[];
}
