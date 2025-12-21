import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { EmailService } from './services/email.service';
import { ClinicsModule } from '../clinics/clinics.module';
import { ManufacturersModule } from '../manufacturers/manufacturers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ConfigModule,
    ClinicsModule,
    ManufacturersModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailService],
  exports: [UsersService],
})
export class UsersModule {}

