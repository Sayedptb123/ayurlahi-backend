import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { Expense } from './entities/expense.entity';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [TypeOrmModule.forFeature([Expense, User, OrganisationUser]), NotificationsModule],
    controllers: [ExpensesController],
    providers: [ExpensesService],
    exports: [ExpensesService],
})
export class ExpensesModule { }
