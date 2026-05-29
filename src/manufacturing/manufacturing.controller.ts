import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ManufacturingService } from './manufacturing.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('manufacturing')
@UseGuards(AuthGuard('jwt'))
export class ManufacturingController {
    constructor(private readonly manufacturingService: ManufacturingService) { }

    @Post('raw-materials')
    createRawMaterial(@Body() data: any, @Req() req) {
        return this.manufacturingService.createRawMaterial({
            ...data,
            manufacturerId: req.user.organisationId,
        });
    }

    @Get('raw-materials/:manufacturerId')
    getRawMaterials(@Param('manufacturerId') manufacturerId: string) {
        return this.manufacturingService.findAllRawMaterials(manufacturerId);
    }

    @Post('stock/add')
    addStock(
        @Body() body: { rawMaterialId: string; quantity: number; unitCost?: number; notes?: string },
        @Req() req,
    ) {
        return this.manufacturingService.addStock(
            req.user.organisationId,
            body.rawMaterialId,
            body.quantity,
            body.unitCost ?? 0,
            body.notes,
        );
    }

    @Post('formulas')
    createFormula(@Body() data: any, @Req() req) {
        return this.manufacturingService.createFormula({
            ...data,
            manufacturerId: req.user.organisationId,
        });
    }

    @Get('formulas/:manufacturerId')
    getFormulas(@Param('manufacturerId') manufacturerId: string) {
        return this.manufacturingService.getFormulas(manufacturerId);
    }

    @Post('batches/start')
    startBatch(
        @Body() body: { batchNumber: string; plannedQuantity: number; startDate?: string; notes?: string; formulaId?: string },
        @Req() req,
    ) {
        const manufacturerId = req.user.organisationId;
        if (body.formulaId) {
            return this.manufacturingService.startBatch(
                manufacturerId,
                body.formulaId,
                body.plannedQuantity,
                body.batchNumber,
            );
        }
        return this.manufacturingService.createSimpleBatch({
            manufacturerId,
            batchNumber: body.batchNumber,
            plannedQuantity: body.plannedQuantity,
            startDate: body.startDate,
            notes: body.notes,
        });
    }

    @Get('batches/:manufacturerId')
    getBatches(@Param('manufacturerId') manufacturerId: string) {
        return this.manufacturingService.getBatches(manufacturerId);
    }

    @Patch('batches/:id/activate')
    activateBatch(@Param('id') id: string, @Req() req) {
        return this.manufacturingService.activateBatch(id, req.user.organisationId);
    }

    @Post('batches/:id/complete')
    completeBatch(
        @Param('id') id: string,
        @Body() body: { actualYield?: number },
    ) {
        return this.manufacturingService.completeBatch(id, body.actualYield);
    }
}
