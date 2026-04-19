import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiSecurity, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { DeptDetailInfo } from './dept.class';
import { CreateDeptDto, DeleteDeptDto, InfoDeptDto, MoveDeptDto, TransferDeptDto, UpdateDeptDto } from './dept.dto';
import { SysDeptService } from './dept.service';
import SysDepartment from '../../../../entities/default/admin/sys-department.entity';
import { ApiException } from '../../../../common/exceptions/api.exception';
import { AdminUser } from '../../core/decorators/admin-user.decorator';
import { ADMIN_PREFIX } from '../../admin.constants';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('部门模块')
@Controller('dept')
export class SysDeptController {
    constructor(private readonly deptService: SysDeptService) {}

    @ApiOperation({ summary: '获取系统部门列表' })
    @ApiOkResponse({ type: [SysDepartment] })
    @Get('list')
    async list(@AdminUser('uid') uid: number): Promise<SysDepartment[]> {
        return this.deptService.getDepts(uid);
    }

    @ApiOperation({ summary: '创建系统部门' })
    @Post('add')
    async add(@Body() dto: CreateDeptDto): Promise<void> {
        await this.deptService.add(dto.name, dto.parentId ?? -1);
    }

    @ApiOperation({ summary: '删除系统部门' })
    @Post('delete')
    async delete(@Body() dto: DeleteDeptDto): Promise<void> {
        const count = await this.deptService.countUserByDeptId(dto.departmentId);
        if (count > 0) throw new ApiException(10009);
        const count2 = await this.deptService.countRoleByDeptId(dto.departmentId);
        if (count2 > 0) throw new ApiException(10010);
        const count3 = await this.deptService.countChildDept(dto.departmentId);
        if (count3 > 0) throw new ApiException(10015);
        await this.deptService.delete(dto.departmentId);
    }

    @ApiOperation({ summary: '查询单个系统部门信息' })
    @ApiOkResponse({ type: DeptDetailInfo })
    @Get('info')
    async info(@Query() dto: InfoDeptDto): Promise<DeptDetailInfo> {
        return this.deptService.info(dto.departmentId);
    }

    @ApiOperation({ summary: '更新系统部门' })
    @Post('update')
    async update(@Body() dto: UpdateDeptDto): Promise<void> {
        await this.deptService.update(dto);
    }

    @ApiOperation({ summary: '管理员部门转移' })
    @Post('transfer')
    async transfer(@Body() dto: TransferDeptDto): Promise<void> {
        await this.deptService.transfer(dto.userIds, dto.departmentId);
    }

    @ApiOperation({ summary: '部门移动排序' })
    @Post('move')
    async move(@Body() dto: MoveDeptDto): Promise<void> {
        await this.deptService.move(dto.depts);
    }
}
