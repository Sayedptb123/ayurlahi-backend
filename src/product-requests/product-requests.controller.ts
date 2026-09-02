import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductRequestsService } from './product-requests.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';
import { GetProductRequestsDto } from './dto/get-product-requests.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('product-requests')
@UseGuards(JwtAuthGuard)
export class ProductRequestsController {
  constructor(private readonly productRequestsService: ProductRequestsService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreateProductRequestDto) {
    return this.productRequestsService.create(
      req.user.userId,
      req.user.organisationId,
      req.user.organisationType,
      dto,
    );
  }

  @Get()
  async findAll(@Request() req, @Query() query: GetProductRequestsDto) {
    return this.productRequestsService.findAll(
      req.user.userId,
      req.user.role,
      req.user.organisationId,
      req.user.organisationType,
      query,
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateProductRequestStatusDto,
  ) {
    return this.productRequestsService.updateStatus(id, req.user.userId, req.user.role, dto);
  }
}
