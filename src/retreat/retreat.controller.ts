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
import { ModuleGuard, RequireModule } from '../auth/guards/module.guard';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto } from './dto/booking.dto';
import { CreateEnquiryDto, UpdateEnquiryDto, ConvertEnquiryDto } from './dto/enquiry.dto';
import { BookingStatus } from './entities/room-booking.entity';
import { EnquiryStatus } from './entities/booking-enquiry.entity';

@Controller('retreat')
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequireModule('booking')
export class RetreatController {
    constructor(private readonly retreatService: RetreatService) { }

    @Get('room-categories')
    getRoomCategories(@Request() req) {
        return this.retreatService.getRoomCategories(req.user.organisationId);
    }

    @Post('room-categories')
    createRoomCategory(@Request() req, @Body() body: { name: string }) {
        return this.retreatService.createRoomCategory(req.user.organisationId, body);
    }

    @Patch('room-categories/:id')
    updateRoomCategory(@Request() req, @Param('id') id: string, @Body() body: { name?: string; isActive?: boolean }) {
        return this.retreatService.updateRoomCategory(req.user.organisationId, id, body);
    }

    @Delete('room-categories/:id')
    deleteRoomCategory(@Request() req, @Param('id') id: string) {
        return this.retreatService.deleteRoomCategory(req.user.organisationId, id);
    }

    // Must be declared before rooms/:id to avoid 'available' being matched as :id
    @Get('rooms/resolve-price')
    resolvePrice(
        @Request() req,
        @Query('roomId') roomId: string,
        @Query('packageId') packageId: string,
    ) {
        return this.retreatService.resolvePrice(req.user.organisationId, roomId, packageId);
    }

    @Get('pricing-matrix')
    getPricingMatrix(@Request() req) {
        return this.retreatService.getPricingMatrix(req.user.organisationId);
    }

    @Post('pricing-matrix')
    setPricingMatrix(@Request() req, @Body() body: { roomCategoryId: string; packageId: string; price: number }) {
        return this.retreatService.setPricingMatrix(req.user.organisationId, body);
    }

    @Delete('pricing-matrix/:id')
    deletePricingMatrixEntry(@Request() req, @Param('id') id: string) {
        return this.retreatService.deletePricingMatrixEntry(req.user.organisationId, id);
    }

    @Get('room-pricing-overrides')
    getRoomPricingOverrides(@Request() req) {
        return this.retreatService.getRoomPricingOverrides(req.user.organisationId);
    }

    @Post('room-pricing-overrides')
    setRoomPricingOverride(@Request() req, @Body() body: { roomId: string; packageId: string; price: number }) {
        return this.retreatService.setRoomPricingOverride(req.user.organisationId, body);
    }

    @Delete('room-pricing-overrides/:id')
    deleteRoomPricingOverride(@Request() req, @Param('id') id: string) {
        return this.retreatService.deleteRoomPricingOverride(req.user.organisationId, id);
    }

    @Get('rooms')
    getRooms(@Request() req) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getRooms(clinicId);
    }

    @Get('today')
    getTodaySummary(@Request() req) {
        return this.retreatService.getTodaySummary(req.user.organisationId);
    }

    // Must be declared before any 'rooms/:id' route so 'available' isn't matched as :id
    @Get('rooms/available')
    getAvailableRooms(
        @Request() req,
        @Query('checkInDate') checkInDate: string,
        @Query('checkOutDate') checkOutDate: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAvailableRooms(clinicId, checkInDate, checkOutDate);
    }

    @Post('rooms')
    createRoom(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createRoom(clinicId, body);
    }

    @Patch('rooms/:id')
    updateRoom(@Request() req, @Param('id') id: string, @Body() body: { roomNumber?: string; floor?: string; roomCategoryId?: string; capacity?: number; amenities?: string[]; description?: string; status?: string }) {
        const clinicId = req.user.organisationId;
        return this.retreatService.updateRoom(clinicId, id, body);
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
    getAdmissions(@Request() req, @Query('patientId') patientId?: string, @Query('status') status?: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmissions(clinicId, { patientId, status });
    }

    // NOTE: must be declared before 'admissions/:id' so it isn't matched as an :id param
    @Get('admissions/stats')
    getAdmissionStats(@Request() req) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmissionStats(clinicId);
    }

    @Post('admissions')
    checkIn(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.checkIn(clinicId, body);
    }

    // --- ENQUIRY ENDPOINTS ---
    @Get('enquiries')
    listEnquiries(
        @Request() req,
        @Query('status') status?: EnquiryStatus,
        @Query('assignedTo') assignedTo?: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.listEnquiries(clinicId, { status, assignedTo });
    }

    @Post('enquiries')
    createEnquiry(@Request() req, @Body() dto: CreateEnquiryDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createEnquiry(clinicId, dto);
    }

    @Patch('enquiries/:id')
    updateEnquiry(@Request() req, @Param('id') id: string, @Body() dto: UpdateEnquiryDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.updateEnquiry(clinicId, id, dto);
    }

    @Post('enquiries/:id/convert')
    convertEnquiryToBooking(@Request() req, @Param('id') id: string, @Body() dto: ConvertEnquiryDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.convertEnquiryToBooking(clinicId, id, dto);
    }

    @Post('enquiries/:id/lost')
    markEnquiryLost(@Request() req, @Param('id') id: string, @Body() body: { lostReason?: string }) {
        const clinicId = req.user.organisationId;
        return this.retreatService.markEnquiryLost(clinicId, id, body?.lostReason);
    }

    @Post('bookings/:id/promote')
    promoteEnquiry(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.promoteEnquiry(clinicId, id);
    }

    @Post('admissions/:id/discharge')
    discharge(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.discharge(clinicId, id);
    }

    @Get('admissions/:id')
    getAdmission(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmission(clinicId, id);
    }

    @Patch('packages/:id')
    updatePackage(@Request() req, @Param('id') id: string, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.updatePackage(clinicId, id, body);
    }

    @Delete('packages/:id')
    deletePackage(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.deletePackage(clinicId, id);
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
