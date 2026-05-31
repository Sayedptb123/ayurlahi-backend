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

export const REQUIRES_CAPABILITY = 'requires_capability';
export type ClinicCapabilityFlag =
  | 'hasPostnatalCare'
  | 'hasAyurveda'
  | 'hasIpd'
  | 'hasOpd';

/**
 * Decorator that marks a route as requiring a specific clinic capability.
 *
 * Example:
 *   @RequiresCapability('hasPostnatalCare')
 *   @Post('feeding-logs')
 *   createFeedingLog(...)
 */
export const RequiresCapability = (flag: ClinicCapabilityFlag) =>
  SetMetadata(REQUIRES_CAPABILITY, flag);

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(ClinicCapabilities)
    private capabilitiesRepository: Repository<ClinicCapabilities>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ClinicCapabilityFlag>(
      REQUIRES_CAPABILITY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.organisationId) {
      throw new ForbiddenException('No organisation context on request');
    }

    // AYURLAHI_TEAM bypasses capability checks (they're inspecting, not consuming)
    if (user.organisationType === 'AYURLAHI_TEAM') return true;

    // Only clinics have capabilities; manufacturers don't.
    if (user.organisationType !== 'CLINIC') {
      throw new ForbiddenException(
        `This feature is only available to clinic organisations`,
      );
    }

    const caps = await this.capabilitiesRepository.findOne({
      where: { organisationId: user.organisationId },
    });
    if (!caps || caps[required] !== true) {
      throw new ForbiddenException(
        `Your clinic does not have the "${required}" capability enabled. Ask your manager to enable it under Clinic Services.`,
      );
    }
    return true;
  }
}
