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

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(userId: string, userRole: string, query: GetDisputesDto) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.disputesRepository
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.order', 'order')
      .leftJoinAndSelect('dispute.clinic', 'clinic')
      .where('dispute.deletedAt IS NULL');

    // Only admin and support can see all disputes
    if (!['admin', 'support'].includes(userRole)) {
      // Clinic users can only see their own disputes
      if (userRole === 'clinic') {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (user && user.clinicId) {
          queryBuilder.andWhere('dispute.clinicId = :clinicId', {
            clinicId: user.clinicId,
          });
        } else {
          return {
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          };
        }
      } else {
        throw new ForbiddenException('You do not have permission to view disputes');
      }
    }

    if (status) {
      queryBuilder.andWhere('dispute.status = :status', { status });
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('dispute.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

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

  async findOne(id: string, userId: string, userRole: string) {
    const dispute = await this.disputesRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['order', 'clinic'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    // Role-based access control
    if (userRole === 'clinic') {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || user.clinicId !== dispute.clinicId) {
        throw new ForbiddenException('You do not have access to this dispute');
      }
    } else if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to view disputes');
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
    if (!['admin', 'support'].includes(userRole)) {
      throw new ForbiddenException('You do not have permission to resolve disputes');
    }

    const dispute = await this.findOne(id, userId, userRole);

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolveDto.resolution;
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = userId;

    return this.disputesRepository.save(dispute);
  }
}





