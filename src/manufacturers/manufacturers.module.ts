import { Module } from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';

@Module({
  providers: [ManufacturersService],
  exports: [ManufacturersService],
})
export class ManufacturersModule {}

