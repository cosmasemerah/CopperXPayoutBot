# Refactored Type System for Copperx Telegram Bot

This directory contains the refactored type system for the Copperx Telegram Bot. The goal is to move away from a single monolithic `types.ts` file to a more modular and domain-specific type organization.

## Directory Structure

- `/re-types/common/`: Common types shared across different domains
- `/re-types/auth/`: Authentication related types
- `/re-types/wallet/`: (To be implemented) Wallet related types
- `/re-types/transfer/`: (To be implemented) Transfer related types
- `/re-types/notification/`: (To be implemented) Notification related types

## Migration Guide

### Step 1: Identify Domain-Specific Types

Before migrating, identify which types belong to which domain. For example:

- User, AuthResponse -> auth domain
- Wallet, WalletBalance -> wallet domain
- Transfer, TransferResponse -> transfer domain

### Step 2: Create New Type Files

For each domain, create a directory with specific type files, such as:

```
src/re-types/domain/
├── index.ts       # Re-exports all types from the domain
├── specific1.ts   # Specific type definitions for the domain
└── specific2.ts   # Additional type definitions if needed
```

### Step 3: Update Imports in Service Files

Update the import statements in service files to reference the new type locations:

```typescript
// Before
import { User, AuthResponse } from "../types";

// After
import { User, AuthResponse } from "../re-types/auth";
```

### Step 4: Add Type Annotations to Function Parameters and Return Types

Ensure all functions have explicit type annotations:

```typescript
// Before
async function getSomething(id) {
  // ...
}

// After
async function getSomething(id: string): Promise<SomeType> {
  // ...
}
```

### Step 5: Eliminate 'any' Types

Replace any instances of `any` with proper type definitions:

```typescript
// Before
function handleError(error: any) {
  // ...
}

// After
import { ApiError } from "../re-types/common";

function handleError(error: ApiError) {
  // ...
}
```

## Best Practices

1. **Be Explicit**: Always provide explicit type annotations for function parameters and return types.
2. **Avoid 'any'**: Use proper type definitions instead of `any`.
3. **Use Interfaces**: Prefer interfaces over type aliases for object shapes.
4. **Follow Naming Conventions**: Use PascalCase for interfaces and enums, camelCase for variables and functions.
5. **Document Types**: Add JSDoc comments to explain the purpose of types.
6. **Keep Types Close to Their Domain**: Put types in the domain directory they belong to.

## Example Migration

Here's a quick example of migrating a type from the old system to the new one:

### Old (`types.ts`):

```typescript
export interface User {
  id: string;
  firstName: string;
  // ...other properties
}
```

### New (`re-types/auth/user.ts`):

```typescript
import { TimeStamps } from "../common";

/**
 * User interface
 */
export interface User extends TimeStamps {
  id: string;
  firstName: string;
  // ...other properties with better type annotations
}
```

Update any importing files:

```typescript
// Before
import { User } from "../types";

// After
import { User } from "../re-types/auth";
```
