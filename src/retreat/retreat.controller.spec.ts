import { Test, TestingModule } from '@nestjs/testing';
import { RetreatController } from './retreat.controller';

describe('RetreatController', () => {
  let controller: RetreatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetreatController],
    }).compile();

    controller = module.get<RetreatController>(RetreatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
