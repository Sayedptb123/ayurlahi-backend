import { DefaultNamingStrategy } from 'typeorm';

export class CustomNamingStrategy extends DefaultNamingStrategy {
  columnName(propertyName: string, customName: string): string {
    // If customName is provided, use it as-is (respects explicit @Column({ name: '...' }))
    if (customName) {
      return customName;
    }
    // Otherwise, convert camelCase to snake_case
    return propertyName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  tableName(className: string, customName: string): string {
    // If customName is provided, use it as-is
    if (customName) {
      return customName;
    }
    // Otherwise, convert PascalCase to snake_case
    return className.replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);
  }
}

