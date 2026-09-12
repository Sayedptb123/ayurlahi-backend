// ADR-005 Step 3 — one-off acceptance-test verification. Boots the real
// Nest app context (same pattern as scripts/verify-inventory-sync.ts) and
// exercises the actual InventoryService/PurchaseOrdersService/OrdersService
// code against staging, using only synthetic, clearly-labeled test data
// (never SAIFIS/CNS/PMS's real items or orders) that is soft-deleted at
// the end of the run. Deleted from the repo after use — not a permanent
// fixture, just how this step's sign-off checklist was actually verified.
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { PurchaseOrdersService } from '../src/purchase-orders/purchase-orders.service';
import { InventoryItemMaster } from '../src/inventory/entities/inventory-item-master.entity';
import { InventoryBranchStock } from '../src/inventory/entities/inventory-branch-stock.entity';
import { StockMovement } from '../src/inventory/entities/stock-movement.entity';
import { Branch } from '../src/branches/entities/branch.entity';
import { PurchaseOrder } from '../src/purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../src/purchase-orders/entities/purchase-order-item.entity';

const SAIFIS = '0b1f670b-5fc9-4b22-bba8-2ba08b3acd16';
const CNS = '6e82bc9e-4dfb-4192-8cf8-308e0672e20d';
const PMS = '30164e3d-11a1-4820-823b-d0c2ba1dd9c0';
const CNS_SUPPLIER = '1a8d21d4-1c87-465b-9f09-ab45bb48aee7';
const CNS_OWNER_USER_ID = '6a577a38-a7bf-4834-b707-f2b3c4c1b286';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const inventoryService = app.get(InventoryService);
  const poService = app.get(PurchaseOrdersService);
  const masterRepo = app.get<Repository<InventoryItemMaster>>(getRepositoryToken(InventoryItemMaster));
  const stockRepo = app.get<Repository<InventoryBranchStock>>(getRepositoryToken(InventoryBranchStock));
  const movementRepo = app.get<Repository<StockMovement>>(getRepositoryToken(StockMovement));
  const branchRepo = app.get<Repository<Branch>>(getRepositoryToken(Branch));
  const poRepo = app.get<Repository<PurchaseOrder>>(getRepositoryToken(PurchaseOrder));
  const poItemRepo = app.get<Repository<PurchaseOrderItem>>(getRepositoryToken(PurchaseOrderItem));

  let failures = 0;
  const check = (label: string, ok: boolean) => {
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    if (!ok) failures++;
  };

  console.log('\n=== TEST 1: GET /inventory response-shape compatibility (real read path) ===');
  for (const [name, orgId] of [['SAIFIS', SAIFIS], ['CNS', CNS], ['PMS', PMS]] as const) {
    const { data, pagination } = await inventoryService.findAll(orgId, { limit: 1000 }, undefined, 'OWNER');
    const totalStock = data.reduce((s, i) => s + i.currentStock, 0);
    console.log(`${name}: pagination.total=${pagination.total} items, summed currentStock=${totalStock}`);
    // Every item still exposes the exact same flat fields the pre-cutover
    // endpoint did.
    if (data[0]) {
      const shapeOk = 'currentStock' in data[0] && 'minStockLevel' in data[0] && 'unit' in data[0] && Array.isArray(data) === true;
      check(`${name} response shape unchanged`, shapeOk);
    }
  }
  const saifisResult = await inventoryService.findAll(SAIFIS, { limit: 1000 }, undefined, 'OWNER');
  const cnsResult = await inventoryService.findAll(CNS, { limit: 1000 }, undefined, 'OWNER');
  const pmsResult = await inventoryService.findAll(PMS, { limit: 1000 }, undefined, 'OWNER');
  check('SAIFIS item count = 111 (unchanged from Step 2)', saifisResult.pagination.total === 111);
  check('SAIFIS summed stock = 1973 (unchanged)', saifisResult.data.reduce((s, i) => s + i.currentStock, 0) === 1973);
  check('CNS item count = 3 (unchanged)', cnsResult.pagination.total === 3);
  check('CNS summed stock = 605 (unchanged)', cnsResult.data.reduce((s, i) => s + i.currentStock, 0) === 605);
  check('PMS item count = 1 (unchanged)', pmsResult.pagination.total === 1);
  check('PMS summed stock = 0 (unchanged)', pmsResult.data.reduce((s, i) => s + i.currentStock, 0) === 0);

  console.log('\n=== TEST 2: shared-org write compatibility (CNS -- PMS is now per_branch as of ADR-005 Step 4 §3, 2026-09-12, so it no longer represents this case; repointed to keep this test meaningful) ===');
  const created = await inventoryService.create(
    CNS,
    { name: 'Step3 Verify Item (safe to delete)', unit: 'unit', currentStock: 3, minStockLevel: 1 } as any,
    CNS_OWNER_USER_ID, 'OWNER',
  );
  check('CNS create() succeeds with NO branchId sent (matches a shared org\'s live InventoryScreen)', created.currentStock === 3);
  const updated = await inventoryService.update(CNS, created.id, { currentStock: 7 } as any, CNS_OWNER_USER_ID, 'OWNER');
  check('CNS update() succeeds with NO branchId sent, absolute currentStock applied', updated.currentStock === 7);
  const movement = await movementRepo.findOne({
    where: { organisationId: CNS, movementType: 'manual_adjustment' },
    order: { createdAt: 'DESC' },
  });
  check('manual_adjustment movement recorded with inventoryItemId=NULL, inventoryBranchStockId set',
    !!movement && movement.inventoryItemId === null && !!movement.inventoryBranchStockId);
  await inventoryService.remove(CNS, created.id, CNS_OWNER_USER_ID, 'OWNER');
  const afterRemove = await masterRepo.findOne({ where: { id: created.id } });
  check('remove() soft-deleted the test item (findOne excludes soft-deleted by default)', afterRemove === null);

  console.log('\n=== TEST 3: legacy-order branch fallback marker (order.branchId=NULL, multi-branch org) ===');
  const primary = await branchRepo.findOne({ where: { organisationId: PMS, isPrimary: true, deletedAt: IsNull() } });
  check('PMS has a primary branch to fall back to', !!primary);
  const testSku = `STEP3-FALLBACK-${Date.now()}`;
  await inventoryService.addStock(PMS, primary!.id, [{
    sku: testSku,
    name: 'Step3 Fallback Test Item (safe to delete)',
    quantity: 5,
    unitPrice: 1,
    orderId: null,
    movementNote: 'branch_fallback:legacy_order_no_branch_id',
  }]);
  const fallbackMaster = await masterRepo.findOne({ where: { organisationId: PMS, sku: testSku } });
  const fallbackStock = await stockRepo.findOne({ where: { itemMasterId: fallbackMaster!.id, branchId: primary!.id } });
  check('Stock landed on PMS primary branch', !!fallbackStock && fallbackStock.currentStock === 5);
  const taggedMovement = await movementRepo.findOne({
    where: { inventoryBranchStockId: fallbackStock!.id, note: 'branch_fallback:legacy_order_no_branch_id' },
  });
  check('Fallback movement is queryable by its exact fixed note value', !!taggedMovement);
  await stockRepo.softDelete(fallbackStock!.id);
  await masterRepo.softDelete(fallbackMaster!.id);
  if (taggedMovement) await movementRepo.softDelete(taggedMovement.id);
  console.log('(cleaned up TEST 3 synthetic item/stock/movement)');

  console.log('\n=== TEST 3b: editing a REAL pre-existing item on a non-per-branch org must NOT create a duplicate branch-stock row (SAIFIS -- PMS is now per_branch, no longer eligible for this test) ===');
  // The exact bug found auditing for Step 4 (a2fb655): resolveBranchIdForWrite
  // used to return NULL unconditionally for a non-per-branch org, but
  // SAIFIS/CNS's real pre-existing rows carry their real primary branch's
  // UUID (from the Step 2 backfill), not NULL. Editing a real item (not a
  // freshly-created synthetic one) is the only way to catch this -- a
  // synthetic item's first stock row is created fresh under whatever
  // branchId gets resolved, so it never collides.
  const saifisRealItem = await masterRepo.findOne({ where: { organisationId: SAIFIS, deletedAt: IsNull() } });
  check('SAIFIS has a real pre-existing item to test against', !!saifisRealItem);
  const beforeRowCount = await stockRepo.count({ where: { itemMasterId: saifisRealItem!.id, deletedAt: IsNull() } });
  const realStockBefore = await stockRepo.findOne({ where: { itemMasterId: saifisRealItem!.id, deletedAt: IsNull() } });
  const originalStock = realStockBefore!.currentStock;
  await inventoryService.update(SAIFIS, saifisRealItem!.id, { currentStock: originalStock + 1 } as any, 'test-script', 'OWNER');
  const afterRowCount = await stockRepo.count({ where: { itemMasterId: saifisRealItem!.id, deletedAt: IsNull() } });
  check('No duplicate branch-stock row created (row count unchanged)', afterRowCount === beforeRowCount);
  const realStockAfter = await stockRepo.findOne({ where: { itemMasterId: saifisRealItem!.id, deletedAt: IsNull() } });
  check('The REAL row (with its real branch_id) was the one updated', realStockAfter!.branchId === realStockBefore!.branchId && realStockAfter!.currentStock === originalStock + 1);
  // restore exactly as it was
  await inventoryService.update(SAIFIS, saifisRealItem!.id, { currentStock: originalStock } as any, 'test-script', 'OWNER');
  const restored = await stockRepo.findOne({ where: { itemMasterId: saifisRealItem!.id, deletedAt: IsNull() } });
  check('Restored to original stock value with still no duplicate row', restored!.currentStock === originalStock && (await stockRepo.count({ where: { itemMasterId: saifisRealItem!.id, deletedAt: IsNull() } })) === beforeRowCount);

  console.log('\n=== TEST 4: PurchaseOrdersService.receivePurchaseOrder() via item_master_id (CNS, synthetic) ===');
  const testMaster2 = await masterRepo.save(masterRepo.create({
    organisationId: CNS,
    name: 'Step3 PO Verify Item (safe to delete)',
    sku: `STEP3-PO-${Date.now()}`,
    unit: 'unit',
    isActive: true,
  }));
  const po = await poService.create(
    CNS,
    {
      supplierId: CNS_SUPPLIER,
      poNumber: `PO-STEP3-VERIFY-${Date.now()}`,
      items: [{ itemMasterId: testMaster2.id, itemName: testMaster2.name, quantity: 10, unitPrice: 2 } as any],
    } as any,
    CNS_OWNER_USER_ID, 'OWNER',
  );
  const cnsPrimary = await branchRepo.findOne({ where: { organisationId: CNS, isPrimary: true, deletedAt: IsNull() } });
  // Post-fix expectation: CNS is shared but already has a real primary
  // branch, and its existing stock rows already carry that branch's real
  // UUID (Step 2 backfill) -- resolveBranchIdForWrite must match that,
  // not return null, or a new PO's receipt would create a phantom
  // duplicate row instead of landing on the same branch as CNS's real
  // existing stock.
  check('PO created with branchId resolved to CNS\'s real primary branch (not null)', po.branchId === cnsPrimary!.id);
  await poService.update(CNS, po.id, { status: 'received' } as any);
  const receivedStock = await stockRepo.findOne({ where: { itemMasterId: testMaster2.id, branchId: cnsPrimary!.id } });
  check('receivePurchaseOrder() created branch-stock row via item_master_id, on CNS\'s real branch', !!receivedStock && receivedStock.currentStock === 10);
  const poMovement = await movementRepo.findOne({
    where: { referenceType: 'purchase_order', referenceId: po.id },
  });
  check('purchase_receipt movement recorded with inventoryBranchStockId set', !!poMovement && !!poMovement.inventoryBranchStockId);
  // cleanup
  await poItemRepo.delete({ purchaseOrderId: po.id });
  await poRepo.delete(po.id);
  if (receivedStock) await stockRepo.softDelete(receivedStock.id);
  await masterRepo.softDelete(testMaster2.id);
  if (poMovement) await movementRepo.softDelete(poMovement.id);
  console.log('(cleaned up TEST 4 synthetic PO/item/stock/movement)');

  console.log('\n=== TEST 5: read-side branchId must be IGNORED for a non-per-branch org (CNS -- PMS is now per_branch, no longer usable for this case) ===');
  // ADR-005 Step 4 found this originally against PMS while it was still
  // 'shared' with 3 real branches: the global branch switcher's
  // selectedBranchId is never null for an org with real branches, even
  // one still on inventory_policy='shared'. If a caller sends that
  // branchId on a read and the service filters strictly by it, switching
  // branches would make Inventory/Stock Alerts show EMPTY for a 'shared'
  // org. Fixed: a non-per-branch org ignores a requested branchId on
  // reads entirely. PMS flipped to per_branch on 2026-09-12 (Step 4 §3)
  // and only has 1 branch of its own to test with here, so this repoints
  // to CNS -- still genuinely 'shared', with its own real branch id --
  // and checks that querying with vs. without CNS's own branchId returns
  // identical results (a weaker shape than the original non-primary-branch
  // check, since CNS has only one branch, but exercises the same
  // isPerBranch-gated code path).
  const cnsOwnBranch = await branchRepo.findOne({ where: { organisationId: CNS, isPrimary: true, deletedAt: IsNull() } });
  check('CNS has a branch to test against', !!cnsOwnBranch);
  const readTestSku = `STEP4-READFIX-${Date.now()}`;
  const readTestItem = await inventoryService.create(
    CNS, { name: 'Step4 Read-Fix Test Item (safe to delete)', sku: readTestSku, unit: 'unit', currentStock: 7, minStockLevel: 1 } as any,
    CNS_OWNER_USER_ID, 'OWNER',
  );
  const resultWithBranchId = await inventoryService.findAll(
    CNS, { limit: 1000, branchId: cnsOwnBranch!.id }, undefined, 'OWNER',
  );
  const readTestItemInResult = resultWithBranchId.data.find((i) => i.id === readTestItem.id);
  check(
    'CNS (shared) read with a branchId still returns the item\'s real stock (7), not 0 -- branchId is cosmetic for a shared org',
    !!readTestItemInResult && readTestItemInResult.currentStock === 7,
  );
  await inventoryService.remove(CNS, readTestItem.id, CNS_OWNER_USER_ID, 'OWNER');
  console.log('(cleaned up TEST 5 synthetic item)');

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
