Eliminate all `any` type errors by adding precise type annotations without changing runtime behavior.

## Core Rules

1. **Infer most specific types** - Use literal unions (`0 | 1 | 2` not `number`; `'start' | 'stop'` not `string`)
2. **NO `any` types** - Use specific types, `unknown`, or `object` where necessary
3. **Prefer fixing types over suppressions** - For type mismatches, first try to modify existing type definitions rather than suppressing. Only use suppressions for: (1) actual runtime bugs ALWAYS need to be surfaced (`// @ts-expect-error BUG: <explanation>`), or (2) valid patterns that can't be typed without changing behavior like type coercion (`// @ts-expect-error <neutral explanation>`)
4. **Ignore commented code** - Only type based on active (uncommented) code that actually runs
5. **Leverage type inference** - Only annotate where types cannot be inferred. If a value's type is already known from context (e.g., array methods, return values), omit the annotation

## Context

You are fixing `noImplicitAny` errors file by file. Fix errors at their source (where the type is defined), not at call sites where the value is used.
Always type at the ROOT of the problem - function return types, root type definitions, and interface properties - not at downstream usages like callback parameters which should be inferred.

Use advanced TypeScript features appropriately:

- **Generics** - For reusable components that work with multiple types
- **Function overloads** - When a function has different return types based on input types
- **Conditional types** - For complex type relationships
- **keyof** - Use `keyof T` instead of `string` when accessing object properties dynamically

## Workflow

### Step 1: Infer Types from Usage

Analyze how values are used in the current file:

- **Literal unions**: Extract from switch/if-else patterns (`switch(x) { case 0: case 1: }` → `0 | 1`)
- **String literals**: Identify from checks (e.g., `'start' | 'stop'`)
- **Cross-file**: Read related files to understand type contracts

### Step 2: Search for Existing Types

Before creating any type, search the codebase:

1. `Grep` for `interface` to find relevant interface definitions
2. `Grep` for `type` to find relevant type definitions
3. `Grep` for the specific property combinations you need (e.g., if you need `{ specificPropertyA, specificPropertyB }`, grep for `specificPropertyA`)
4. Search for semantically related types that fit your need (e.g., if typing a user, search for existing User types)
5. Find where functions are called to understand expected parameter and return types from usage context
6. Read any files that might have similar types to verify they aren't duplicates

### Step 3: Reuse or Extract Types

**If exact type exists:** Import and use it directly

**If similar types exist with significant property overlap:**

1. Extract common properties to a base interface
2. Use `extends` to create specific variants
3. Move base and variants to a shared location
4. Export all types
5. Update ALL files to import and use the appropriate type
6. Delete any duplicate definitions

**If type is from npm package:** Import directly from the package

**If no existing type found after thorough search:** Create new type inline (if file-specific) or in a shared type file (if used across multiple files)

### Step 4: Apply and Verify

- Check inference first: Before replacing `: any`, check if simply removing it allows TypeScript to infer the correct type. Only add explicit annotations when inference is insufficient
- Use `import { Type } from 'module';` for all type imports
- After adding annotations, check if any previously-required annotations can now be inferred and remove them (e.g., if you type a property, callback parameters using that property no longer need annotations)
- Ensure all created types are actually used
- Delete unused type definitions

## Constraints

- **Only add type annotations** - Do not modify code logic or runtime behavior
- **No duplicate types** - ALWAYS search the entire codebase before creating any interface or type. If you find similar types with significant property overlap, consolidate them into one shared type. NEVER duplicate interfaces from one file to another (export, rename and move original interface if necessary)
- **No wrapper types** - Import package types directly, never re-export
- **No `any` or `@ts-ignore`** - Use specific types, `unknown`, or suppressions with explanations
- **No non-null assertions** - NEVER use `!` operator anywhere, including Angular `@Input()` properties. Use optional properties (`?`) or union with `undefined` instead
- **Avoid type assertions (`as`)** - Prefer fixing types at their source (function signatures, interface definitions, variable declarations) rather than casting at usage sites. Type assertions often hide bugs. Use `as` only when: (1) the type system cannot infer a narrower type that you can prove is correct, (2) working with DOM APIs or external libraries with incomplete types, or (3) after a type guard where TypeScript doesn't narrow automatically. Always try type guards or fixing the source first
- **Use `| undefined` and `| null` sparingly** - Since strict type checking is disabled, avoid adding explicit `| undefined` or `| null` unions unless absolutely necessary for documenting actual runtime behavior.
- **Error handling** - When accessing `error.message`, use `// @ts-expect-error error type is unknown` since caught errors have type `unknown`
- **Private member access in tests** - When tests access private methods or properties, add `// @ts-expect-error accessing private member for testing` instead of creating verbose type conversions
- **Avoid index signatures** - Do not use `[key: string]: unknown` or similar index signatures. Instead, define explicit properties based on actual usage patterns in the code. Use `Record<string, T>` only for genuinely dynamic key-value mappings
- **No bash commands** - Do not run `tsc` or other verification commands

## ERRORS TO FIX:
