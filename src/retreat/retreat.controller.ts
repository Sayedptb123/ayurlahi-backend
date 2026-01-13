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
    Request
} from '@nestjs/common';
import { RetreatService } from './retreat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto } from './dto/booking.dto';
import { BookingStatus } from './entities/room-booking.entity';

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

    @Delete('rooms/:id')
    deleteRoom(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.deleteRoom(clinicId, id);
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

    // --- BOOKING ENDPOINTS ---
    @Post('bookings')
    createBooking(@Request() req, @Body() dto: CreateBookingDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createBooking(clinicId, dto);
    }

    @Get('bookings')
    getBookings(
        @Request() req,
        @Query('status') status?: BookingStatus,
        @Query('roomId') roomId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getBookings(clinicId, { status, roomId, startDate, endDate });
    }

    @Get('bookings/calendar')
    getCalendarData(
        @Request() req,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getCalendarData(clinicId, startDate, endDate);
    }

    @Get('bookings/:id')
    getBookingById(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getBookingById(clinicId, id);
    }

    @Patch('bookings/:id')
    updateBooking(@Request() req, @Param('id') id: string, @Body() dto: UpdateBookingDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.updateBooking(clinicId, id, dto);
    }

    @Delete('bookings/:id')
    cancelBooking(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.cancelBooking(clinicId, id);
    }

    @Post('bookings/check-availability')
    checkAvailability(@Request() req, @Body() dto: CheckAvailabilityDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.checkAvailability(clinicId, dto);
    }
}
