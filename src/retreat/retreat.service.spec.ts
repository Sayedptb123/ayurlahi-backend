import { Test, TestingModule } from '@nestjs/testing';
import { RetreatService } from './retreat.service';

describe('RetreatService', () => {
  let service: RetreatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetreatService],
    }).compile();

    service = module.get<RetreatService>(RetreatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
