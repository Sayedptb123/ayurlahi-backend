import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  async findAll(@Request() req, @Query() query: GetProductsDto) {
    return this.productsService.findAll(query, req.user?.organisationType);
  }

  @Get('my-products')
  async getMyProducts(@Request() req, @Query() query: GetProductsDto) {
    return this.productsService.findByManufacturer(
      req.user.organisationId,
      query,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  async create(@Request() req, @Body() createProductDto: CreateProductDto) {
    return this.productsService.create(
      req.user.userId,
      req.user.organisationId,
      req.user.organisationType,
      createProductDto,
    );
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(
      id,
      req.user.userId,
      req.user.organisationId,
      req.user.organisationType,
      updateProductDto,
    );
  }

  @Patch(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.productsService.archive(
      id,
      req.user.userId,
      req.user.organisationId,
    );
  }

  @Patch(':id/hide')
  async hide(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.productsService.hide(
      id,
      req.user.userId,
      req.user.organisationId,
    );
  }

  @Patch(':id/show')
  async show(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.productsService.show(
      id,
      req.user.userId,
      req.user.organisationId,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.productsService.remove(
      id,
      req.user.userId,
      req.user.organisationId,
    );
  }
}
