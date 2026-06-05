import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganisationUser } from '../../organisation-users/entities/organisation-user.entity';
import { User } from '../../users/entities/user.entity';
import { CrmStaffScope } from '../entities/crm-staff-scope.entity';
import { SetStaffScopeDto } from '../dto/staff-scope.dto';

const norm = (a?: string[]): string[] | null => (a && a.length > 0 ? a : null);

@Injectable()
export class CrmStaffService {
  constructor(
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepo: Repository<OrganisationUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CrmStaffScope)
    private readonly scopeRepo: Repository<CrmStaffScope>,
  ) {}

  /** Team members + their CRM scope (for the staff-management screen). */
  async listStaff(organisationId: string) {
    const members = await this.orgUserRepo.find({
      where: { organisationId, isActive: true },
      order: { role: 'ASC' },
    });
    if (members.length === 0) return [];

    const userIds = members.map((m) => m.userId);
    const [users, scopes] = await Promise.all([
      this.userRepo.findByIds(userIds),
      this.scopeRepo.find({ where: { organisationId } }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const scopeMap = new Map(scopes.map((s) => [s.userId, s]));

    return members.map((m) => {
      const u = userMap.get(m.userId);
      const s = scopeMap.get(m.userId);
      return {
        userId: m.userId,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : '—',
        email: u?.email ?? null,
        role: m.role,
        scope: this.toDto(s),
      };
    });
  }

  async getScope(organisationId: string, userId: string) {
    const s = await this.scopeRepo.findOne({ where: { organisationId, userId } });
    return this.toDto(s);
  }

  async setScope(
    organisationId: string,
    userId: string,
    dto: SetStaffScopeDto,
    actorUserId: string,
  ) {
    const member = await this.orgUserRepo.findOne({
      where: { organisationId, userId, isActive: true },
    });
    if (!member) throw new BadRequestException('User is not an active member of this organisation');

    let scope = await this.scopeRepo.findOne({ where: { organisationId, userId } });
    if (!scope) {
      scope = this.scopeRepo.create({ organisationId, userId, createdBy: actorUserId });
    }
    scope.states = norm(dto.states);
    scope.districts = norm(dto.districts);
    scope.stages = norm(dto.stages);
    scope.centreTypes = norm(dto.centreTypes);
    scope.priorities = norm(dto.priorities);
    scope.updatedBy = actorUserId;
    const saved = await this.scopeRepo.save(scope);
    return this.toDto(saved);
  }

  private toDto(s?: CrmStaffScope | null) {
    return {
      states: s?.states ?? [],
      districts: s?.districts ?? [],
      stages: s?.stages ?? [],
      centreTypes: s?.centreTypes ?? [],
      priorities: s?.priorities ?? [],
    };
  }
}
