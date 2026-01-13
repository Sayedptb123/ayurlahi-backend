import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { OrganisationUser } from '../src/organisation-users/entities/organisation-user.entity';
import { OrganisationUserRole } from '../src/organisation-users/entities/organisation-user.entity';

async function bootstrap() {
    console.log('Checking OrganisationLink...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const orgUserRepo = app.get<Repository<OrganisationUser>>(getRepositoryToken(OrganisationUser));

    const email = 'clinic1.owner@test.com';
    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
        console.error(`User ${email} not found!`);
        process.exit(1);
    }

    console.log(`User ID: ${user.id}`);
    console.log(`User ClinicID: ${user.clinicId}`);

    const links = await orgUserRepo.find({ where: { userId: user.id } });
    console.log(`Found ${links.length} Organisation links.`);

    if (links.length === 0) {
        console.log('❌ NO LINKS FOUND. This causes the JWT to be missing organisationId.');

        if (user.clinicId) {
            console.log('Fixing it now...');
            const newLink = orgUserRepo.create({
                userId: user.id,
                organisationId: user.clinicId,
                role: 'OWNER',
                isPrimary: true
            });
            await orgUserRepo.save(newLink);
            console.log('✅ Created missing link in organisation_users table.');
        } else {
            console.error('Cannot fix: User has no clinicId either.');
        }
    } else {
        console.log('✅ Link exists:', links);
    }

    await app.close();
}

bootstrap();
