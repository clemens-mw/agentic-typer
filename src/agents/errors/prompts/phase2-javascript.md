Eliminate all `any` type errors by adding precise type annotations without changing runtime behavior.

## ⚠️ CRITICAL: Properties in Commented Code

**IF a property assignment is ONLY in commented code:**

- The property **DOES NOT EXIST** at runtime
- **NEVER** add it to typedef as optional (`prop?: Type`)
- **NEVER** add it to typedef with `any` or `unknown`
- **MUST** document in typedef: `// ⚠️ MISSING: prop - only in commented code`
- **MUST** mark access with: `// @ts-expect-error BUG: prop not set`

**Example:**

```typescript
// Code has: // obj.user = data;  (commented out)
// Typedef MUST be:
export interface MyType {
  id: number;
  // ⚠️ MISSING: user - only assigned in commented code
}
// Access MUST be:
// @ts-expect-error BUG: user not set
console.log(obj.user);
```

## Core Rules

1. **Infer most specific types** - Use literal unions (`0 | 1 | 2`, not `number`; `'start' | 'stop'`, not `string`)
2. **NO `any` types** - Use specific types or `unknown`
3. **Shared types for repeated patterns** - Type needed in 2+ files → create `.typedefs/*.ts` file
4. **Use `@type` for handler typedefs** - After creating handler typedef, use `@type {Handler}` (NOT `@param`)
5. **Minimize suppressions** - prefer fixing type annotations over `@ts-expect-error` suppressions
6. **Surface bugs with suppressions** - When type errors reveal runtime bugs, use `// @ts-expect-error BUG: <explanation>` to document the issue without changing runtime behavior

## Context

You are fixing `noImplicitAny` errors in the codebase file by file. The errors you see fall into two categories:

1. **`noImplicitAny` errors in the current file** - Parameters and variables that lack type annotations
2. **Other errors revealed by previous annotations** - When dependencies were annotated, their types may now cause issues in the current file

**CRITICAL: Fix errors at their SOURCE, not at call sites**

- **For example**: "Expected X args but got Y" → **ALWAYS go to the function DEFINITION** and make parameter optional: `@param {Type} [param]`
- **DO NOT** suppress these errors in the current file - **ALWAYS fix the source function instead**
- **NEVER** add arguments at call sites - **ALWAYS make parameters optional at the definition**

**Only suppress when fixing at source is not possible:**

- Genuine runtime bugs: `// @ts-expect-error BUG: <explanation>`
- Valid JS patterns TypeScript can't type: `// @ts-expect-error <neutral explanation>`

## Workflow

### Step 1: Analyze Current File & Check for Commented Properties

**FIRST:** Search for where properties are SET (assigned):

- Use `Grep` to find assignments to key properties
- Check if assignments are in commented code
- **If property ONLY assigned in comments → it DOES NOT EXIST**

Then infer types from usage patterns in active (uncommented) code:

- Literal unions from switch/if-else: `switch(x) { case 0: case 1: }` → `0 | 1`
- String literals from checks: tests for `'start'`, `'stop'` → `'start' | 'stop'`
- **SQL queries**: Analyze query strings to infer types:
  - SELECT columns define result object properties
  - WHERE clause parameters define input types
  - Prefer generics for query functions
  - Example: `SELECT id, name FROM users WHERE status = ?` → params `{ status: string }`, result `{ id: number, name: string }`

### Step 2: Search for Existing Types (MANDATORY)

1. **Find typedef files**: `Glob` for `.typedefs/**/*.ts`
2. **Check for duplicate types**: `Grep` for the type pattern you're about to create (e.g., literal unions like `0 | 1 | 2`)
3. **Find inline typedefs**: `Grep` for `@typedef` patterns

### Step 3: Reuse or Upgrade Types

**MANDATORY: Always MODIFY existing types instead of creating duplicates:**

- **Exact same type exists in typedef file** → Import and reuse it directly, rename or move to better location if needed
- **Same concept, different name** → RENAME the existing type to better reflect its purpose, update all imports
- **Exact literal union exists anywhere** → Extract to named type, UPDATE original location, import everywhere. NEVER redeclare the same literal union.
- **Similar type exists with fewer properties** → UPDATE the existing typedef to include the new property, then import it everywhere
- **Similar type exists with more properties** → Use the existing type if compatible, or extract common properties to a base type
- **Types share many properties (50%+ overlap)** → Extract common properties to a base type, extend in each specific type
- **Same type pattern inline in multiple places** → Extract to ONE shared typedef, DELETE all inline duplicates, update ALL files to import
- **Literal union type inline in interface** → Extract to named type, UPDATE interface to use it, then import named type elsewhere
- **Type from npm package** → Import directly in each file that needs it, NEVER create wrappers or re-exports
- **NEVER redeclare literal unions - extract once and import everywhere**
- **NEVER create new typedefs when updating existing ones is possible**

**Extraction priority when deduplicating:**

1. Check for existing typedef files and inline typedefs that can be used and updated
2. If extracting new: place following Step 5 rules
3. Update ALL files that use the pattern (including where it was originally defined)

**If no existing type:** Continue to Step 4

### Step 4: Choose Annotation Style

**CRITICAL**: Distinguish between:

- **Method/function usage** (e.g., method called in many files) - does NOT justify typedef file
- **Type import needs** (e.g., files that need the type in their JSDoc) - counts toward typedef file threshold

**Separate `.typedefs/*.ts` file ONLY when:**

- The **new type definition you're creating** would be imported (`@typedef {import(...)}`) in **2+ different files**
- **CRITICAL**: Count ONLY files that need to import the TYPE, NOT files that call a function using that type
- **Example**: `parseConfig(data)` called in 15 files → but ONLY `parseConfig.js` needs the parameter type → typedef goes INLINE in `parseConfig.js`
- **Example**: Config shape needed in `config.loader.js` AND `config.validator.js` (2 files) → separate typedef file
- **NEVER** for npm package types (import directly from package in each file that needs it - NO re-exports)
- **NEVER** for single-use callback types (define inline)

**Inline JSDoc `@typedef` (at top of file) when:**

- Type used **2+ times in same file only**
- Callback used only in current file
- Complex object shape for single function

**Inline `@param` when:**

- **Type used once** in the file
- Simple primitives
- Unique function signatures

### Step 5: Typedef Placement (if creating `.typedefs/*.ts`)

Based on directory analysis from Step 2:

- **Different directory branches** (e.g., `handlers/`, `validators/`, `services/`) → `src/.typedefs/`
- **Sibling subdirs of same parent** (e.g., `handlers/data.js`, `handlers/sync.js`) → Parent's `.typedefs/` (e.g., `src/handlers/.typedefs/`)
- **Same directory only** → That directory's `.typedefs/`
- **Check where property is SET vs USED** - If set in one module but type will be imported everywhere, place higher in hierarchy

### Step 6: Apply Annotations

- Place type imports at the VERY TOP of the file (line 1), before all `require()` statements using `@import`
- ONLY use `@import` if the type is NOT already imported via `require()` - Check existing require statements first
- Import ONLY types that are explicitly referenced in JSDoc: `/** @import { Type } from './.typedefs/file' */`
- DO NOT import types that are only used internally by other imported types (e.g., if `CallbackType` internally uses `Options`, don't import `Options` separately)
- For handler typedefs: `/** @type {Handler} */` (NOT `@param`)
- For unique signatures: `@param` and `@returns`

### Step 7: Verify and Clean Up

**MANDATORY before finishing:**

- **Every new typedef/interface MUST be imported and used** in JSDoc annotations
- **Every imported typedef MUST be actually used** in the file - check that each `@import` is referenced in at least one JSDoc annotation
- If a type is not used: DELETE it (don't leave unused definitions)
- Verify each typedef file export is imported somewhere
- If approach changed: remove old/abandoned type definitions
- If "Cannot find module './.typedefs/file' ..." error occurs: Verify the import path is correct relative to the current file location

## Handler Typedef Pattern

**When you see 3+ methods with same signature:**

Create typedef file:

```typescript
// .typedefs/callback-types.ts
export interface ProcessCallback {
  (data: DataInput, options: Options): Promise<Result>;
}
```

Use with `@type` (NOT `@param`):

```javascript
/** @import { ProcessCallback } from './.typedefs/callback-types' */

class Processor {
  /** @type {ProcessCallback} */
  methodA = async (data, options) => {};

  /** @type {ProcessCallback} */
  methodB = async (data, options) => {};
}
```

## Quick Reference

**Typedef file naming:** kebab-case (e.g., `data-types.ts`, `callback-types.ts`)

**Import format:**

- Single-line: `/** @import { Type } from '<module or ./path>' */`
- Then use: `/** @param {Type} param */` or `/** @type {Type} */`

**Class instances:**

```javascript
// Class is already imported (else use JSDoc import)
const { EmailService } = require("./email-service.js");

/** @type {EmailService} */
let emailer;
```

**Unique function signature:**

```javascript
/**
 * @param {string} input
 * @param {number} [count]
 * @returns {Promise<number>}
 */
```

**Inline typedef format:**

```javascript
/**
 * @typedef {Object} User
 * @property {string} name
 * @property {number} age
 */
```

**Base types:**

```typescript
export interface BaseConfig {
  id: string;
  enabled: boolean;
}
```

```javascript
/** @import { BaseConfig } from './.typedefs/base-config' */
/**
 * @typedef {BaseConfig & {
 *   timeout: number;
 *   retries: number;
 * }} ApiConfig
 */
```

## Absolutely Forbidden

1. **NEVER add properties from commented code to typedefs** - If `// obj.prop = x;` is commented, document as comment in typedef, NOT as property
2. **NEVER create typedef files for types that would be imported in fewer than 3 files** - Use inline `@typedef` or `@param` instead
3. **NEVER create wrapper types or re-export library types** like `export type AppType = LibraryType;` or `export type { LibraryType };` - Import package types directly where needed
4. **NEVER duplicate existing types** - Always search and reuse types from existing `.typedefs/` files (including parent directories)
5. **NEVER duplicate inline typedefs** - If ANY file already has the typedef (same name OR same type pattern or structure), you MUST extract to shared `.typedefs/*.ts` file and update ALL files to import from it. NEVER copy-paste typedef blocks between files
6. **NEVER create verbose interface definitions for single-use callbacks** - Define inline with `@typedef` in the file that needs them
7. **NEVER use `Interface['property']` syntax** - Extract inline types to named types first and update the original interface, then import the named type
8. **NEVER create interface definitions for classes** - Classes with complete type information (typed parameters, returns, properties) should be imported directly, NOT duplicated as interfaces. Only create interfaces for plain object shapes.
9. **NEVER modify code logic or runtime behavior** - Only add annotations
10. **NEVER fix runtime bugs** - only annotate with suppressions and explanations
11. **NEVER run bash commands** like `tsc` - I will verify the results myself
12. **NEVER use `any` types** - use specific types or `unknown` or `object` where necessary
13. **NEVER use `@ts-ignore`**

## Final Remarks

Take your time and think carefully.
The final goal is to create the most readable type annotations possible by typing each file by file and surface hidden bugs.

## ERRORS TO FIX:
