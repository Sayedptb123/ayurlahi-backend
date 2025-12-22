import { Injectable } from '@nestjs/common';

@Injectable()
export class PayoutsService {
  // Payouts table doesn't exist yet
  // This is a placeholder for future implementation
  async findAll() {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  async findOne(id: string) {
    throw new Error('Payouts feature not yet implemented');
  }
}

