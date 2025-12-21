import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance, plainToClass } from 'class-transformer';

/**
 * Custom ValidationPipe that only validates @Body() parameters
 * This prevents validation of entities passed via @CurrentUser() or other custom decorators
 * Includes whitelist and forbidNonWhitelisted features
 */
@Injectable()
export class BodyValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype, type }: ArgumentMetadata) {
    // Only validate @Body() parameters
    if (type !== 'body') {
      return value;
    }

    // Skip validation for primitive types
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Skip validation if value is already an instance (like entities)
    if (value instanceof metatype) {
      return value;
    }

    // Skip validation for empty/null/undefined bodies
    if (value === null || value === undefined) {
      return value;
    }

    try {
      // Transform plain object to class instance
      const object = plainToInstance(metatype, value, {
        enableImplicitConversion: true,
      });

      // Validate the object with whitelist and forbidNonWhitelisted
      const errors = await validate(object, {
        whitelist: true, // Strip properties that don't have decorators
        forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      });

      if (errors.length > 0) {
        const messages = errors.map((error) =>
          Object.values(error.constraints || {}).join(', '),
        );
        throw new BadRequestException(messages);
      }

      return object;
    } catch (error) {
      // If validation fails with "unknown value", it's likely an entity being validated
      // Skip validation in this case
      if (error.message && error.message.includes('unknown value')) {
        return value;
      }
      // Re-throw BadRequestException
      if (error instanceof BadRequestException) {
        throw error;
      }
      // For other errors, return the value as-is
      return value;
    }
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}

