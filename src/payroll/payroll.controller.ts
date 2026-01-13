import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
    constructor(private readonly payrollService: PayrollService) { }

    @Post('structure')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    createStructure(@Body() dto: CreateSalaryStructureDto) {
        return this.payrollService.createOrUpdateSalaryStructure(dto);
    }

    @Get('structure/:staffId')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    getStructure(@Param('staffId') staffId: string) {
        return this.payrollService.getSalaryStructure(staffId);
    }

    @Post('generate')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    generate(@Request() req, @Body() dto: GeneratePayrollDto) {
        return this.payrollService.generatePayroll(req.user as User, dto);
    }

    @Get('history')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    getHistory(
        @Request() req,
        @Query('month') month?: number,
        @Query('year') year?: number,
    ) {
        return this.payrollService.getPayrollRecords(req.user as User, month, year);
    }

    @Patch(':id/status')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    updateStatus(@Param('id') id: string, @Body() dto: UpdatePayrollStatusDto) {
        return this.payrollService.updatePayrollStatus(id, dto);
    }
}
