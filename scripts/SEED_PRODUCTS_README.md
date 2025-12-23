# Seed Products Script

This script adds 12 sample Ayurveda products to the database for testing the product catalog.

## Prerequisites

1. **Manufacturer Account**: You need an approved manufacturer account in the system.
   - Email: `manufacturer@ayurlahi.com` (or update the script to use a different email)
   - The manufacturer must have `approvalStatus: 'approved'`

2. **Database**: Make sure your database is running and accessible.

## Usage

### Option 1: Using npm script (Recommended)
```bash
npm run seed:products
```

### Option 2: Using ts-node directly
```bash
npx ts-node -r tsconfig-paths/register scripts/seed-products.ts
```

## Products Added

The script will add 12 Ayurveda products:

1. **Ashwagandha Powder (100g)** - ₹450
2. **Turmeric Curcumin Capsules (60 capsules)** - ₹650
3. **Triphala Churna (200g)** - ₹350
4. **Brahmi Syrup (200ml)** - ₹550
5. **Giloy Juice (500ml)** - ₹480
6. **Aloe Vera Gel (250g)** - ₹320
7. **Neem Capsules (60 capsules)** - ₹420
8. **Amla Juice (500ml)** - ₹380
9. **Shankhpushpi Syrup (200ml)** - ₹520
10. **Mankand Thailam (100ml)** - ₹680
11. **Dashmoolarishta (450ml)** - ₹750
12. **Chyawanprash (1kg)** - ₹850

## Categories

Products are categorized as:
- Herbal Supplements
- Digestive Health
- Brain Health
- Immunity Boosters
- Skin Care
- Blood Purification
- Pain Relief
- Bone & Joint Health
- General Wellness

## What the Script Does

1. Connects to the database using NestJS AppModule
2. Looks for a manufacturer user with email `manufacturer@ayurlahi.com`
3. Verifies the manufacturer is approved
4. Creates products one by one, skipping any that already exist (by SKU)
5. Reports success/failure for each product

## Output

The script will show:
- ✅ Created products
- ⏭️ Skipped products (already exist)
- ❌ Errors (if any)
- Summary statistics

## Troubleshooting

### Error: "Manufacturer user not found"
- Create a manufacturer account first through registration or admin panel
- Update the email in the script if using a different manufacturer email

### Error: "Manufacturer is not approved"
- Approve the manufacturer through the admin panel
- Set `approvalStatus` to `'approved'` in the database

### Error: "Product with SKU already exists"
- This is normal - the script skips existing products
- To re-seed, delete existing products first or use different SKUs

## Customization

To add more products or modify existing ones:

1. Edit `scripts/seed-products.ts`
2. Add/modify entries in the `AYURVEDA_PRODUCTS` array
3. Run the script again

## Notes

- Products are created with `isActive: true` by default
- All products have GST rate of 12%
- Stock quantities are set to realistic values
- Products include detailed specifications and descriptions









