import { SetMetadata } from '@nestjs/common';
import { PUBLIC_ROUTE_KEY } from '../common/utils/const.parameter';

export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
