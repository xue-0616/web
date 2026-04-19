import { SetMetadata } from '@nestjs/common';
import { TRANSFORM_KEEP_KEY_METADATA } from '../contants/decorator.contants';

export const Keep = () => SetMetadata(TRANSFORM_KEEP_KEY_METADATA, true);
