import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import {
  OrganisationSettings,
  PatientVisibility,
  StaffPolicy,
} from './entities/organisation-settings.entity';

// Deliberately a real service with its own lookup methods, not the scattered
// per-consumer repository-injection pattern clinic_capabilities uses today
// (ADR-004 D12 flagged that pattern as worth improving on, not copying).
@Injectable()
export class OrganisationSettingsService {
  constructor(
    @InjectRepository(OrganisationSettings)
    private readonly settingsRepository: Repository<OrganisationSettings>,
  ) {}

  async findByOrganisationId(organisationId: string): Promise<OrganisationSettings | null> {
    return this.settingsRepository.findOne({ where: { organisationId } });
  }

  // Every organisation created after this module landed gets a row inline
  // (OrganisationsService.create()); every organisation that predates it was
  // backfilled by the migration. This is a defensive fallback for the two,
  // not the primary path — if it ever actually creates a row, that's a sign
  // one of those two guarantees broke somewhere.
  async getOrCreate(organisationId: string): Promise<OrganisationSettings> {
    const existing = await this.findByOrganisationId(organisationId);
    if (existing) return existing;
    return this.create(organisationId);
  }

  async create(organisationId: string): Promise<OrganisationSettings> {
    const settings = this.settingsRepository.create({ organisationId });
    return this.settingsRepository.save(settings);
  }

  // ADR-004 D2/D5 — the only code path that can write non-default policy
  // values, called once, at the moment an organisation requests its first
  // additional branch. Find-or-update rather than create(), since every
  // organisation already has a settings row by this point (Phase 1's
  // guarantee) — calling create() here would violate the organisation_id PK.
  // Optional manager (mirrors PatientsService.generateNextPatientCode) so this
  // can participate in BranchesService's existing first-branch transaction.
  async applyOnboardingPolicy(
    organisationId: string,
    policy: { patientVisibility?: PatientVisibility; staffPolicy?: StaffPolicy },
    manager?: EntityManager,
  ): Promise<OrganisationSettings> {
    const repo = manager ? manager.getRepository(OrganisationSettings) : this.settingsRepository;
    const existing = await repo.findOne({ where: { organisationId } });
    const target = existing ?? repo.create({ organisationId });
    if (policy.patientVisibility) target.patientVisibility = policy.patientVisibility;
    if (policy.staffPolicy) target.staffPolicy = policy.staffPolicy;
    return repo.save(target);
  }
}
