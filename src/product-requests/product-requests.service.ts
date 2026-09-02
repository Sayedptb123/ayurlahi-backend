import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ProductRequest, ProductRequestStatus } from './entities/product-request.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';
import { GetProductRequestsDto } from './dto/get-product-requests.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RoleUtils } from '../common/utils/role.utils';

const AYURLAHI_TEAM_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class ProductRequestsService {
  constructor(
    @InjectRepository(ProductRequest)
    private productRequestsRepository: Repository<ProductRequest>,
    @InjectRepository(OrganisationUser)
    private orgUserRepository: Repository<OrganisationUser>,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    organisationId: string,
    organisationType: string,
    dto: CreateProductRequestDto,
  ) {
    if (organisationType !== 'CLINIC') {
      throw new ForbiddenException('Only clinics can request products');
    }

    const request = this.productRequestsRepository.create({
      organisationId,
      requestedBy: userId,
      productName: dto.productName,
      manufacturerHint: dto.manufacturerHint || null,
      notes: dto.notes || null,
      status: ProductRequestStatus.PENDING,
    });
    const saved = await this.productRequestsRepository.save(request);

    // Notify Ayurlahi ops — same recipient list orders.service.ts uses for
    // "New Order to Fulfill", since this is the same kind of ops-attention item.
    this.orgUserRepository
      .find({
        where: {
          organisationId: AYURLAHI_TEAM_ORG_ID,
          role: In(['FIELD_STAFF', 'TEAM_LEAD', 'SUPPORT']),
          isActive: true,
        },
      })
      .then((orgUsers) => {
        const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
        if (userIds.length > 0) {
          this.notificationsService
            .sendToUsers({
              userIds,
              title: 'New Product Request',
              body: `${dto.productName}${dto.manufacturerHint ? ` (maybe from ${dto.manufacturerHint})` : ''}`,
              data: { productRequestId: saved.id, type: 'product_request_created' },
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    return saved;
  }

  async findAll(
    userId: string,
    userRole: string,
    organisationId: string | undefined,
    organisationType: string | undefined,
    query: GetProductRequestsDto,
  ) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRequestsRepository
      .createQueryBuilder('pr')
      .where('pr.deletedAt IS NULL');

    if (organisationType === 'CLINIC') {
      if (!organisationId) {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      queryBuilder.andWhere('pr.organisationId = :orgId', { orgId: organisationId });
    } else if (organisationType !== 'AYURLAHI_TEAM') {
      // Manufacturers have no stake in these yet.
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    if (status) {
      queryBuilder.andWhere('pr.status = :status', { status });
    }

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit).orderBy('pr.createdAt', 'DESC');
    const data = await queryBuilder.getMany();

    // Attach the requesting org's name for display — cheap single query,
    // avoids a per-row lookup on the frontend.
    const orgIds = [...new Set(data.map((r) => r.organisationId))];
    let orgNames = new Map<string, string>();
    if (orgIds.length > 0) {
      const rows = await this.productRequestsRepository.manager
        .getRepository('organisations')
        .createQueryBuilder('o')
        .select(['o.id', 'o.name'])
        .where('o.id IN (:...ids)', { ids: orgIds })
        .getMany();
      orgNames = new Map(rows.map((r: any) => [r.id, r.name]));
    }

    return {
      data: data.map((r) => ({ ...r, organisationName: orgNames.get(r.organisationId) ?? null })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(id: string, userId: string, userRole: string, dto: UpdateProductRequestStatusDto) {
    if (!RoleUtils.isAdminOrSupport(userRole)) {
      throw new ForbiddenException('Only Ayurlahi admin/support can resolve product requests');
    }

    const request = await this.productRequestsRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!request) {
      throw new NotFoundException(`Product request with ID ${id} not found`);
    }

    request.status = dto.status;
    request.resolutionNotes = dto.resolutionNotes || null;
    if (dto.status === ProductRequestStatus.FULFILLED || dto.status === ProductRequestStatus.DECLINED) {
      request.resolvedBy = userId;
      request.resolvedAt = new Date();
    }
    const saved = await this.productRequestsRepository.save(request);

    if (dto.status === ProductRequestStatus.FULFILLED || dto.status === ProductRequestStatus.DECLINED) {
      this.orgUserRepository
        .find({
          where: {
            organisationId: request.organisationId,
            role: In(['OWNER', 'MANAGER']),
            isActive: true,
          },
        })
        .then((orgUsers) => {
          const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
          if (userIds.length > 0) {
            const resolved = dto.status === ProductRequestStatus.FULFILLED ? 'added' : "couldn't be added";
            this.notificationsService
              .sendToUsers({
                userIds,
                title: 'Product Request Update',
                body: `${request.productName} ${resolved}${dto.resolutionNotes ? ` — ${dto.resolutionNotes}` : ''}`,
                data: { productRequestId: saved.id, type: 'product_request_resolved' },
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    return saved;
  }
}
