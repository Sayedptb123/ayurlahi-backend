import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { GetDisputesDto } from './dto/get-disputes.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { User } from '../users/entities/user.entity';
import { RoleUtils } from '../common/utils/role.utils';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) { }

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

  async findOne(id: string, userId: string, userRole: string, organisationId?: string) {
    const dispute = await this.disputesRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['order', 'clinic'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    // Role-based access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });
      if (!organisationId || dispute.organisationId !== organisationId) {
        throw new ForbiddenException('You do not have access to this dispute');
      }
    } else if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to view disputes',
      );
    }

    return dispute;
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
