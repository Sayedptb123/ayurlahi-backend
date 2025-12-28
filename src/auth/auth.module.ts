import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OrganisationUser, Organisation]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ||
          'your-secret-key-change-in-production';
        console.log('[JWT Module] Registering with secret:', {
          hasSecret: !!configService.get<string>('JWT_SECRET'),
          secretLength: secret.length,
          secretPreview: secret.substring(0, 10) + '...',
        });
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
