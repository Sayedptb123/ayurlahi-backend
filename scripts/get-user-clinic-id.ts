import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

    const email = 'clinic1.owner@test.com';
    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
        console.error(`User ${email} not found!`);
    } else {
        console.log(`User: ${user.firstName} ${user.lastName}`);
        console.log(`User ID: ${user.id}`);
        console.log(`Clinic ID: ${user.clinicId}`);
    }

    await app.close();
}

bootstrap();
