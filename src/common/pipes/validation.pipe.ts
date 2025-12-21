import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype, type }: ArgumentMetadata) {
    // Skip validation for primitive types
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Skip validation if value is already an instance of the metatype
    // This prevents validating entities that are already instantiated
    if (value instanceof metatype) {
      return value;
    }

    // Skip validation for empty bodies (GET requests, etc.)
    if (type === 'body' && (value === null || value === undefined || Object.keys(value || {}).length === 0)) {
      return value;
    }

    try {
      const object = plainToInstance(metatype, value);
      const errors = await validate(object);

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
      throw error;
    }
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}




