import { ActionGetResponse } from '@solana/actions';
export interface IAllActions {
    actions: IBlinkAction[];
    websites: IBlinkAction[];
    interstitials: IBlinkAction[];
}
export interface IBlinkAction {
    host: string;
    state: string;
}
export interface IBlinkActionInfo {
    actionsGet: ActionGetResponse;
    url: string;
    domain: string;
}
