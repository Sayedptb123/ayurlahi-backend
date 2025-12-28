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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) { }

    @Post()
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    create(@Body() createExpenseDto: CreateExpenseDto, @Request() req) {
        return this.expensesService.create(createExpenseDto, req.user as User);
    }

    @Get()
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    findAll(@Request() req) {
        return this.expensesService.findAll(req.user as User);
    }

    @Get(':id')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN, UserRole.CLINIC, UserRole.MANUFACTURER)
    findOne(@Param('id') id: string, @Request() req) {
        return this.expensesService.findOne(id, req.user as User);
    }

    @Patch(':id')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)
    update(
        @Param('id') id: string,
        @Body() updateExpenseDto: UpdateExpenseDto,
        @Request() req,
    ) {
        return this.expensesService.update(id, updateExpenseDto, req.user as User);
    }

    @Delete(':id')
    @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)
    remove(@Param('id') id: string, @Request() req) {
        return this.expensesService.remove(id, req.user as User);
    }
}
