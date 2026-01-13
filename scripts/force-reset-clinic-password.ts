import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
    console.log('resetting password...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

    const email = 'clinic1.owner@test.com';
    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
        console.error(`User ${email} not found!`);
        process.exit(1);
    }

    const newPassword = 'abc123123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.passwordHash = hashedPassword;
    await userRepo.save(user);

    console.log(`✅ Password for ${email} reset to: ${newPassword}`);
    await app.close();
}

bootstrap();
