import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetsService } from './assets.service';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { LogMaintenanceDto } from './dto/log-maintenance.dto';
import { AssetStatus } from './entities/asset.entity';

@ApiTags('assets')
@ApiBearerAuth('access-token')
@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ==========================================================================
  // ASSET CATEGORIES
  // ==========================================================================

  @ApiOperation({ summary: 'Create a new asset category (Manager only)' })
  @Post('categories')
  createCategory(@Request() req, @Body() dto: CreateAssetCategoryDto) {
    this.checkManagerRole(req.user.role);
    return this.assetsService.createCategory(req.user.organisationId, dto);
  }

  @ApiOperation({ summary: 'Get all active asset categories' })
  @Get('categories')
  findAllCategories(@Request() req) {
    return this.assetsService.findAllCategories(req.user.organisationId);
  }

  @ApiOperation({ summary: 'Delete an asset category (Manager only)' })
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    this.checkManagerRole(req.user.role);
    return this.assetsService.deleteCategory(id, req.user.organisationId);
  }

  // ==========================================================================
  // ASSETS CRUD
  // ==========================================================================

  @ApiOperation({ summary: 'Register a new asset (Manager only)' })
  @Post()
  createAsset(@Request() req, @Body() dto: CreateAssetDto) {
    this.checkManagerRole(req.user.role);
    return this.assetsService.createAsset(req.user.organisationId, dto);
  }

  @ApiOperation({ summary: 'Get all active assets' })
  @Get()
  findAllAssets(
    @Request() req,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: AssetStatus,
    @Query('search') search?: string,
    @Query('needsMaintenance') needsMaintenance?: string
  ) {
    return this.assetsService.findAllAssets(req.user.organisationId, {
      categoryId,
      status,
      search,
      needsMaintenance,
    });
  }

  @ApiOperation({ summary: 'Get details of a single asset' })
  @Get(':id')
  findOneAsset(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.assetsService.findOneAsset(id, req.user.organisationId);
  }

  @ApiOperation({ summary: 'Update an asset record (Manager only)' })
  @Patch(':id')
  updateAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateAssetDto
  ) {
    this.checkManagerRole(req.user.role);
    return this.assetsService.updateAsset(id, req.user.organisationId, dto);
  }

  @ApiOperation({ summary: 'Soft delete an asset record (Manager only)' })
  @Delete(':id')
  deleteAsset(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    this.checkManagerRole(req.user.role);
    return this.assetsService.deleteAsset(id, req.user.organisationId);
  }

  // ==========================================================================
  // MAINTENANCE LOGS
  // ==========================================================================

  @ApiOperation({ summary: 'Log a maintenance service for an asset (Manager only)' })
  @Post(':id/maintenance')
  logMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: LogMaintenanceDto
  ) {
    this.checkManagerRole(req.user.role);
    return this.assetsService.logMaintenance(id, req.user.organisationId, dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Get service maintenance history for an asset' })
  @Get(':id/maintenance')
  getMaintenanceHistory(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.assetsService.getMaintenanceHistory(id, req.user.organisationId);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private checkManagerRole(role: string) {
    const isManager = ['OWNER', 'MANAGER', 'ADMIN', 'AYURLAHI_TEAM'].includes(role);
    if (!isManager) {
      throw new ForbiddenException('Only managers and owners can perform this operation');
    }
  }
}
