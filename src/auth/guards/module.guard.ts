import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SetMetadata } from '@nestjs/common';
import { ClinicCapabilities } from '../../clinic-capabilities/entities/clinic-capabilities.entity';

export const REQUIRES_MODULE = 'requires_module';
export type AppModule =
    | 'booking'
    | 'rooms'
    | 'enquiries'
    | 'postnatal_care'
    | 'ayurveda'
    | 'ipd'
    | 'opd'
    | 'appointments'
    | 'billing'
    | 'staff'
    | 'inventory'
    | 'patients'
    | 'medical_records'
    | 'prescriptions'
    | 'lab_reports'
    | 'analytics'
    | 'expenses'
    | 'payroll'
    | 'tasks'
    | 'manufacturing'
    | 'promotions'
    | 'crm';

// Canonical module registry — source of truth for what can be enabled per org.
export const ALL_MODULES: AppModule[] = [
    'booking', 'rooms', 'enquiries', 'postnatal_care', 'ayurveda', 'ipd', 'opd',
    'appointments', 'billing', 'staff', 'inventory', 'patients', 'medical_records',
    'prescriptions', 'lab_reports', 'analytics', 'expenses', 'payroll', 'tasks',
    'manufacturing', 'promotions', 'crm',
];

// Onboarding presets (resolved server-side; "Custom" sends an explicit list).
export const MODULE_PRESETS: Record<string, AppModule[]> = {
    BOOKING_ONLY: ['booking', 'rooms', 'enquiries'],
    FULL_CLINIC: [...ALL_MODULES],
    POSTNATAL_ONLY: ['booking', 'rooms', 'enquiries', 'postnatal_care', 'patients', 'medical_records', 'billing'],
};

/**
 * Decorator that marks a route as requiring a specific module to be enabled.
 *
 * Example:
 *   @RequireModule('booking')
 *   @Controller('retreat')
 */
export const RequireModule = (moduleName: AppModule) =>
    SetMetadata(REQUIRES_MODULE, moduleName);

@Injectable()
export class ModuleGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectRepository(ClinicCapabilities)
        private capabilitiesRepository: Repository<ClinicCapabilities>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<AppModule>(
            REQUIRES_MODULE,
            [context.getHandler(), context.getClass()],
        );
        if (!required) return true;

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user?.organisationId) {
            throw new ForbiddenException('No organisation context on request');
        }

        // AYURLAHI_TEAM bypasses module checks
        if (user.organisationType === 'AYURLAHI_TEAM') return true;

        // Only clinics have module config; manufacturers don't.
        if (user.organisationType !== 'CLINIC') {
            throw new ForbiddenException(
                'This feature is only available to clinic organisations',
            );
        }

        const caps = await this.capabilitiesRepository.findOne({
            where: { organisationId: user.organisationId },
        });

        const enabled: string[] = caps?.enabledModules ?? [];
        if (!enabled.includes(required)) {
            throw new ForbiddenException(
                `The "${required}" module is not enabled for your clinic. Ask your manager to enable it under Clinic Services.`,
            );
        }
        return true;
    }
}
