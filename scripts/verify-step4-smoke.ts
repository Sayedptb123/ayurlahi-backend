// ADR-005 Step 4 — UI-smoke-substitute verification, requested before §3.
// No browser automation tool is available in this environment, so this
// exercises the real deployed service layer (NestFactory app context,
// same DB Render uses) for PMS (no login credentials available -- real
// customer, not a seed account) and a genuinely branch-less org. CNS was
// separately verified over real HTTP with real login credentials (see
// chat transcript) since its credentials are documented test data.
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { InventoryItemMaster } from '../src/inventory/entities/inventory-item-master.entity';
import { Branch } from '../src/branches/entities/branch.entity';
import { Organisation } from '../src/organisations/entities/organisation.entity';

const PMS = '30164e3d-11a1-4820-823b-d0c2ba1dd9c0';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const inventoryService = app.get(InventoryService);
  const branchRepo = app.get<Repository<Branch>>(getRepositoryToken(Branch));
  const orgRepo = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));

  let failures = 0;
  const check = (label: string, ok: boolean) => {
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    if (!ok) failures++;
  };

  console.log('\n=== SCENARIO 2: PMS (shared) -- switch between all 3 branches, inventory must stay identical ===');
  const pmsBranches = await branchRepo.find({ where: { organisationId: PMS, deletedAt: IsNull() } });
  check('PMS has 3 branches', pmsBranches.length === 3);
  const results: Array<{ branch: string; total: number; sum: number }> = [];
  for (const b of pmsBranches) {
    const r = await inventoryService.findAll(PMS, { limit: 1000, branchId: b.id }, undefined, 'OWNER');
    results.push({ branch: b.name, total: r.pagination.total, sum: r.data.reduce((s, i) => s + i.currentStock, 0) });
  }
  const noBranchResult = await inventoryService.findAll(PMS, { limit: 1000 }, undefined, 'OWNER');
  console.log('  no branchId:', noBranchResult.pagination.total, 'items, sum', noBranchResult.data.reduce((s, i) => s + i.currentStock, 0));
  results.forEach((r) => console.log(`  branchId=${r.branch}:`, r.total, 'items, sum', r.sum));
  check(
    'All 3 branch selections + no-selection return identical item count and stock sum (shared policy holds)',
    results.every((r) => r.total === noBranchResult.pagination.total)
      && results.every((r) => r.sum === noBranchResult.data.reduce((s, i) => s + i.currentStock, 0)),
  );

  const lowStockNoBranch = await inventoryService.checkLowStock(PMS, undefined, 'OWNER');
  const lowStockWithBranch = await inventoryService.checkLowStock(PMS, undefined, 'OWNER', pmsBranches[1].id);
  check('Stock Alerts identical regardless of selected branch (shared policy)', lowStockNoBranch.length === lowStockWithBranch.length);

  console.log('\n=== SCENARIO 3: genuinely branch-less organisation loads inventory without erroring ===');
  const branchless = await orgRepo
    .createQueryBuilder('o')
    .where('o.type = :t', { t: 'CLINIC' })
    .andWhere(`NOT EXISTS (SELECT 1 FROM branches b WHERE b.organisation_id = o.id AND b.deleted_at IS NULL)`)
    .limit(1)
    .getOne();
  check('Found a real branch-less org to test against', !!branchless);
  if (branchless) {
    console.log('  testing against:', branchless.name);
    try {
      const r = await inventoryService.findAll(branchless.id, { limit: 1000 }, undefined, 'OWNER');
      check('Branch-less org: findAll() does not error (branchId omitted, matches selectedBranchId=null)', true);
      console.log('  result:', r.pagination.total, 'items (expected 0 -- no inventory ever created for this org)');
      const low = await inventoryService.checkLowStock(branchless.id, undefined, 'OWNER');
      check('Branch-less org: checkLowStock() does not error', Array.isArray(low));
    } catch (e) {
      check('Branch-less org: findAll() does not error', false);
      console.error(e);
    }
  }

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
