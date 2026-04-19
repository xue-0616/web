import { Controller, Get, Header } from '@nestjs/common';

@Controller('')
export class AppController {
    @Get('actions.json')
    @Header('Access-Control-Allow-Origin', '*')
    @Header('Content-Type', 'application/json')
    getActionsJson(): {
        rules: {
            pathPattern: string;
            apiPath: string;
        }[];
    } {
            return {
                rules: [
                    {
                        pathPattern: '/box/actions/create',
                        apiPath: '/box/actions/create',
                    },
                    {
                        pathPattern: '/box/actions/grab/*',
                        apiPath: '/box/actions/grab/*',
                    },
                ],
            };
        }
}
