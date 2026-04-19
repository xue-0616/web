import { IJwt } from './jwt';

export class RequestContext {
    requestID!: string;
    url!: string;
    ip!: string;
    headers!: Record<string, string>;
    user!: IJwt;
}
