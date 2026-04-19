import { PageOptionsDto } from '../../../common/dto/page.dto';

export class IStatisticsRegisterDto extends PageOptionsDto {
    start?: string;
    end?: string;
    app?: string;
}
