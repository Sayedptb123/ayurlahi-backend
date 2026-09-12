// ADR-005 Step 4 §3 — post-activation verification. Run immediately after
// flipping PMS's organisation_settings.inventory_policy shared -> per_branch.
// Proves, against real staging data, the behavior that was previously
// structurally impossible to observe (branchId was ignored on reads while
// PMS stayed 'shared'): branches now hold genuinely independent stock, and
// backend authorization enforces branch assignment for a non-org-wide role.
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { InventoryItemMaster } from '../src/inventory/entities/inventory-item-master.entity';
import { InventoryBranchStock } from '../src/inventory/entities/inventory-branch-stock.entity';
import { Branch } from '../src/branches/entities/branch.entity';
import { OrganisationSettings } from '../src/organisation-settings/entities/organisation-settings.entity';

const PMS = '30164e3d-11a1-4820-823b-d0c2ba1dd9c0';
// Real STAFF-role user, confirmed via direct query to have zero active
// staff_branch_assignments rows -- the fail-closed case.
const UNASSIGNED_STAFF_USER = '98782e45-202a-4923-b80d-73b6b5dba754';
// Real MANAGER (org-wide role, exempted from branch scoping regardless of
// assignments) -- confirms the exemption still holds under per_branch.
const MANAGER_USER = 'c07c1753-6f25-4835-a309-3532264c5c77';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const inventoryService = app.get(InventoryService);
  const branchRepo = app.get<Repository<Branch>>(getRepositoryToken(Branch));
  const masterRepo = app.get<Repository<InventoryItemMaster>>(getRepositoryToken(InventoryItemMaster));
  const stockRepo = app.get<Repository<InventoryBranchStock>>(getRepositoryToken(InventoryBranchStock));
  const settingsRepo = app.get<Repository<OrganisationSettings>>(getRepositoryToken(OrganisationSettings));

  let failures = 0;
  const check = (label: string, ok: boolean) => {
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    if (!ok) failures++;
  };

  const settings = await settingsRepo.findOne({ where: { organisationId: PMS } });
  check('PMS inventory_policy is per_branch', settings?.inventoryPolicy === 'per_branch');

  const branches = await branchRepo.find({ where: { organisationId: PMS, deletedAt: IsNull() }, order: { isPrimary: 'DESC' } });
  const primary = branches[0];
  const branchB = branches[1];
  check('PMS has 3 branches, primary first', branches.length === 3 && primary.isPrimary);
  console.log(`  primary=${primary.name} (${primary.id}), branchB=${branchB.name} (${branchB.id})`);

  console.log('\n=== Branch isolation: create at primary, confirm branchB shows 0, add stock at branchB, confirm primary unchanged ===');
  const sku = `STEP4-ACTIVATION-${Date.now()}`;
  const item = await inventoryService.create(
    PMS, { name: 'Step4 Activation Test Item (safe to delete)', sku, unit: 'unit', currentStock: 10, minStockLevel: 1, branchId: primary.id } as any,
    'test-script', 'OWNER',
  );
  const readAtPrimary = await inventoryService.findAll(PMS, { limit: 1000, branchId: primary.id }, undefined, 'OWNER');
  const primaryRow = readAtPrimary.data.find((i) => i.id === item.id);
  check('Reading at primary branch shows stock = 10', primaryRow?.currentStock === 10);

  const readAtBranchB = await inventoryService.findAll(PMS, { limit: 1000, branchId: branchB.id }, undefined, 'OWNER');
  const branchBRowBefore = readAtBranchB.data.find((i) => i.id === item.id);
  console.log('  DEBUG branchBRowBefore:', JSON.stringify(branchBRowBefore));
  const rawStockRowsBefore = await stockRepo.find({ where: { itemMasterId: item.id } });
  console.log('  DEBUG raw stock rows before update:', JSON.stringify(rawStockRowsBefore.map(r => ({ branchId: r.branchId, currentStock: r.currentStock, deletedAt: r.deletedAt }))));
  check(
    'Reading the SAME item at branchB shows stock = 0 (exists org-wide, not stocked here yet) -- the exact behavior only observable now that per_branch is active',
    branchBRowBefore?.currentStock === 0,
  );

  await inventoryService.update(PMS, item.id, { currentStock: 4, branchId: branchB.id } as any, 'test-script', 'OWNER');
  const readAtPrimaryAfter = await inventoryService.findAll(PMS, { limit: 1000, branchId: primary.id }, undefined, 'OWNER');
  const primaryRowAfter = readAtPrimaryAfter.data.find((i) => i.id === item.id);
  check('Primary branch UNCHANGED at 10 after adding stock at branchB', primaryRowAfter?.currentStock === 10);

  const readAtBranchBAfter = await inventoryService.findAll(PMS, { limit: 1000, branchId: branchB.id }, undefined, 'OWNER');
  const branchBRowAfter = readAtBranchBAfter.data.find((i) => i.id === item.id);
  check('branchB now shows its own stock = 4', branchBRowAfter?.currentStock === 4);

  const stockRows = await stockRepo.find({ where: { itemMasterId: item.id, deletedAt: IsNull() } });
  check('Exactly 2 separate inventory_branch_stock rows exist (no collision)', stockRows.length === 2);
  check(
    'The two rows are keyed to the two different real branches, no NULL branch_id',
    stockRows.every((r) => r.branchId === primary.id || r.branchId === branchB.id) && stockRows.every((r) => r.branchId !== null),
  );

  console.log('\n=== Branch-switching read behavior: no-branchId view sums across visible branches for an org-wide role ===');
  const summed = await inventoryService.findAll(PMS, { limit: 1000 }, undefined, 'OWNER');
  const summedRow = summed.data.find((i) => i.id === item.id);
  check('No-branchId (org-wide role) view sums to 14 (10 + 4)', summedRow?.currentStock === 14);

  console.log('\n=== Authorization: unassigned STAFF user (zero active branch assignments) ===');
  const unassignedRead = await inventoryService.findAll(PMS, { limit: 1000 }, UNASSIGNED_STAFF_USER, 'STAFF');
  check('Unassigned staff, no branchId: fail-closed to 0 items (not everything)', unassignedRead.pagination.total === 0 || unassignedRead.data.every((i) => i.currentStock === 0));
  try {
    await inventoryService.findAll(PMS, { limit: 1000, branchId: primary.id }, UNASSIGNED_STAFF_USER, 'STAFF');
    check('Unassigned staff requesting a specific branch is rejected (403)', false);
  } catch (e: any) {
    check('Unassigned staff requesting a specific branch is rejected (403)', e?.status === 403 || e?.response?.statusCode === 403);
  }
  try {
    await inventoryService.update(PMS, item.id, { currentStock: 99, branchId: primary.id } as any, UNASSIGNED_STAFF_USER, 'STAFF');
    check('Unassigned staff cannot write to a branch they are not assigned to (403)', false);
  } catch (e: any) {
    check('Unassigned staff cannot write to a branch they are not assigned to (403)', e?.status === 403 || e?.response?.statusCode === 403);
  }
  try {
    await inventoryService.update(PMS, item.id, { currentStock: 99 } as any, UNASSIGNED_STAFF_USER, 'STAFF');
    check('Unassigned staff writing with NO branchId is rejected (400 -- per_branch requires one)', false);
  } catch (e: any) {
    check('Unassigned staff writing with NO branchId is rejected (400 -- per_branch requires one)', e?.status === 400 || e?.response?.statusCode === 400);
  }
  // Confirm the unauthorized attempts truly did not mutate anything.
  const primaryUnchangedByAttack = await inventoryService.findAll(PMS, { limit: 1000, branchId: primary.id }, undefined, 'OWNER');
  const primaryRowFinal = primaryUnchangedByAttack.data.find((i) => i.id === item.id);
  check('Primary branch stock still 10 -- none of the rejected write attempts took effect', primaryRowFinal?.currentStock === 10);

  console.log('\n=== Authorization: MANAGER (org-wide role) still sees/writes everything under per_branch ===');
  const managerRead = await inventoryService.findAll(PMS, { limit: 1000 }, MANAGER_USER, 'MANAGER');
  const managerRow = managerRead.data.find((i) => i.id === item.id);
  check('MANAGER (org-wide role) sees the full summed stock (14) with no branchId', managerRow?.currentStock === 14);

  // cleanup
  for (const s of stockRows) await stockRepo.softDelete(s.id);
  await masterRepo.softDelete(item.id);
  console.log('\n(cleaned up synthetic activation-test item and both its branch-stock rows)');

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
