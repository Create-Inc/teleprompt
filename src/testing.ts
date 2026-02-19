import type { PromptContext, PromptSection } from './types';

/**
 * Create a minimal PromptContext for testing.
 * All fields have sensible defaults that can be overridden.
 *
 * @example
 * ```ts
 * const ctx = mockContext({ flags: { myFlag: true } });
 * const output = mySection.render(ctx);
 * ```
 */
export function mockContext<
  TFlags extends Record<string, boolean> = Record<string, boolean>,
  TVars extends Record<string, unknown> = Record<string, unknown>,
>(overrides?: Partial<PromptContext<TFlags, TVars>>): PromptContext<TFlags, TVars> {
  return {
    flags: {} as TFlags,
    mode: 'default',
    vars: {} as TVars,
    ...overrides,
  };
}

/**
 * Render a single section in isolation with a mock context.
 * Respects the section's `when` guard — returns `null` if excluded.
 *
 * @example
 * ```ts
 * const output = renderSection(mySection, { flags: { enabled: true } });
 * expect(output).toContain('expected text');
 * ```
 */
export function renderSection<TCtx extends PromptContext = PromptContext>(
  section: PromptSection<TCtx>,
  contextOverrides?: Partial<TCtx>,
): string | null {
  const ctx = mockContext(contextOverrides) as TCtx;
  if (section.when && !section.when(ctx)) {
    return null;
  }
  return section.render(ctx);
}
