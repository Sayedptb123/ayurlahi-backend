import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';

@Controller('budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetsController {
    constructor(private readonly budgetsService: BudgetsService) { }

    @Post()
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    create(@Body() createBudgetDto: CreateBudgetDto, @Request() req) {
        return this.budgetsService.create(createBudgetDto, req.user as User);
    }

    @Get()
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    findAll(@Request() req) {
        return this.budgetsService.findAll(req.user as User);
    }

    @Get(':id')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    findOne(@Param('id') id: string, @Request() req) {
        return this.budgetsService.findOne(id, req.user as User);
    }

    @Patch(':id')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    update(
        @Param('id') id: string,
        @Body() updateBudgetDto: UpdateBudgetDto,
        @Request() req,
    ) {
        return this.budgetsService.update(id, updateBudgetDto, req.user as User);
    }

    @Delete(':id')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    remove(@Param('id') id: string, @Request() req) {
        return this.budgetsService.remove(id, req.user as User);
    }
}
