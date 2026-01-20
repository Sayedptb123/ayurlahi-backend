import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Organisation } from '../src/organisations/entities/organisation.entity';
import { OrganisationUser } from '../src/organisation-users/entities/organisation-user.entity';
import { config } from 'dotenv';
config();

async function inspectUser() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'medilink',
        entities: [User, Organisation, OrganisationUser],
        synchronize: false,
    });

    await dataSource.initialize();
    console.log('Database connected.');

    const userRepo = dataSource.getRepository(User);
    const orgRepo = dataSource.getRepository(Organisation);

    console.log('Searching for user: pms@pms.com');
    const user = await userRepo.findOne({
        where: { email: 'pms@pms.com' }
    });

    if (!user) {
        console.log('User NOT found!');
    } else {
        console.log('User found:', JSON.stringify(user, null, 2));

        if (user.manufacturerId) {
            const org = await orgRepo.findOne({ where: { id: user.manufacturerId } });
            console.log('Linked Manufacturer:', JSON.stringify(org, null, 2));
        } else if (user.clinicId) {
            const org = await orgRepo.findOne({ where: { id: user.clinicId } });
            console.log('Linked Clinic:', JSON.stringify(org, null, 2));
        } else {
            console.log('No Manufacturer/Clinic ID linked.');
        }
    }

    await dataSource.destroy();
}

inspectUser().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
