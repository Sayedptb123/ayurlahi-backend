import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { GetDisputesDto } from './dto/get-disputes.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { RoleUtils } from '../common/utils/role.utils';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) { }

  async create(
    userId: string,
    organisationId: string,
    organisationType: string | undefined,
    dto: CreateDisputeDto,
  ): Promise<Dispute> {
    // Verify the order exists and is owned by the calling clinic
    const order = await this.ordersRepository.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.organisationId !== organisationId) {
      throw new ForbiddenException('You can only raise disputes on your own orders');
    }
    // Disputes typically come from clinics
    if (organisationType && organisationType !== 'CLINIC') {
      throw new BadRequestException('Only clinics can raise disputes');
    }
    const dispute = this.disputesRepository.create({
      orderId: dto.orderId,
      organisationId,
      type: dto.type,
      description: dto.description,
      // evidence is a jsonb on the entity — wrap the optional text payload as an object
      evidence: dto.evidence ? { text: dto.evidence } : null,
      status: DisputeStatus.OPEN,
    });
    const saved = await this.disputesRepository.save(dispute);
    return saved;
  }

  async findAll(userId: string, userRole: string, query: GetDisputesDto, organisationId?: string) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const qb = this.disputesRepository.createQueryBuilder('dispute')
      .where('dispute.deletedAt IS NULL')
      .leftJoinAndSelect('dispute.order', 'order')
      .orderBy('dispute.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (!RoleUtils.isAdminOrSupport(userRole) && organisationId) {
      qb.andWhere('dispute.organisationId = :organisationId', { organisationId });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fixed 2026-09-07 (scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md
   * §9/§17): this previously checked `userRole === 'clinic'`, which never
   * matches a real role value (OWNER/MANAGER/etc. are roles; CLINIC is an
   * organisationType) — so a real clinic OWNER fell through to the
   * `!RoleUtils.isAdminOrSupport(userRole)` branch and got a 403 on their
   * own dispute. Fixed to check organisationType, matching the pattern
   * already used correctly in create() above. Also adds a MANUFACTURER
   * branch that never existed here at all — the manufacturer associated
   * with the disputed order needs read access too (e.g. to process a
   * replacement against it), and previously had none.
   */
  async findOne(id: string, userId: string, userRole: string, organisationType?: string, organisationId?: string) {
    const dispute = await this.disputesRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['order', 'order.items'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    if (RoleUtils.isAdminOrSupport(userRole)) {
      return dispute;
    }

    if (organisationType === 'CLINIC') {
      if (!organisationId || dispute.organisationId !== organisationId) {
        throw new ForbiddenException('You do not have access to this dispute');
      }
      return dispute;
    }

    if (organisationType === 'MANUFACTURER') {
      const hasManufacturerItems = dispute.order?.items?.some(
        (item) => item.manufacturerId === organisationId,
      );
      if (!organisationId || !hasManufacturerItems) {
        throw new ForbiddenException('You do not have access to this dispute');
      }
      return dispute;
    }

    throw new ForbiddenException('You do not have permission to view disputes');
  }

  async resolve(
    id: string,
    userId: string,
    userRole: string,
    resolveDto: ResolveDisputeDto,
  ) {
    // Only admin and support can resolve disputes
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to resolve disputes',
      );
    }

    const dispute = await this.findOne(id, userId, userRole);

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolveDto.resolution;
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = userId;

    return this.disputesRepository.save(dispute);
  }
}
