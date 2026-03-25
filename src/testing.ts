import type { PromptContext, PromptSection } from './types';

export function mockContext<
  TFlags extends Record<string, boolean> = Record<string, boolean>,
  TVars extends object = Record<string, unknown>,
>(overrides?: Partial<PromptContext<TFlags, TVars>>): PromptContext<TFlags, TVars> {
  return {
    flags: {} as TFlags,
    vars: {} as TVars,
    ...overrides,
  };
}

/** Renders a section in isolation. Returns `null` if excluded by `when` guard. */
export function renderSection<TCtx extends PromptContext>(
  section: PromptSection<TCtx>,
  contextOverrides?: Partial<TCtx>,
): string | null {
  const ctx = mockContext(contextOverrides) as TCtx;
  if (section.when && !section.when(ctx)) {
    return null;
  }
  return section.render(ctx);
}
