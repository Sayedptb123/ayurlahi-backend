import { DefaultNamingStrategy } from 'typeorm';

export class CustomNamingStrategy extends DefaultNamingStrategy {
  columnName(propertyName: string, customName: string): string {
    // Always use customName if provided, otherwise use propertyName as-is
    return customName || propertyName;
  }
}

