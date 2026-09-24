import { AssetsService } from './assets.service';
import { Expense } from '../expenses/entities/expense.entity';
import { AssetMaintenance } from './entities/asset-maintenance.entity';
import { Asset } from './entities/asset.entity';

// Cash MVP plan §6: maintenance expense, maintenance record and asset update
// must commit together; this is the transaction the voucher will post in.
describe('AssetsService.logMaintenance — one transaction', () => {
  const setup = (failOn?: unknown) => {
    const saved: unknown[] = [];
    const repoFor = (entity: unknown) => ({
      create: (x: any) => x,
      save: jest.fn((x: any) => {
        if (entity === failOn) return Promise.reject(new Error('save failed'));
        saved.push(entity);
        return Promise.resolve({ ...x, id: 'id-' + saved.length });
      }),
    });
    const manager = { getRepository: jest.fn(repoFor) };
    const assetRepository: any = {
      findOne: jest.fn(() => Promise.resolve({ id: 'as-1', assetCode: 'A1', name: 'AC', maintenanceIntervalDays: null })),
      save: jest.fn(),
      manager: { transaction: jest.fn((cb: any) => cb(manager)) },
    };
    const outside: any = { save: jest.fn(), create: (x: any) => x };
    const service = new AssetsService({} as any, assetRepository, outside, outside);
    return { service, saved, assetRepository, outside };
  };
  const dto: any = { maintenanceType: 'repair', maintenanceDate: '2026-09-24', cost: 1200, integrateExpense: true };

  it('writes expense, maintenance and asset through the transaction manager only', async () => {
    const { service, saved, assetRepository, outside } = setup();
    await service.logMaintenance('as-1', 'org-1', dto, 'u-1');
    expect(assetRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([Expense, AssetMaintenance, Asset]);
    expect(outside.save).not.toHaveBeenCalled();
    expect(assetRepository.save).not.toHaveBeenCalled();
  });

  it('propagates a failure after the expense save, so the transaction rolls back', async () => {
    const { service } = setup(AssetMaintenance);
    await expect(service.logMaintenance('as-1', 'org-1', dto, 'u-1')).rejects.toThrow('save failed');
  });
});
