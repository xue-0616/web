export class UpdateSettingDto {
    id!: string;
    isMevEnabled!: boolean | null;
    slippagePercent!: string | null;
    priorityFee!: string | null;
    briberyAmount!: string | null;
}
