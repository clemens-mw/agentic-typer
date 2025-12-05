Fix type errors using:

- Strategy 1: Code is CORRECT → add type annotations
- Strategy 2B: Code has a BUG → suppress with "BUG:" marker
- Strategy 2A: Valid TS pattern TypeScript rejects → suppress with neutral explanation

## STRATEGY 1: Add Type Annotations

Add MINIMAL TypeScript type annotations to fix errors WITHOUT changing runtime behavior.

### Key Principles:

1. **Minimal annotations**: ONLY annotate what's needed to fix the specific error
2. **Inline type annotations**: For object property type mismatches, annotate ONLY the problematic property, not the entire object
3. **Fix at source**: When fixing "Expected X arguments but got Y" errors, find and annotate the function definition in its source file
4. **Fix at declaration**: When a property access error occurs (e.g., "Property 'x' does not exist"), add a type annotation at the variable declaration if feasible
5. **NO `any` types**: NEVER use `any` - infer specific types from usage context instead
6. **Use library types FIRST**: ALWAYS check if a library provides the type you need (e.g., `import('express').Request`, `import('mongodb').Document`). Use library types instead of suppressions whenever possible. Only use Strategy 2A if no library type exists.

### Common Patterns:

**Property type widening:**

```typescript
const obj = {
  timestamp: "" as string | Date, // Annotate only the problematic property
};
```

**Variable reassignment with different types:**

```typescript
let value: number | string = "a";
if (condition) {
  value = 42; // OK: number is part of union type
}
```

**Property added after initialization (fix at declaration):**

Fix Error: `Property 'status' does not exist on type '{ id: number; data: string; }'`

```typescript
interface Record {
  id: number;
  data: string;
  status?: string;
}
const record: Record = { id: 1, data: "test" };
if (condition) {
  record.status = "active"; // OK: status is optional property
}
```

**Optional parameters (fix at source):**

```typescript
function doWork(entityName: string, optionalParam?: string[]): void {
  // ...
}
```

### When to use:

- Code is CORRECT and only needs type information
- Function signatures need parameter/return type annotations
- Variables need clarifying type declarations

**CRITICAL:** Only use Strategy 1 when the code logic is correct. If there's a bug, use Strategy 2B.

## STRATEGY 2: Suppress with Comment

Use ONLY when Strategy 1 would hide bugs or truly isn't feasible:
`// @ts-expect-error <brief explanation>`

**IMPORTANT:** If you can express the actual types the code supports (even complex union types), use Strategy 1 instead. Strategy 2A is for patterns that fundamentally cannot be typed without `any`.

### Strategy 2A: Valid TypeScript Patterns

TypeScript complains but code works correctly AND cannot be typed without `any`. Use neutral technical explanation:

```typescript
// @ts-expect-error Date arithmetic
const result = new Date(date - milliseconds);

// @ts-expect-error Type coercion
if ("3" == 3) // ...
```

### Strategy 2B: Semantic Bugs (ACTUAL BUGS)

Code has a runtime bug. Use clear bug indicator:

```typescript
// @ts-expect-error BUG: 'error' is not defined, should be 'err'
LOG.error(`${inspect(error)}`);
```

**Sometimes combine with Strategy 1:**

```typescript
const handlers: RequestHandler[] = [
  // @ts-expect-error BUG: string is not a valid RequestHandler
  "/api/users",
  actualHandler,
];
```

**Bug markers:** Start with "BUG:" to alert developers.

### When to use each:

- **Strategy 2A:** Valid TS patterns TypeScript doesn't like (type coercion, duck typing, etc.)
- **Strategy 2B:** Actual bugs (undefined variables, missing imports, wrong types, logic errors)

## ABSOLUTELY FORBIDDEN:

1. DO NOT modify any code logic or runtime behavior
2. DO NOT add Number() conversions, type casts, or .map() calls
3. DO NOT rename variables or functions
4. DO NOT restructure code or change control flow
5. DO NOT add missing imports or variable declarations
6. DO NOT remove existing code (e.g., removing duplicate imports)
7. DO NOT fix bugs - only add type information or suppressions
8. DO NOT run bash commands (tsc, npm, npx, etc.) - I will verify the results myself
9. DO NOT use `any` types - always infer specific types from the code context

## CRITICAL RULES:

1. ONLY add TypeScript type annotations or @ts-expect-error comments, NEVER modify code logic
2. **ANALYZE FIRST:** Does the code work correctly?
   - Works correctly → Try Strategy 1, else Strategy 2A (neutral explanation)
   - Has a bug → Strategy 2B (start comment with "BUG:")
3. ALWAYS prefer Strategy 1 (TypeScript annotations) when it works without hiding bugs
4. When possible, fix type annotations in the SOURCE file where functions are defined
5. Keep code changes to absolute minimum (type annotations only)

## ERRORS TO FIX:
