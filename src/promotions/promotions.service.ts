import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './entities/promotion.entity';
import { PromotionEvent, PromotionEventType } from './entities/promotion-event.entity';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
    @InjectRepository(PromotionEvent)
    private readonly promotionEventRepository: Repository<PromotionEvent>,
  ) {}

  async createPromotion(createPromotionDto: CreatePromotionDto, userId: string) {
    const images = createPromotionDto.images?.filter((u) => u && u.trim());
    const promotion = this.promotionRepository.create({
      ...createPromotionDto,
      images: images && images.length ? images : null,
      // keep single imageUrl in sync (first image) for older clients
      imageUrl: createPromotionDto.imageUrl ?? images?.[0],
      createdBy: { id: userId },
    });
    return this.promotionRepository.save(promotion);
  }

  /** Admin: every promotion (active + inactive), newest first. */
  async findAll() {
    return this.promotionRepository.find({ order: { createdAt: 'DESC' } });
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    const promotion = await this.promotionRepository.findOne({ where: { id } });
    if (!promotion) throw new NotFoundException(`Promotion ${id} not found`);
    Object.assign(promotion, dto);
    if (dto.images) {
      const imgs = dto.images.filter((u) => u && u.trim());
      promotion.images = imgs.length ? imgs : null;
      promotion.imageUrl = imgs[0] ?? promotion.imageUrl;
    }
    return this.promotionRepository.save(promotion);
  }

  async removePromotion(id: string) {
    const promotion = await this.promotionRepository.findOne({ where: { id } });
    if (!promotion) throw new NotFoundException(`Promotion ${id} not found`);
    await this.promotionRepository.softDelete(id);
    return { success: true };
  }

  /**
   * Client fetch — only active, in-schedule, placement-matching promos, then
   * filtered by targeting against the requesting org (Phase 19 fix). Targeting
   * convention: targeting_criteria = { audience?: 'all'|'clinics'|'manufacturers',
   * orgIds?: string[] }. No criteria = shown to everyone.
   */
  async getActivePromotions(
    placement?: string,
    orgType?: string,
    organisationId?: string,
  ) {
    const query = this.promotionRepository.createQueryBuilder('promotion')
      .where('promotion.isActive = :isActive', { isActive: true })
      .andWhere('promotion.startsAt <= :now', { now: new Date() })
      .andWhere('(promotion.endsAt IS NULL OR promotion.endsAt >= :now)', { now: new Date() })
      .orderBy('promotion.priority', 'DESC');

    if (placement) {
      query.andWhere('promotion.placement IN (:placement, :both)', { placement, both: 'BOTH' });
    }

    const promos = await query.getMany();

    // Targeting filter (in app — jsonb criteria).
    const audienceForOrg =
      orgType === 'CLINIC' ? 'clinics' : orgType === 'MANUFACTURER' ? 'manufacturers' : null;
    return promos.filter((p) => {
      const t = p.targetingCriteria;
      if (!t || Object.keys(t).length === 0) return true; // untargeted → all
      if (Array.isArray(t.orgIds) && t.orgIds.length > 0) {
        return organisationId ? t.orgIds.includes(organisationId) : false;
      }
      if (t.audience && t.audience !== 'all') {
        return t.audience === audienceForOrg;
      }
      return true;
    });
  }

  async recordEvent(promotionId: string, userId: string, organisationId: string, eventType: PromotionEventType) {
    const event = this.promotionEventRepository.create({
      promotion: { id: promotionId },
      user: { id: userId },
      organisation: organisationId ? { id: organisationId } : undefined,
      eventType,
    });
    return this.promotionEventRepository.save(event);
  }
}
