# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Claude Code should update this **living document** proactively with new insights.
The scope of this file should not exceed 200 lines.

## Project Overview

**Agentic Typer** is a LLM-based agentic system for automatically adding type annotations to legacy JavaScript and TypeScript codebases.
It uses the [Claude Code TypeScript SDK](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript) to make code changes.
It is a master-thesis prototype to validate the approach.
However, it may be adopted by the company afterwards.

## Architecture Principles

- **Progressive type coverage**: Phased approach for incremental type annotation from zero errors to complete coverage
- **Zero errors first**: Phase 1 eliminates all type errors to establish a clean baseline
- **No "any" target**: Phase 2 eliminates all implicit "any" types where possible
- **Error transparency**: Semantic bugs are annotated with suppressions and explanations, remaining visible for developer awareness
- **AI-driven inference**: Use LLM-based type inference with validation
- **Validation**: Include validation capabilities
- **Project-level analysis**: Support cross-file type inference

## Phase Progression

### Phase 0: Project Analysis

- Detect the primary programming language used in the project (JavaScript or TypeScript)
- Detect the Node.js version from configuration files
- Supported languages: JavaScript, TypeScript
- Save detected information to the work directory

### Phase 1: Type Checking Setup & Zero Errors Baseline

- Add type checking configuration if missing
- Fix ALL type errors using one of two strategies:
  - Add proper type annotations where straightforward
  - Suppress with explanation (e.g., `@ts-expect-error`) for semantic bugs requiring behavior changes
- Goal: Achieve zero type errors to establish a clean baseline

### Phase 2: Complete Type Coverage (No "any")

- Replace all implicit and explicit "any" with specific types using AI inference
- Infer types from usage patterns and propagate through call chains
- Handle complex patterns, generics, and third-party integrations
- Replace suppressions with proper type annotations where possible
- Continue surfacing semantic errors through annotated suppressions
- Target zero "any" types where possible

## Technology Stack

**Implementation Language**: TypeScript (Node.js 24+ with native TypeScript support)

**Key Dependencies**:

- Claude Code TypeScript SDK for prompt execution
- TypeScript Compiler API for AST parsing and type analysis
- Node.js ecosystem for file system operations

**Development Environment**:

- ESM modules (`"type": "module"`)
- Pre-commit hooks via Husky (ESLint, Prettier, TypeScript checks)
- Direct TypeScript execution using `node`

## Development Setup

### Quick Start

```bash
npm install         # Install dependencies
npm test            # Run all quality checks (ESLint, Prettier, TypeScript)
npm start           # Execute main application
```

### Available Scripts

- `npm start` - Execute main application using Node.js
- `npm test` - Run ESLint, Prettier, and TypeScript checks
- `npm run eslint` / `npm run eslint:fix` - Lint checks and auto-fixes
- `npm run prettier:check` / `npm run prettier:write` - Format checks and auto-formatting
- `npm run tsc` - TypeScript type checking

### Implementation Structure

```
src/
├── main.ts                 # CLI entrypoint and phase execution orchestrator
├── agents/                 # Agent components
├── phases/                 # Progressive type annotation phases
└── utils/                  # Shared utility functions
```

## Implementation Guidelines

### Core Requirements

1. **Zero errors baseline**: Phase 1 achieves zero type errors before further refinement
2. **Error visibility**: Semantic errors always visible to developers through annotated suppressions
3. **Validation-first**: Every code change is validated
4. **Cost optimization**: Selective LLM usage, not brute force
5. **Avoid overfitting**: Agent prompts must NOT include domain-specific code examples that could bias the agent toward particular patterns or solutions

### Code Quality Standards

- **Function length limit**: Maximum 10 statements per function
- **Single responsibility**: Each function has one clear purpose
- **Small modules**: Break complex logic into focused functions
- **Clear naming**: Descriptive names for functions, variables, and types
- **No comments**: Do not add any comments to the code unless explicitly requested
- **DRY principle**: Never duplicate code - extract common logic into reusable functions

### Technical Notes

- **TypeScript file extensions**: All project files use `.ts` extensions
- **Import paths**: ALL relative imports MUST use `.ts` extension (e.g., `from "./file.ts"`), never `.js`

### Misc

- Only continue with implementation when explicitly prompted by the user. Do not proactively implement features or phases without being asked.
