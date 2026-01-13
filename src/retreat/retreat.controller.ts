import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Request
} from '@nestjs/common';
import { RetreatService } from './retreat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('retreat')
@UseGuards(JwtAuthGuard)
export class RetreatController {
    constructor(private readonly retreatService: RetreatService) { }

    @Get('rooms')
    getRooms(@Request() req) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getRooms(clinicId);
    }

    @Post('rooms')
    createRoom(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createRoom(clinicId, body);
    }

    @Get('packages')
    getPackages(@Request() req) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getPackages(clinicId);
    }

    @Post('packages')
    createPackage(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createPackage(clinicId, body);
    }

    @Get('admissions')
    getAdmissions(@Request() req) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmissions(clinicId);
    }

    @Post('admissions')
    checkIn(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.checkIn(clinicId, body);
    }

    @Post('admissions/:id/discharge')
    discharge(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.discharge(clinicId, id);
    }
}
