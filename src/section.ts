import type { PromptContext, PromptSection } from './types';

/**
 * Create a prompt section. Return a string to include, `null` to exclude.
 *
 * @example
 * ```ts
 * // Static
 * section('identity', () => 'You are Coworker.')
 *
 * // Conditional — return null to exclude
 * section('prod', (ctx: SandboxCtx) => {
 *   if (ctx.vars.prodContext == null) return null;
 *   return `## Prod\n\n${ctx.vars.prodContext}`;
 * })
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
