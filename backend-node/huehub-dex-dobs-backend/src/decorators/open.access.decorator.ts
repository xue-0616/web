import { SetMetadata } from '@nestjs/common';
import { OPEN_ACCESS } from '../common/utils/const.config';

export const OpenAccess = () => SetMetadata(OPEN_ACCESS, true);
