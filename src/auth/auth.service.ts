import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Staff } from '../staff/entities/staff.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';
import { OtpVerification, OtpPurpose } from '../otp/entities/otp-verification.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganisationDto } from './dto/register-organisation.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestRegistrationOtpDto } from './dto/request-registration-otp.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../email/email.service';
import { IsNull } from 'typeorm';
import { normalizePhone } from '../common/utils/phone.util';
import { ClinicProfile } from '../organisations/entities/clinic-profile.entity';
import { ManufacturerProfile } from '../organisations/entities/manufacturer-profile.entity';
import { OrganisationContact } from '../organisations/entities/organisation-contact.entity';

export interface JwtPayload {
  sub: string; // userId
  email: string | null;
  organisationId?: string; // Current organisation context
  organisationType?: string; // Type of current organisation (CLINIC, MANUFACTURER, AYURLAHI_TEAM)
  role?: string; // Role in current organisation
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganisationUser)
    private organisationUsersRepository: Repository<OrganisationUser>,
    @InjectRepository(Organisation)
    private organisationsRepository: Repository<Organisation>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(ClinicCapabilities)
    private clinicCapabilitiesRepository: Repository<ClinicCapabilities>,
    @InjectRepository(ClinicProfile)
    private clinicProfileRepository: Repository<ClinicProfile>,
    @InjectRepository(ManufacturerProfile)
    private manufacturerProfileRepository: Repository<ManufacturerProfile>,
    @InjectRepository(OrganisationContact)
    private orgContactRepository: Repository<OrganisationContact>,
    @InjectRepository(OtpVerification)
    private otpRepository: Repository<OtpVerification>,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private smsService: SmsService,
    private emailService: EmailService,
  ) { }

  private async fetchCapabilities(orgType: string, orgId: string) {
    if (orgType !== 'CLINIC') return null;
    const cap = await this.clinicCapabilitiesRepository.findOne({
      where: { organisationId: orgId },
    });
    if (!cap) return null;
    return {
      hasPostnatalCare: cap.hasPostnatalCare,
      hasAyurveda: cap.hasAyurveda,
      hasIpd: cap.hasIpd,
      hasOpd: cap.hasOpd,
    };
  }

  private async fetchStaffPosition(userId: string, orgId: string): Promise<string | null> {
    const staff = await this.staffRepository.findOne({ where: { userId, organisationId: orgId } });
    if (!staff) return null;
    if (staff.positionCustom) return staff.positionCustom;
    return staff.position.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      // Find user by email (email is optional, so also check phone if needed)
      const user = await this.usersRepository.findOne({
        where: { email },
      });

      if (!user) {
        console.log('[AuthService] validateUser - User not found:', email);
        return null;
      }

      if (!user.passwordHash) {
        console.log(
          '[AuthService] validateUser - No password hash found for user:',
          email,
        );
        return null;
      }

      console.log('[AuthService] validateUser - User found:', {
        email: user.email,
        hasPasswordHash: !!user.passwordHash,
        isActive: user.isActive,
      });

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      console.log('[AuthService] validateUser - Password comparison result:', {
        email,
        isValid: isPasswordValid,
      });

      if (!isPasswordValid) {
        console.log(
          '[AuthService] validateUser - Password mismatch for user:',
          email,
        );
        return null;
      }

      return user;
    } catch (error) {
      console.error('validateUser error:', error);
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      // Update last login
      try {
        user.lastLoginAt = new Date();
        await this.usersRepository.save(user);
      } catch (error) {
        console.error('Error updating lastLoginAt:', error);
      }

      // Fetch user's organisations
      const organisationUsers = await this.organisationUsersRepository.find({
        where: { userId: user.id },
        relations: ['organisation'],
      });

      // Get primary organisation or first organisation
      const primaryOrg = organisationUsers.find((ou) => ou.isPrimary);
      const currentOrg = primaryOrg || organisationUsers[0];

      // Block login for deactivated orgs (clinics & manufacturers only)
      if (
        currentOrg &&
        (currentOrg.organisation.type === 'CLINIC' || currentOrg.organisation.type === 'MANUFACTURER') &&
        currentOrg.organisation.isActive === false
      ) {
        throw new ForbiddenException('Your organisation account has been deactivated. Contact support@ayurlahi.com');
      }

      // Build organisations list for response
      const organisations = organisationUsers.map((ou) => ({
        id: ou.organisation.id,
        name: ou.organisation.name,
        type: ou.organisation.type,
        role: ou.role,
        isPrimary: ou.isPrimary,
      }));

      // JWT payload with current organisation context
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        organisationId: currentOrg?.organisation.id,
        organisationType: currentOrg?.organisation.type,
        role: currentOrg?.role,
      };

      const accessToken = this.jwtService.sign(payload);
      const loginCapabilities = currentOrg
        ? await this.fetchCapabilities(currentOrg.organisation.type, currentOrg.organisation.id)
        : null;
      const loginStaffPosition = currentOrg
        ? await this.fetchStaffPosition(user.id, currentOrg.organisation.id)
        : null;

      console.log('[Auth Service] Login - Token generated:', {
        userId: user.id,
        email: user.email,
        organisationId: payload.organisationId,
        role: payload.role,
        organisationsCount: organisations.length,
      });

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
        currentOrganisation: currentOrg
          ? {
            id: currentOrg.organisation.id,
            name: currentOrg.organisation.name,
            type: currentOrg.organisation.type,
            role: currentOrg.role,
            approvalStatus: currentOrg.organisation.approvalStatus,
            isActive: currentOrg.organisation.isActive,
            permissions: currentOrg.permissions ?? null,
            capabilities: loginCapabilities,
            staffPosition: loginStaffPosition,
          }
          : null,
        organisations,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(registerDto: RegisterDto) {
    // Phone is required in the new structure
    if (!registerDto.phone) {
      throw new BadRequestException('Phone number is required');
    }

    const phone = normalizePhone(registerDto.phone) as string;

    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: registerDto.email }, { phone }],
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or phone already exists',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user (no role, clinicId, manufacturerId - those are in organisation_users)
    const user = this.usersRepository.create({
      email: registerDto.email || null,
      passwordHash: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone,
      isActive: true,
      isEmailVerified: false,
    });

    const savedUser = await this.usersRepository.save(user);

    // Note: Organisation assignment should be done separately
    // For clinic/manufacturer registration, they need to create organisation first
    // Then link user to organisation via organisation_users

    return {
      accessToken: null, // No token until organisation is assigned
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        phone: savedUser.phone,
        isActive: savedUser.isActive,
        isEmailVerified: savedUser.isEmailVerified,
      },
      message:
        'User registered successfully. Please complete organisation registration.',
    };
  }

  async registerOrganisation(dto: RegisterOrganisationDto) {
    const phone = normalizePhone(dto.phone) as string;

    // Validate the verification token — proves the phone was OTP-verified
    // in a prior /auth/verify-registration-otp call and hasn't expired.
    let tokenPayload: { purpose?: string; phone?: string };
    try {
      tokenPayload = this.jwtService.verify(dto.verificationToken);
    } catch {
      throw new UnauthorizedException(
        'Phone verification expired or invalid. Please request a new OTP.',
      );
    }
    if (
      tokenPayload?.purpose !== 'registration_verification' ||
      normalizePhone(tokenPayload.phone || '') !== phone
    ) {
      throw new UnauthorizedException(
        'Phone verification does not match the submitted phone number.',
      );
    }

    // Check for existing user
    const existing = await this.usersRepository.findOne({
      where: [{ email: dto.email }, { phone }],
    });
    if (existing) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone,
      isActive: true,
      isEmailVerified: false,
    });
    const savedUser = await this.usersRepository.save(user);

    // Create organisation (pending approval)
    const org = this.organisationsRepository.create({
      name: dto.orgName,
      type: dto.orgType,
      approvalStatus: 'pending',
      isActive: true,
    });
    const savedOrg = await this.organisationsRepository.save(org);

    // Auto-create default capabilities row for new CLINIC orgs
    if (savedOrg.type === 'CLINIC') {
      const defaultCaps = this.clinicCapabilitiesRepository.create({
        organisationId: savedOrg.id,
        hasPostnatalCare: true,
        hasAyurveda: true,
        hasIpd: true,
        hasOpd: true,
      });
      await this.clinicCapabilitiesRepository.save(defaultCaps);

      // Clinic profile — license number, gstin, etc.
      await this.clinicProfileRepository.save(
        this.clinicProfileRepository.create({
          organisationId: savedOrg.id,
          clinicName: dto.orgName,
          licenseNumber: dto.licenseNumber || null,
          gstin: dto.gstin || null,
        }),
      );
    }

    if (savedOrg.type === 'MANUFACTURER') {
      await this.manufacturerProfileRepository.save(
        this.manufacturerProfileRepository.create({
          organisationId: savedOrg.id,
          companyName: dto.orgName,
          licenseNumber: dto.licenseNumber || null,
          gstin: dto.gstin || null,
        }),
      );
    }

    // Contact details — address, phone, etc.
    const hasContact = dto.address || dto.city || dto.state || dto.pincode || dto.orgPhone;
    if (hasContact) {
      await this.orgContactRepository.save(
        this.orgContactRepository.create({
          organisationId: savedOrg.id,
          type: 'primary',
          addressLine1: dto.address || null,
          city: dto.city || null,
          state: dto.state || null,
          pincode: dto.pincode || null,
          phone: normalizePhone(dto.orgPhone) || null,
          isPrimary: true,
        }),
      );
    }

    // Link user to org as OWNER
    const orgUser = this.organisationUsersRepository.create({
      userId: savedUser.id,
      organisationId: savedOrg.id,
      role: 'OWNER',
      isPrimary: true,
    });
    await this.organisationUsersRepository.save(orgUser);

    // Notify all SUPER_ADMIN / SUPPORT users in AYURLAHI_TEAM
    this.notificationsService.getAdminUserIds().then((adminIds) => {
      if (adminIds.length > 0) {
        return this.notificationsService.sendToUsers({
          userIds: adminIds,
          title: '🔔 New Organisation Request',
          body: `${savedOrg.name} has submitted an application for review.`,
          data: { type: 'new_org_request', organisationId: savedOrg.id },
        });
      }
    }).catch((err) => console.error('[registerOrganisation] admin notify error:', err));

    // Issue token so user can see pending screen without logging in again
    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      organisationId: savedOrg.id,
      organisationType: savedOrg.type,
      role: 'OWNER',
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        phone: savedUser.phone,
        isActive: savedUser.isActive,
        isEmailVerified: savedUser.isEmailVerified,
      },
      currentOrganisation: {
        id: savedOrg.id,
        name: savedOrg.name,
        type: savedOrg.type,
        role: 'OWNER' as const,
        approvalStatus: savedOrg.approvalStatus,
        isActive: savedOrg.isActive,
        permissions: null,
        capabilities: savedOrg.type === 'CLINIC'
          ? { hasPostnatalCare: true, hasAyurveda: true, hasIpd: true, hasOpd: true }
          : null,
      },
    };
  }

  async getCurrentUser(userId: string, organisationId?: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Fetch user's organisations
    const organisationUsers = await this.organisationUsersRepository.find({
      where: { userId },
      relations: ['organisation'],
    });

    // Get current organisation context
    const currentOrgUser = organisationId
      ? organisationUsers.find((ou) => ou.organisationId === organisationId)
      : organisationUsers.find((ou) => ou.isPrimary) || organisationUsers[0];

    const organisations = organisationUsers.map((ou) => ({
      id: ou.organisation.id,
      name: ou.organisation.name,
      type: ou.organisation.type,
      role: ou.role,
      isPrimary: ou.isPrimary,
    }));

    const meCapabilities = currentOrgUser
      ? await this.fetchCapabilities(currentOrgUser.organisation.type, currentOrgUser.organisation.id)
      : null;
    const meStaffPosition = currentOrgUser
      ? await this.fetchStaffPosition(user.id, currentOrgUser.organisation.id)
      : null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      currentOrganisation: currentOrgUser
        ? {
          id: currentOrgUser.organisation.id,
          name: currentOrgUser.organisation.name,
          type: currentOrgUser.organisation.type,
          role: currentOrgUser.role,
          approvalStatus: currentOrgUser.organisation.approvalStatus,
          isActive: currentOrgUser.organisation.isActive,
          permissions: currentOrgUser.permissions ?? null,
          capabilities: meCapabilities,
          staffPosition: meStaffPosition,
        }
        : null,
      organisations,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken);

      // Get user from database
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Fetch user's organisations
      const organisationUsers = await this.organisationUsersRepository.find({
        where: { userId: user.id },
        relations: ['organisation'],
      });

      // Use organisation from token or get primary
      const currentOrg =
        organisationUsers.find(
          (ou) => ou.organisationId === payload.organisationId,
        ) ||
        organisationUsers.find((ou) => ou.isPrimary) ||
        organisationUsers[0];

      // Generate new access token
      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        organisationId: currentOrg?.organisation.id,
        organisationType: currentOrg?.organisation.type,
        role: currentOrg?.role,
      };

      const accessToken = this.jwtService.sign(newPayload);

      const organisations = organisationUsers.map((ou) => ({
        id: ou.organisation.id,
        name: ou.organisation.name,
        type: ou.organisation.type,
        role: ou.role,
        isPrimary: ou.isPrimary,
      }));

      const refreshCapabilities = currentOrg
        ? await this.fetchCapabilities(currentOrg.organisation.type, currentOrg.organisation.id)
        : null;

      return {
        accessToken,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
        currentOrganisation: currentOrg
          ? {
            id: currentOrg.organisation.id,
            name: currentOrg.organisation.name,
            type: currentOrg.organisation.type,
            role: currentOrg.role,
            approvalStatus: currentOrg.organisation.approvalStatus,
            isActive: currentOrg.organisation.isActive,
            permissions: currentOrg.permissions ?? null,
            capabilities: refreshCapabilities,
          }
          : null,
        organisations,
      };
    } catch (error) {
      console.error(
        '[Auth Service] Refresh token - Verification failed:',
        error,
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async switchOrganisation(userId: string, organisationId: string) {
    // Verify user has access to this organisation
    const orgUser = await this.organisationUsersRepository.findOne({
      where: { userId, organisationId },
      relations: ['organisation'],
    });

    if (!orgUser) {
      throw new UnauthorizedException(
        'User does not have access to this organisation',
      );
    }

    // Get user
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new token with new organisation context
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organisationId: orgUser.organisation.id,
      organisationType: orgUser.organisation.type,
      role: orgUser.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      organisation: {
        id: orgUser.organisation.id,
        name: orgUser.organisation.name,
        type: orgUser.organisation.type,
        role: orgUser.role,
      },
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      if (!user.passwordHash) {
        throw new BadRequestException('No password set on this account');
      }
      const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!match) {
        throw new BadRequestException('Current password is incorrect');
      }
      user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = normalizePhone(dto.phone) as string;
    await this.usersRepository.save(user);

    // Keep staff record in sync
    const staffRecord = await this.staffRepository.findOne({ where: { userId: userId } });
    if (staffRecord) {
      if (dto.firstName !== undefined) staffRecord.firstName = dto.firstName;
      if (dto.lastName !== undefined) staffRecord.lastName = dto.lastName;
      if (dto.phone !== undefined) staffRecord.phone = normalizePhone(dto.phone) as string;
      await this.staffRepository.save(staffRecord);
    }

    const { passwordHash, ...result } = user as any;
    return result;
  }

  // ── OTP ──────────────────────────────────────────────────────────────────────

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const identifier = dto.channel === 'sms' ? dto.phone! : dto.email!;
    const where = dto.channel === 'sms'
      ? { phone: identifier }
      : { email: identifier };

    const user = await this.usersRepository.findOne({ where });

    if (!user) {
      const msg = dto.channel === 'sms'
        ? 'No account found with this mobile number.'
        : 'No account found with this email address.';
      throw new NotFoundException(msg);
    }

    if (dto.purpose === 'login' && !user.isActive) {
      throw new BadRequestException('Account is deactivated');
    }

    // Invalidate any prior unused OTPs for this identifier+purpose
    await this.otpRepository
      .createQueryBuilder()
      .update(OtpVerification)
      .set({ usedAt: new Date() })
      .where('identifier = :identifier AND purpose = :purpose AND used_at IS NULL', {
        identifier,
        purpose: dto.purpose,
      })
      .execute();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpRepository.save(
      this.otpRepository.create({
        identifier,
        channel: dto.channel,
        otpHash,
        purpose: dto.purpose,
        expiresAt,
        usedAt: null,
      }),
    );

    if (dto.channel === 'sms') {
      await this.smsService.sendOtp(identifier, otp);
    } else {
      await this.emailService.sendOtp(identifier, otp);
    }

    return { message: 'OTP sent successfully.' };
  }

  async verifyOtpLogin(dto: VerifyOtpDto): Promise<any> {
    const record = await this._findValidOtp(dto.identifier, dto.purpose);
    const valid =
      this._isMagicOtp(dto.otp) || (await bcrypt.compare(dto.otp, record.otpHash));
    if (!valid) throw new UnauthorizedException('Invalid OTP');

    // For password_reset: don't consume the OTP yet — resetPassword will consume it
    if (dto.purpose !== 'login') {
      return { message: 'OTP verified', identifier: dto.identifier };
    }

    await this.otpRepository.update(record.id, { usedAt: new Date() });

    // Find user by phone or email depending on how OTP was sent
    const isEmail = record.channel === 'email';
    const user = await this.usersRepository.findOne({
      where: isEmail ? { email: dto.identifier } : { phone: dto.identifier },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const organisationUsers = await this.organisationUsersRepository.find({
      where: { userId: user.id },
      relations: ['organisation'],
    });

    const primaryOrg = organisationUsers.find((ou) => ou.isPrimary);
    const currentOrg = primaryOrg || organisationUsers[0];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organisationId: currentOrg?.organisation.id,
      organisationType: currentOrg?.organisation.type,
      role: currentOrg?.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const capabilities = currentOrg
      ? await this.fetchCapabilities(currentOrg.organisation.type, currentOrg.organisation.id)
      : null;
    const otpStaffPosition = currentOrg
      ? await this.fetchStaffPosition(user.id, currentOrg.organisation.id)
      : null;

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
      },
      currentOrganisation: currentOrg
        ? {
            id: currentOrg.organisation.id,
            name: currentOrg.organisation.name,
            type: currentOrg.organisation.type,
            role: currentOrg.role,
            approvalStatus: currentOrg.organisation.approvalStatus,
            isActive: currentOrg.organisation.isActive,
            permissions: currentOrg.permissions,
            capabilities,
            staffPosition: otpStaffPosition,
          }
        : null,
      organisations: organisationUsers.map((ou) => ({
        id: ou.organisation.id,
        name: ou.organisation.name,
        type: ou.organisation.type,
        role: ou.role,
        isPrimary: ou.isPrimary,
      })),
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this._findValidOtp(dto.identifier, 'password_reset');
    const valid =
      this._isMagicOtp(dto.otp) || (await bcrypt.compare(dto.otp, record.otpHash));
    if (!valid) throw new UnauthorizedException('Invalid OTP');

    const isEmail = record.channel === 'email';
    const user = await this.usersRepository.findOne({
      where: isEmail ? { email: dto.identifier } : { phone: dto.identifier },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.otpRepository.update(record.id, { usedAt: new Date() });
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Password reset successfully' };
  }

  private async _findValidOtp(identifier: string, purpose: OtpPurpose): Promise<OtpVerification> {
    const record = await this.otpRepository.findOne({
      where: { identifier, purpose, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!record) throw new UnauthorizedException('OTP not found or already used');
    if (record.expiresAt < new Date()) throw new UnauthorizedException('OTP has expired');

    return record;
  }

  // Dev/QA shortcut: in any non-production NODE_ENV, '121212' is accepted as
  // a valid OTP without hitting the SMS provider's hashed record. Lets
  // testers skip reading backend logs while DLT registration is in progress.
  // 6 digits because the verify DTOs require exactly 6 (real OTPs are 6 too).
  private _isMagicOtp(otp: string): boolean {
    return process.env.NODE_ENV !== 'production' && otp === '121212';
  }

  async requestRegistrationOtp(
    dto: RequestRegistrationOtpDto,
  ): Promise<{ message: string }> {
    const phone = normalizePhone(dto.phone) as string;

    // Block re-registration with an active account's phone.
    const existing = await this.usersRepository.findOne({ where: { phone } });
    if (existing) {
      throw new ConflictException(
        'An account with this phone number already exists. Please log in instead.',
      );
    }

    // Invalidate any prior unused registration OTPs for this phone.
    await this.otpRepository
      .createQueryBuilder()
      .update(OtpVerification)
      .set({ usedAt: new Date() })
      .where(
        'identifier = :identifier AND purpose = :purpose AND used_at IS NULL',
        { identifier: phone, purpose: 'registration' as OtpPurpose },
      )
      .execute();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.otpRepository.save(
      this.otpRepository.create({
        identifier: phone,
        channel: 'sms',
        otpHash,
        purpose: 'registration',
        expiresAt,
        usedAt: null,
      }),
    );

    await this.smsService.sendOtp(phone, otp);

    return { message: 'OTP sent successfully.' };
  }

  async verifyRegistrationOtp(
    dto: VerifyRegistrationOtpDto,
  ): Promise<{ verificationToken: string; phone: string }> {
    const phone = normalizePhone(dto.phone) as string;
    const record = await this._findValidOtp(phone, 'registration');

    const valid =
      this._isMagicOtp(dto.otp) || (await bcrypt.compare(dto.otp, record.otpHash));
    if (!valid) throw new UnauthorizedException('Invalid OTP');

    await this.otpRepository.update(record.id, { usedAt: new Date() });

    // Short-lived token that the registration form submits alongside the full
    // org details. registerOrganisation validates the token before any write.
    const verificationToken = this.jwtService.sign(
      { purpose: 'registration_verification', phone },
      { expiresIn: '15m' },
    );
    return { verificationToken, phone };
  }
}
