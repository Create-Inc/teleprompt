# CLAUDE.md

## Project

teleprompt — composable, section-based LLM system prompts. Published as `@anythingai/teleprompt`.

## Commands

- `pnpm test` — run tests (vitest)
- `pnpm typecheck` — type check
- `pnpm lint` — lint and format (biome)
- `pnpm lint:fix` — auto-fix
- `pnpm check` — run all of the above + publint + attw
- `pnpm build` — build with tsup (ESM + CJS + declarations)

## Code Style

- Keep comments minimal. Only comment to explain _why_ something is done a non-obvious way or to call out subtle gotchas. Do not restate what the code already says.
- Avoid numbered comments (e.g. `// 1. Filter`, `// 2. Render`) to narrate sequential steps. The code's structure communicates this.
- JSDoc on public API is fine — it shows in IDE tooltips. Keep it concise and only say things the type signature doesn't already convey.
- Do not add JSDoc to internal/private code.
- Prefer named parameters (object destructuring) for functions with more than 2 parameters.
- Avoid boolean parameters. Use a named options object or union types.
- Let TypeScript infer return types. Only annotate return types on public API where it aids readability.
- Prefer exhaustive checks in switch statements using the `never` type for the default case.
- Use guard clauses to return early. Avoid deep nesting.
- Do not typecast. Never use `as unknown as T`.
- Prefer `null` over `undefined` for optional values. Use `param: string | null` over `param?: string`.
