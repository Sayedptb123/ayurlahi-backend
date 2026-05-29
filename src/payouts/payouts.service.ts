import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class PayoutsService {
  async findAll() {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  async findOne(id: string) {
    throw new NotFoundException('Payout not found');
  }
}
