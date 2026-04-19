import { createParamDecorator } from '@nestjs/common';
import { ADMIN_USER } from '../../admin.constants';

export const AdminUser = createParamDecorator((data: string, ctx: any) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request[ADMIN_USER];
    return data ? user?.[data] : user;
});
