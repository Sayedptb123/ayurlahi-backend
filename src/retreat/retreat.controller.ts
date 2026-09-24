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
    Res,
    UseInterceptors,
    UploadedFile, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RetreatService } from './retreat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard, RequireModule } from '../auth/guards/module.guard';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto, RecordRefundDto, RecordAdvanceDto, PromoteBookingDto } from './dto/booking.dto';
import { CreateEnquiryDto, UpdateEnquiryDto, ConvertEnquiryDto } from './dto/enquiry.dto';
import { CreateFieldDefinitionDto, UpdateFieldDefinitionDto } from './dto/field-definition.dto';
import { CreateRoomCategoryDto, UpdateRoomCategoryDto, GetRoomCategoriesDto } from './dto/room-category.dto';
import { CreatePackageDto, UpdatePackageDto, GetPackagesDto } from './dto/package.dto';
import { SetPricingMatrixDto, GetPricingMatrixDto } from './dto/pricing-matrix.dto';
import { SetRoomPricingOverrideDto, GetRoomPricingOverridesDto } from './dto/room-pricing-override.dto';
import { BookingStatus } from './entities/room-booking.entity';
import { EnquiryStatus } from './entities/booking-enquiry.entity';

// Branch scoping G2/G3: every action on one booking / admission first calls
// assertBookingAccess / assertAdmissionAccess (404 outside the caller's
// branch scope) — scope/Branch_Scoping_Remediation_Plan_2026-09-24.md.
@Controller('retreat')
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequireModule('booking')
export class RetreatController {
    constructor(private readonly retreatService: RetreatService) { }

    @Get('room-categories')
    getRoomCategories(@Request() req, @Query() query: GetRoomCategoriesDto) {
        return this.retreatService.getRoomCategories(req.user.organisationId, query.branchId);
    }

    @Post('room-categories')
    createRoomCategory(@Request() req, @Body() body: CreateRoomCategoryDto) {
        return this.retreatService.createRoomCategory(req.user.organisationId, body, req.user);
    }

    @Patch('room-categories/:id')
    updateRoomCategory(@Request() req, @Param('id') id: string, @Body() body: UpdateRoomCategoryDto) {
        return this.retreatService.updateRoomCategory(req.user.organisationId, id, body, req.user);
    }

    @Delete('room-categories/:id')
    deleteRoomCategory(@Request() req, @Param('id') id: string) {
        return this.retreatService.deleteRoomCategory(req.user.organisationId, id, req.user);
    }

    // Must be declared before rooms/:id to avoid 'available' being matched as :id
    @Get('rooms/resolve-price')
    resolvePrice(
        @Request() req,
        @Query('roomId') roomId: string,
        @Query('packageId') packageId: string,
        @Query('acRequired') acRequired: string,
    ) {
        return this.retreatService.resolvePrice(req.user.organisationId, roomId, packageId, acRequired === 'true');
    }

    @Get('pricing-matrix')
    getPricingMatrix(@Request() req, @Query() query: GetPricingMatrixDto) {
        return this.retreatService.getPricingMatrix(req.user.organisationId, query.branchId);
    }

    @Post('pricing-matrix')
    setPricingMatrix(@Request() req, @Body() body: SetPricingMatrixDto) {
        return this.retreatService.setPricingMatrix(req.user.organisationId, body, req.user);
    }

    @Delete('pricing-matrix/:id')
    deletePricingMatrixEntry(@Request() req, @Param('id') id: string) {
        return this.retreatService.deletePricingMatrixEntry(req.user.organisationId, id, req.user);
    }

    @Get('room-pricing-overrides')
    getRoomPricingOverrides(@Request() req, @Query() query: GetRoomPricingOverridesDto) {
        return this.retreatService.getRoomPricingOverrides(req.user.organisationId, query.branchId);
    }

    @Post('room-pricing-overrides')
    setRoomPricingOverride(@Request() req, @Body() body: SetRoomPricingOverrideDto) {
        return this.retreatService.setRoomPricingOverride(req.user.organisationId, body, req.user);
    }

    @Delete('room-pricing-overrides/:id')
    deleteRoomPricingOverride(@Request() req, @Param('id') id: string) {
        return this.retreatService.deleteRoomPricingOverride(req.user.organisationId, id, req.user);
    }

    @Get('rooms')
    getRooms(@Request() req, @Query('branchId') branchId?: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getRooms(clinicId, branchId, req.user);
    }

    @Get('today')
    getTodaySummary(@Request() req, @Query('branchId') branchId?: string) {
        return this.retreatService.getTodaySummary(req.user.organisationId, req.user.userId, req.user.role, branchId);
    }

    // Must be declared before any 'rooms/:id' route so 'available' isn't matched as :id
    @Get('rooms/available')
    getAvailableRooms(
        @Request() req,
        @Query('checkInDate') checkInDate: string,
        @Query('checkOutDate') checkOutDate: string,
        @Query('branchId') branchId?: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAvailableRooms(clinicId, checkInDate, checkOutDate, branchId, req.user);
    }

    @Post('rooms')
    createRoom(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createRoom(clinicId, body, req.user);
    }

    @Patch('rooms/:id')
    updateRoom(@Request() req, @Param('id') id: string, @Body() body: { roomNumber?: string; floor?: string; roomCategoryId?: string; capacity?: number; amenities?: string[]; description?: string; status?: string; branchId?: string | null }) {
        const clinicId = req.user.organisationId;
        return this.retreatService.updateRoom(clinicId, id, body, req.user);
    }

    @Delete('rooms/:id')
    deleteRoom(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.deleteRoom(clinicId, id, req.user);
    }

    @Get('packages')
    getPackages(@Request() req, @Query() query: GetPackagesDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getPackages(clinicId, query.branchId);
    }

    @Post('packages')
    createPackage(@Request() req, @Body() body: CreatePackageDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createPackage(clinicId, body, req.user);
    }

    @Get('admissions')
    getAdmissions(@Request() req, @Query('patientId') patientId?: string, @Query('status') status?: string, @Query('branchId') branchId?: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmissions(clinicId, req.user.userId, { patientId, status, branchId }, req.user.role);
    }

    // NOTE: must be declared before 'admissions/:id' so it isn't matched as an :id param
    @Get('admissions/stats')
    getAdmissionStats(@Request() req, @Query('branchId') branchId?: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmissionStats(clinicId, req.user.userId, req.user.role, branchId);
    }

    @Post('admissions')
    checkIn(@Request() req, @Body() body) {
        const clinicId = req.user.organisationId;
        return this.retreatService.checkIn(clinicId, body, req.user.userId, req.user.role);
    }

    // --- ENQUIRY ENDPOINTS ---
    @Get('enquiries')
    listEnquiries(
        @Request() req,
        @Query('status') status?: EnquiryStatus,
        @Query('assignedTo') assignedTo?: string,
        @Query('branchId') branchId?: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.listEnquiries(clinicId, { status, assignedTo, branchId }, req.user);
    }

    @Post('enquiries')
    createEnquiry(@Request() req, @Body() dto: CreateEnquiryDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createEnquiry(clinicId, dto, req.user);
    }

    @Patch('enquiries/:id')
    async updateEnquiry(@Request() req, @Param('id') id: string, @Body() dto: UpdateEnquiryDto) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertEnquiryAccess(clinicId, id, req.user);
        return this.retreatService.updateEnquiry(clinicId, id, dto);
    }

    @Post('enquiries/:id/convert')
    async convertEnquiryToBooking(@Request() req, @Param('id') id: string, @Body() dto: ConvertEnquiryDto) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertEnquiryAccess(clinicId, id, req.user);
        return this.retreatService.convertEnquiryToBooking(clinicId, id, dto, req.user);
    }

    @Post('enquiries/:id/lost')
    async markEnquiryLost(@Request() req, @Param('id') id: string, @Body() body: { lostReason?: string }) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertEnquiryAccess(clinicId, id, req.user);
        return this.retreatService.markEnquiryLost(clinicId, id, body?.lostReason);
    }

    @Post('bookings/:id/promote')
    async promoteEnquiry(@Request() req, @Param('id') id: string, @Body() dto: PromoteBookingDto) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertBookingAccess(clinicId, id, req.user);
        return this.retreatService.promoteEnquiry(clinicId, id, req.user.userId, {
            role: req.user.role,
            patientId: dto?.patientId,
            createNew: dto?.createNew,
        });
    }

    @Post('admissions/:id/discharge')
    async discharge(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertAdmissionAccess(clinicId, id, req.user);
        return this.retreatService.discharge(clinicId, id);
    }

    // Mark Delivery Occurred — set/clear the admission's actual delivery date.
    @Patch('admissions/:id/delivery')
    async recordDelivery(@Request() req, @Param('id') id: string, @Body('actualDeliveryDate') actualDeliveryDate: string | null) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertAdmissionAccess(clinicId, id, req.user);
        return this.retreatService.recordDelivery(clinicId, id, actualDeliveryDate ?? null);
    }

    @Get('admissions/:id')
    getAdmission(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getAdmission(clinicId, id, req.user.userId, req.user.role);
    }

    @Patch('packages/:id')
    updatePackage(@Request() req, @Param('id') id: string, @Body() body: UpdatePackageDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.updatePackage(clinicId, id, body, req.user);
    }

    @Delete('packages/:id')
    deletePackage(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.deletePackage(clinicId, id, req.user);
    }

    // --- BOOKING ENDPOINTS ---
    @Post('bookings')
    createBooking(@Request() req, @Body() dto: CreateBookingDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.createBooking(clinicId, dto, req.user.userId, req.user.role);
    }

    @Get('bookings')
    getBookings(
        @Request() req,
        @Query('status') status?: BookingStatus,
        @Query('roomId') roomId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('branchId') branchId?: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getBookings(clinicId, req.user.userId, { status, roomId, startDate, endDate, branchId }, req.user.role);
    }

    @Get('bookings/calendar')
    getCalendarData(
        @Request() req,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getCalendarData(clinicId, startDate, endDate, req.user.userId, req.user.role);
    }

    @Get('bookings/:id')
    getBookingById(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        return this.retreatService.getBookingById(clinicId, id, req.user.userId, req.user.role);
    }

    @Patch('bookings/:id')
    async updateBooking(@Request() req, @Param('id') id: string, @Body() dto: UpdateBookingDto) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertBookingAccess(clinicId, id, req.user);
        return this.retreatService.updateBooking(clinicId, id, dto, req.user);
    }

    @Delete('bookings/:id')
    async cancelBooking(@Request() req, @Param('id') id: string) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertBookingAccess(clinicId, id, req.user);
        return this.retreatService.cancelBooking(clinicId, id);
    }

    @Delete('bookings/:id/remove')
    async removeBooking(@Request() req, @Param('id') id: string) {
        await this.retreatService.assertBookingAccess(req.user.organisationId, id, req.user);
        return this.retreatService.removeBooking(req.user.organisationId, id);
    }

    // Booking advances (cash MVP batch 1): each advance is a receipt row.
    @Get('bookings/:id/advances')
    async listAdvances(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
        await this.retreatService.assertBookingAccess(req.user.organisationId, id, req.user);
        return this.retreatService.listAdvances(req.user.organisationId, id);
    }

    @Post('bookings/:id/advances')
    async recordAdvance(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordAdvanceDto) {
        await this.retreatService.assertBookingAccess(req.user.organisationId, id, req.user);
        return this.retreatService.recordAdvance(req.user.organisationId, id, dto, req.user.userId, req.user.role);
    }

    @Delete('bookings/:id/advances/:receiptId')
    async voidAdvance(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Param('receiptId', ParseUUIDPipe) receiptId: string) {
        await this.retreatService.assertBookingAccess(req.user.organisationId, id, req.user);
        return this.retreatService.voidAdvance(req.user.organisationId, id, receiptId, req.user.userId, req.user.role);
    }

    @Patch('bookings/:id/refund')
    async recordRefund(@Request() req, @Param('id') id: string, @Body() dto: RecordRefundDto) {
        const clinicId = req.user.organisationId;
        await this.retreatService.assertBookingAccess(clinicId, id, req.user);
        return this.retreatService.recordRefund(clinicId, id, req.user.userId, dto);
    }

    @Post('bookings/check-availability')
    checkAvailability(@Request() req, @Body() dto: CheckAvailabilityDto) {
        const clinicId = req.user.organisationId;
        return this.retreatService.checkAvailability(clinicId, dto, req.user);
    }

    @Get('export')
    async exportXlsx(@Request() req, @Res() res: Response) {
        const buffer = await this.retreatService.exportXlsx(req.user.organisationId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="ayurlahi-setup.xlsx"',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }

    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    importXlsx(
        @Request() req,
        @UploadedFile() file: Express.Multer.File,
        @Query('branchId') branchId: string,
        @Query('dryRun') dryRun?: string,
    ) {
        if (!file) throw new Error('No file uploaded');
        // ADR-004 D15 — one branch per import, required.
        if (!branchId) throw new Error('branchId is required');
        return this.retreatService.importXlsx(req.user.organisationId, file.buffer, branchId, dryRun === 'true', req.user);
    }

    // ─── Custom Field Definitions ────────────────────────────────────────────

    @Get('field-definitions')
    getFieldDefinitions(@Request() req) {
        return this.retreatService.getFieldDefinitions(req.user.organisationId);
    }

    @Post('field-definitions')
    createFieldDefinition(@Request() req, @Body() dto: CreateFieldDefinitionDto) {
        return this.retreatService.createFieldDefinition(req.user.organisationId, dto);
    }

    @Patch('field-definitions/:id')
    updateFieldDefinition(@Request() req, @Param('id') id: string, @Body() dto: UpdateFieldDefinitionDto) {
        return this.retreatService.updateFieldDefinition(req.user.organisationId, id, dto);
    }

    @Delete('field-definitions/:id')
    deleteFieldDefinition(@Request() req, @Param('id') id: string) {
        return this.retreatService.deleteFieldDefinition(req.user.organisationId, id);
    }
}
