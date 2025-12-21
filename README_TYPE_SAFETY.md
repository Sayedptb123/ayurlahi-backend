# Type Safety System - Quick Start

## 🎯 What This Solves

Prevents type mismatches between backend and frontend by:
- ✅ Auto-generating API documentation (Swagger/OpenAPI)
- ✅ Generating TypeScript types from API spec
- ✅ Validating API contracts
- ✅ Ensuring frontend types match backend exactly

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Backend (Generates OpenAPI Spec)

```bash
npm run start:dev
```

This automatically:
- Starts the server
- Generates OpenAPI spec at `api-spec/openapi.json`
- Makes API docs available at `http://localhost:3000/api/docs`

### 3. Generate TypeScript Types for Frontend

```bash
npm run generate:types
```

This creates:
- `shared/types/api-types.ts` - All API types for frontend

### 4. Validate API Contract

```bash
npm run validate:api
```

Checks for:
- Missing schemas
- Type mismatches
- Validation issues

## 📚 Using Generated Types in Frontend

### Option 1: Copy Types File

```bash
# Copy generated types to frontend project
cp shared/types/api-types.ts ../frontend/src/types/api-types.ts
```

### Option 2: Use as Shared Package (Monorepo)

If using a monorepo, import directly:
```typescript
import { User, CreateUserDto } from '@ayurlahi/shared/types';
```

### Option 3: Use OpenAPI Type Generator

For more advanced setups, use `openapi-typescript-codegen`:

```bash
npx openapi-typescript-codegen --input api-spec/openapi.json --output ../frontend/src/api
```

## 🔄 Development Workflow

### When Backend Changes:

1. **Backend Developer:**
   ```bash
   # Make changes to DTOs/controllers
   # Restart server (auto-regenerates OpenAPI spec)
   npm run start:dev
   ```

2. **Frontend Developer:**
   ```bash
   # Regenerate types
   npm run generate:types
   
   # TypeScript will show errors for breaking changes
   # Fix frontend code to match new types
   ```

### When Adding New Endpoint:

1. Create DTO with validation decorators
2. Add Swagger decorators to controller
3. Restart server (auto-generates docs)
4. Frontend regenerates types
5. TypeScript ensures type safety

## 📖 Full Documentation

See [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md) for complete documentation.

## 🛠️ Available Commands

```bash
# Generate TypeScript types from OpenAPI spec
npm run generate:types

# Validate API contract
npm run validate:api

# Start dev server (auto-generates OpenAPI spec)
npm run start:dev
```

## 🔍 Accessing API Documentation

- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs-json
- **OpenAPI Spec File**: `api-spec/openapi.json`

## ✅ Benefits

1. **Type Safety**: Frontend types always match backend
2. **Auto-Documentation**: API docs always up-to-date
3. **Early Detection**: Catch mismatches during development
4. **Better DX**: IntelliSense and autocomplete work perfectly
5. **Contract Testing**: Validate API contracts automatically

## 🎓 Example

**Backend DTO:**
```typescript
export class CreateUserDto {
  @IsString()
  @MinLength(1)
  firstName: string;
}
```

**Generated Frontend Type:**
```typescript
export interface CreateUserDto {
  firstName: string; // Required, string, min length 1
}
```

**Frontend Usage:**
```typescript
import { CreateUserDto } from './types/api-types';

// TypeScript will error if firstName is missing or wrong type
const user: CreateUserDto = {
  firstName: 'John' // ✅ Valid
  // firstName: 123 // ❌ Type error
  // Missing firstName // ❌ Type error
};
```

## 🚨 Common Issues

### Types not updating?
1. Restart backend server
2. Run `npm run generate:types`
3. Restart TypeScript server in IDE

### Validation errors?
- Check DTOs have proper decorators
- Run `npm run validate:api`
- Check Swagger docs for expected format

### Missing types?
- Ensure endpoint has Swagger decorators
- Check OpenAPI spec includes the endpoint
- Regenerate types after adding decorators


