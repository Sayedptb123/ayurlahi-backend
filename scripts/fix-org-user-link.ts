import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { OrganisationUser } from '../src/organisation-users/entities/organisation-user.entity';

async function bootstrap() {
    console.log('Fixing OrganisationLink...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const orgUserRepo = app.get<Repository<OrganisationUser>>(getRepositoryToken(OrganisationUser));

    const email = 'clinic1.owner@test.com';
    const user = await userRepo.findOne({ where: { email } });

    if (!user || !user.clinicId) {
        console.error(`User ${email} or clinicId not found!`);
        process.exit(1);
    }

    console.log(`User ID: ${user.id}`);
    console.log(`Target ClinicID (from User entity): ${user.clinicId}`);

    const links = await orgUserRepo.find({ where: { userId: user.id } });

    const existingForTarget = await orgUserRepo.find({ where: { organisationId: user.clinicId } });
    console.log(`Target Org (${user.clinicId}) already has ${existingForTarget.length} users linked.`);

    for (const ex of existingForTarget) {
        console.log(` - UserID: ${ex.userId}, Role: ${ex.role}, Primary: ${ex.isPrimary}`);
    }

    if (links.length > 0) {
        // Just delete the old link for this user to avoid complexity ??? 
        // Or update it carefully.
        const link = links[0];
        if (link.organisationId !== user.clinicId) {
            console.log(`User is currently linked to WRONG Org ${link.organisationId}. Deleting this link...`);
            await orgUserRepo.remove(link);
            console.log('Deleted wrong link.');
        }
    }

    // Now try to create the new link
    const newLink = orgUserRepo.create({
        userId: user.id,
        organisationId: user.clinicId,
        role: 'OWNER',
        isPrimary: false // Set to false to avoid unique constraint if another exists
    });

    // Check if we need to force primary
    const hasPrimary = existingForTarget.some(l => l.isPrimary);
    if (!hasPrimary) {
        newLink.isPrimary = true;
    }

    await orgUserRepo.save(newLink);
    console.log(`✅ Created/Updated link to correct Org. Primary: ${newLink.isPrimary}`);

    await app.close();
}

bootstrap();
