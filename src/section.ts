import type { PromptContext, PromptSection } from './types';

interface SectionOptions<TCtx extends PromptContext> {
  /** Guard function. Return `false` to exclude this section entirely. */
  when?: (ctx: TCtx) => boolean;
}

/**
 * Create a prompt section.
 *
 * @example
 * ```ts
 * // Static
 * section('identity', () => 'You are Coworker.')
 *
 * // Conditional via null return (TypeScript narrows naturally)
 * section('prod', (ctx: SandboxCtx) => {
 *   if (ctx.vars.prodContext == null) return null;
 *   return `## Prod\n\n${ctx.vars.prodContext}`;
 * })
 *
 * // Conditional via when guard
 * section('debug', (ctx: Ctx) => `Model: ${ctx.vars.model}`, {
 *   when: (ctx) => ctx.flags.debug,
 * })
 * ```
 */
export function section<TCtx extends PromptContext = PromptContext>(
  id: string,
  render: (ctx: TCtx) => string | null,
  options?: SectionOptions<TCtx>,
): PromptSection<TCtx> {
  return {
    id,
    when: options?.when,
    render: (ctx) => render(ctx) ?? '',
  };
}
