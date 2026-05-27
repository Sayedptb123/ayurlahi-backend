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
    Query,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import type { GetExpensesQuery } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

// All clinic/postnatal staff can submit and view expenses.
// The guard normalises OWNER/MANAGER/STAFF → UserRole.CLINIC, so UserRole.CLINIC
// covers every role inside a clinic org. Sub-role checks (manager-only actions)
// are enforced inside the service using reqUser.role from the JWT.
const CLINIC_MEMBERS = [UserRole.CLINIC, UserRole.MANUFACTURER, UserRole.ADMIN];

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) { }

    @Post()
    @Roles(...CLINIC_MEMBERS)
    create(@Body() createExpenseDto: CreateExpenseDto, @Request() req) {
        return this.expensesService.create(createExpenseDto, req.user);
    }

    @Get()
    @Roles(...CLINIC_MEMBERS)
    findAll(@Request() req, @Query() query: GetExpensesQuery) {
        return this.expensesService.findAll(req.user, query);
    }

    @Get(':id')
    @Roles(...CLINIC_MEMBERS)
    findOne(@Param('id') id: string, @Request() req) {
        return this.expensesService.findOne(id, req.user);
    }

    @Patch(':id')
    @Roles(...CLINIC_MEMBERS)
    update(
        @Param('id') id: string,
        @Body() updateExpenseDto: UpdateExpenseDto,
        @Request() req,
    ) {
        return this.expensesService.update(id, updateExpenseDto, req.user);
    }

    @Delete(':id')
    @Roles(...CLINIC_MEMBERS)
    remove(@Param('id') id: string, @Request() req) {
        return this.expensesService.remove(id, req.user);
    }
}
