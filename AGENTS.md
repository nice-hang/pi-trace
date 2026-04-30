# AI Development Rules

## Code Style
- Tab indentation with width 3
- Max line width 120
- Use TypeScript with strict mode
- Use `const` over `let` where possible

## Project
- Monorepo with npm workspaces
- Package manager: npm
- Core package: `pi-trace` in `packages/pi-trace/`
- Testing: vitest
- Formatting/linting: biome

## Principles
- Core minimal, extension separate
- Each layer does one thing
- Errors are data, not control flow
