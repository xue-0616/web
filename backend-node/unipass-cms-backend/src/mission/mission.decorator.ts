import { SetMetadata } from '@nestjs/common';
import { MISSION_KEY_METADATA } from '../common/contants/decorator.contants';

export const Mission = () => SetMetadata(MISSION_KEY_METADATA, true);
