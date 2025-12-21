import { Exclude, Expose, Transform } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  role: string;

  @Expose()
  phone?: string;

  @Expose()
  whatsappNumber?: string;

  @Expose()
  isActive: boolean;

  @Expose()
  isEmailVerified: boolean;

  @Expose()
  @Transform(({ obj }) => {
    if (obj.clinic) {
      return {
        id: obj.clinic.id,
        name: obj.clinic.clinicName, // Map clinicName to name
      };
    }
    return null;
  })
  clinic?: { id: string; name: string } | null;

  @Expose()
  @Transform(({ obj }) => {
    if (obj.manufacturer) {
      return {
        id: obj.manufacturer.id,
        name: obj.manufacturer.companyName, // Map companyName to name
      };
    }
    return null;
  })
  manufacturer?: { id: string; name: string } | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  password: string;

  @Exclude()
  lastLoginAt?: Date;
}




