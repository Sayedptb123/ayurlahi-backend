# Setup Type Safety System

## 📦 Installation

First, install the required dependencies:

```bash
npm install
```

This will install `@nestjs/swagger` and other dependencies needed for the type safety system.

## ✅ What's Been Set Up

### 1. **OpenAPI/Swagger Integration**
   - Auto-generates API documentation from controllers
   - Available at: `http://localhost:3000/api/docs`
   - Exports OpenAPI spec to `api-spec/openapi.json`

### 2. **Type Generation Scripts**
   - `scripts/generate-types.js` - Generates TypeScript types from OpenAPI spec
   - `scripts/validate-api-contract.js` - Validates API contracts

### 3. **Documentation**
   - `TYPE_SAFETY_GUIDE.md` - Complete guide
   - `README_TYPE_SAFETY.md` - Quick start guide

## 🚀 Next Steps

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start Backend

```bash
npm run start:dev
```

This will:
- Start the server
- Generate OpenAPI spec automatically
- Make docs available at `http://localhost:3000/api/docs`

### Step 3: Generate Types

In a new terminal:

```bash
npm run generate:types
```

This creates `shared/types/api-types.ts` with all API types.

### Step 4: Use in Frontend

Copy the generated types to your frontend project:

```bash
# Option 1: Copy file
cp shared/types/api-types.ts ../frontend/src/types/api-types.ts

# Option 2: Use in monorepo
# Import directly from shared/types
```

## 📋 Available Commands

```bash
# Generate TypeScript types from OpenAPI spec
npm run generate:types

# Validate API contract
npm run validate:api

# Start dev server (auto-generates OpenAPI spec)
npm run start:dev
```

## 🎯 How It Prevents Mismatches

1. **Single Source of Truth**: OpenAPI spec is generated from backend code
2. **Type Generation**: Frontend types are generated from the same spec
3. **Validation**: Contract validation catches issues early
4. **Documentation**: Always up-to-date API docs

## 🔄 Development Workflow

### When Backend Changes:
1. Backend developer updates DTOs/controllers
2. Server restarts (auto-regenerates OpenAPI spec)
3. Frontend developer runs `npm run generate:types`
4. TypeScript shows errors for breaking changes
5. Frontend code is updated to match

### When Adding New Endpoint:
1. Create DTO with validation decorators
2. Add Swagger decorators (`@ApiTags`, `@ApiOperation`, etc.)
3. Restart server
4. Frontend regenerates types
5. TypeScript ensures type safety

## 📚 Documentation

- **Quick Start**: See `README_TYPE_SAFETY.md`
- **Complete Guide**: See `TYPE_SAFETY_GUIDE.md`
- **API Docs**: http://localhost:3000/api/docs (after starting server)

## ✨ Benefits

✅ **Type Safety** - Frontend types always match backend  
✅ **Auto-Documentation** - API docs always up-to-date  
✅ **Early Detection** - Catch mismatches during development  
✅ **Better DX** - IntelliSense and autocomplete work perfectly  
✅ **Contract Testing** - Validate API contracts automatically  

## 🎓 Example

**Backend:**
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

const user: CreateUserDto = {
  firstName: 'John' // ✅ TypeScript validates this
};
```

## 🚨 Troubleshooting

### Build Errors?
```bash
npm install
npm run build
```

### Types Not Generating?
1. Make sure server is running
2. Check `api-spec/openapi.json` exists
3. Run `npm run generate:types`

### Missing Swagger Decorators?
Add to controllers:
```typescript
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Get all users' })
  @Get()
  findAll() { ... }
}
```


