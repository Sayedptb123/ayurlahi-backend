import { DataSource } from 'typeorm';
import { Organisation } from '../src/organisations/entities/organisation.entity';
import { User } from '../src/users/entities/user.entity';
import { Product } from '../src/products/entities/product.entity';
import { OrganisationUser } from '../src/organisation-users/entities/organisation-user.entity'; // Also clean up link table if exists
import { config } from 'dotenv';
config();

async function resetManufacturers() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'medilink',
        entities: [Organisation, User, Product, OrganisationUser],
        synchronize: false,
    });

    await dataSource.initialize();
    console.log('Database connected.');

    const orgRepo = dataSource.getRepository(Organisation);
    const userRepo = dataSource.getRepository(User);
    const productRepo = dataSource.getRepository(Product);
    // const orgUserRepo = dataSource.getRepository(OrganisationUser); // If needed

    // Target names from user request/screenshot
    // "Natural Remedies Pharma", "Ayurvedic Herbs Ltd"
    // Also including "AyurLah Pharma" just in case.
    const targetNames = ['Natural Remedies Pharma', 'Ayurvedic Herbs Ltd', 'AyurLah Pharma'];

    // We search by companyName or name (Organisation has name, and companyName)
    // In ManufacturersService, it queries 'organisations'.

    // Let's find IDs first
    for (const name of targetNames) {
        console.log(`\nSearching for: ${name}`);
        const orgs = await orgRepo.find({
            where: [
                { companyName: name, type: 'MANUFACTURER' },
                { name: name, type: 'MANUFACTURER' } // check both just in case
            ]
        });

        if (orgs.length === 0) {
            console.log(`- Not found.`);
            continue;
        }

        for (const org of orgs) {
            console.log(`Found Org: ${org.name || org.companyName} (${org.id})`);

            // 1. Delete Products
            const products = await productRepo.find({ where: { manufacturerId: org.id } });
            if (products.length > 0) {
                console.log(`- Deleting ${products.length} products...`);
                await productRepo.remove(products);
            } else {
                console.log(`- No products found.`);
            }

            // 2. Delete Users
            // Users are linked via manufacturerId column in User entity
            const users = await userRepo.find({ where: { manufacturerId: org.id } });
            if (users.length > 0) {
                console.log(`- Deleting ${users.length} users...`);
                await userRepo.remove(users);
            } else {
                console.log(`- No users found via manufacturerId.`);
            }

            // 3. Delete Organisation
            console.log(`- Deleting Organisation...`);
            await orgRepo.remove(org);
            console.log(`Done.`);
        }
    }

    console.log('\nReset complete!');
    await dataSource.destroy();
}

resetManufacturers().catch((error) => {
    console.error('Error resetting manufacturers:', error);
    process.exit(1);
});
