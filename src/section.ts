import type { PromptContext, PromptSection } from './types';

/**
 * Create a section with a single render function that returns `string | null`.
 *
 * Return `null` to exclude the section — this replaces the separate `when`
 * guard and lets TypeScript narrowing work naturally in a single function scope.
 *
 * @example
 * ```ts
 * const prodContext = section('prod-context', (ctx: SandboxCtx) => {
 *   if (ctx.vars.productionContext == null) return null;
 *   // TypeScript knows productionContext is non-null here
 *   return `## Production Context\n\n${ctx.vars.productionContext}`;
 * });
 * ```
 */
export function section<TCtx extends PromptContext = PromptContext>(
  id: string,
  render: (ctx: TCtx) => string | null,
): PromptSection<TCtx> {
  return {
    id,
    render: (ctx) => render(ctx) ?? '',
  };
}
