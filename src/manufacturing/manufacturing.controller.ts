import { Controller, Get, Post, Body, Param, Put, UseGuards, Req } from '@nestjs/common';
import { ManufacturingService } from './manufacturing.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('manufacturing')
export class ManufacturingController {
    constructor(private readonly manufacturingService: ManufacturingService) { }

    @UseGuards(AuthGuard('jwt'))
    @Post('raw-materials')
    createRawMaterial(@Body() data: any) {
        // TODO: Get manufacturerId from user context
        return this.manufacturingService.createRawMaterial(data);
    }

    @Get('raw-materials/:manufacturerId')
    getRawMaterials(@Param('manufacturerId') manufacturerId: string) {
        return this.manufacturingService.findAllRawMaterials(manufacturerId);
    }

    @Post('stock/add')
    addStock(@Body() body: {
        manufacturerId: string,
        rawMaterialId: string,
        quantity: number,
        unitCost: number,
        notes?: string
    }) {
        return this.manufacturingService.addStock(
            body.manufacturerId,
            body.rawMaterialId,
            body.quantity,
            body.unitCost,
            body.notes
        );
    }

    @Post('formulas')
    createFormula(@Body() data: any) {
        return this.manufacturingService.createFormula(data);
    }

    @Get('formulas/:manufacturerId')
    getFormulas(@Param('manufacturerId') manufacturerId: string) {
        return this.manufacturingService.getFormulas(manufacturerId);
    }

    @Post('batches/start')
    startBatch(@Body() body: {
        manufacturerId: string,
        formulaId: string,
        plannedQuantity: number,
        batchNumber: string
    }) {
        return this.manufacturingService.startBatch(
            body.manufacturerId,
            body.formulaId,
            body.plannedQuantity,
            body.batchNumber
        );
    }

    @Get('batches/:manufacturerId')
    getBatches(@Param('manufacturerId') manufacturerId: string) {
        return this.manufacturingService.getBatches(manufacturerId);
    }

    @Post('batches/:id/complete')
    completeBatch(
        @Param('id') id: string,
        @Body() body: { actualYield?: number }
    ) {
        return this.manufacturingService.completeBatch(id, body.actualYield);
    }
}
