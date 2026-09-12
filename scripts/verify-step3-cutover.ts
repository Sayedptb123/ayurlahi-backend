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

  console.log('\n=== TEST 2: PMS write compatibility while deliberately still on inventory_policy=shared ===');
  const created = await inventoryService.create(
    PMS,
    { name: 'Step3 Verify Item (safe to delete)', unit: 'unit', currentStock: 3, minStockLevel: 1 } as any,
    'test-script', 'OWNER',
  );
  check('PMS create() succeeds with NO branchId sent (matches live InventoryScreen)', created.currentStock === 3);
  const updated = await inventoryService.update(PMS, created.id, { currentStock: 7 } as any, 'test-script', 'OWNER');
  check('PMS update() succeeds with NO branchId sent, absolute currentStock applied', updated.currentStock === 7);
  const movement = await movementRepo.findOne({
    where: { organisationId: PMS, movementType: 'manual_adjustment' },
    order: { createdAt: 'DESC' },
  });
  check('manual_adjustment movement recorded with inventoryItemId=NULL, inventoryBranchStockId set',
    !!movement && movement.inventoryItemId === null && !!movement.inventoryBranchStockId);
  await inventoryService.remove(PMS, created.id, 'test-script', 'OWNER');
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
  check('PO created with branchId resolved (CNS is shared/1-branch -> null expected)', po.branchId === null);
  await poService.update(CNS, po.id, { status: 'received' } as any);
  const receivedStock = await stockRepo.findOne({ where: { itemMasterId: testMaster2.id, branchId: IsNull() } });
  check('receivePurchaseOrder() created branch-stock row via item_master_id', !!receivedStock && receivedStock.currentStock === 10);
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

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
