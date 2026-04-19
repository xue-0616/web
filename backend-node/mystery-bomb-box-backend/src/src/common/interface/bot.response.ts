export interface BlinkShortCode {
    blink: string;
    shortCode: string;
    id: number;
}
export interface BlinkIdInfo {
    blink: string;
    id: number;
}
export interface QueryShortCodeInput {
    blinks: BlinkIdInfo[];
    domain: string;
}
