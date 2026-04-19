import { Controller, Post, Get, Body, Request, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';
import { FavoriteDto } from './dto/favorite.dto';
import { buildSuccessResponse } from '../../common/dto/response';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('favorite')
@Controller('api/v1/favorite')
export class FavoriteController {
    private favoriteService: FavoriteService;

    constructor(favoriteService: FavoriteService) {
        this.favoriteService = favoriteService;
    }

    @Post('add')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    async addFavorite(@Request() req: any, @Body() favoriteDto: FavoriteDto): Promise<any> {
        const userId = req.userId;
        await this.favoriteService.add(userId, favoriteDto);
        return buildSuccessResponse(null);
    }

    @Post('remove')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    async removeFavorite(@Request() req: any, @Body() favoriteDto: FavoriteDto): Promise<any> {
        const userId = req.userId;
        await this.favoriteService.remove(userId, favoriteDto);
        return buildSuccessResponse(null);
    }

    @Get('list')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get tokens by chain' })
    @ApiBearerAuth()
    @ApiQuery({ name: 'chain', type: String, required: true })
    async getFavoriteList(@Request() req: any, @Query('chain') chain: string): Promise<any> {
        const userId = req.userId;
        const favoriteList = await this.favoriteService.getFavoriteList(userId, Number(chain));
        return buildSuccessResponse(favoriteList);
    }

    @Get('all')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get all favorites' })
    @ApiBearerAuth()
    async getAllFavorites(@Request() req: any): Promise<any> {
        const userId = req.userId;
        const favoriteList = await this.favoriteService.getAllFavorites(userId);
        return buildSuccessResponse(favoriteList);
    }
}
