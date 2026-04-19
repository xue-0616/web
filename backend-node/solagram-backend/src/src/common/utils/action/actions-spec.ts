export type SOLANA_ACTIONS_PROTOCOL = 'solana-action:';
export type SOLANA_PAY_PROTOCOL = 'solana:';
export type SupportedProtocols = SOLANA_ACTIONS_PROTOCOL | SOLANA_PAY_PROTOCOL;
export interface ActionsJson {
    rules: ActionRuleObject[];
}
export interface ActionRuleObject {
    pathPattern: string;
    apiPath: string;
}
export interface ActionGetRequest {
}
export type ActionType = 'action' | 'completed';
export interface ActionGetResponse extends Omit<TypedAction, 'type'> {
    type?: 'action';
}
export interface TypedAction<T extends ActionType = 'action'> {
    type: T;
    icon: string;
    title: string;
    description: string;
    label: string;
    disabled?: boolean;
    links?: {
        actions: LinkedAction[];
    };
    error?: ActionError;
}
export interface LinkedAction {
    href: string;
    label: string;
    parameters?: Array<TypedActionParameter>;
}
export type TypedActionParameter<T extends ActionParameterType = ActionParameterType> = T extends SelectableParameterType ? ActionParameterSelectable<T> : ActionParameter<T>;
export interface ActionParameter<T extends ActionParameterType, M = MinMax<T>> {
    type?: T;
    name: string;
    label?: string;
    required?: boolean;
    pattern?: string;
    patternDescription?: string;
    min?: M;
    max?: M;
}
type MinMax<T extends ActionParameterType> = T extends 'date' | 'datetime-local' ? string : T extends 'radio' | 'select' ? never : number;
export type GeneralParameterType = 'text' | 'email' | 'url' | 'number' | 'date' | 'datetime-local' | 'textarea';
export type SelectableParameterType = 'select' | 'radio' | 'checkbox';
export type ActionParameterType = GeneralParameterType | SelectableParameterType;
export interface ActionParameterSelectable<T extends ActionParameterType> extends Omit<ActionParameter<T>, 'pattern'> {
    options: Array<{
        label: string;
        value: string;
        selected?: boolean;
    }>;
}
export interface ActionPostRequest<T = string> {
    account: string;
    data?: Record<keyof T, string | Array<string>>;
}
export interface ActionPostResponse<T extends ActionType = ActionType> {
    transaction: string;
    message?: string;
    links?: {
        next: NextActionLink;
    };
}
export type NextActionLink = PostNextActionLink | InlineNextActionLink;
export interface PostNextActionLink {
    type: 'post';
    href: string;
}
export interface InlineNextActionLink {
    type: 'inline';
    action: NextAction;
}
export type CompletedAction = Omit<TypedAction<'completed'>, 'links'>;
export type NextAction = TypedAction<'action'> | CompletedAction;
export interface NextActionPostRequest extends ActionPostRequest {
    signature: string;
}
export interface ActionError {
    message: string;
}
export interface DialectExperimentalFeatures {
    dialectExperimental?: {
        liveData?: {
            enabled: boolean;
            delayMs?: number;
        };
    };
}
export type ExtendedActionGetResponse = ActionGetResponse & DialectExperimentalFeatures;
export {};
