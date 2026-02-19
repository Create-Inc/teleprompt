import type { PromptContext, PromptSection } from './types';

/**
 * Declarative, composable prompt builder.
 *
 * Prompts are composed from discrete {@link PromptSection}s that are
 * independently testable pure functions. The builder handles ordering,
 * conditional inclusion, and final assembly.
 *
 * @example
 * ```ts
 * const prompt = new PromptBuilder()
 *   .use(identitySection)
 *   .use(rulesSection)
 *   .use(featureSection)
 *   .build(ctx);
 * ```
 */
export class PromptBuilder<
  TCtx extends PromptContext<Record<string, boolean>, Record<string, unknown>>,
> {
  private sections: PromptSection<TCtx>[] = [];

  /**
   * Add a section to the prompt.
   *
   * If a section with the same `id` already exists, it is replaced.
   * This makes `.use()` idempotent — you can safely call it multiple
   * times with the same section without creating duplicates.
   */
  use(section: PromptSection<TCtx>): this {
    const existingIdx = this.sections.findIndex((s) => s.id === section.id);
    if (existingIdx >= 0) {
      this.sections[existingIdx] = section;
    } else {
      this.sections.push(section);
    }
    return this;
  }

  /** Remove a section. Accepts an id string or a section object. */
  without(ref: string | { id: string }): this {
    const id = typeof ref === 'string' ? ref : ref.id;
    this.sections = this.sections.filter((s) => s.id !== id);
    return this;
  }

  /** Check if a section exists. Accepts an id string or a section object. */
  has(ref: string | { id: string }): boolean {
    const id = typeof ref === 'string' ? ref : ref.id;
    return this.sections.some((s) => s.id === id);
  }

  /** Get the ids of all registered sections (in insertion order). */
  ids(): string[] {
    return this.sections.map((s) => s.id);
  }

  /**
   * Create an independent copy of this builder.
   *
   * Use this to create mode-specific or model-specific variants
   * without mutating the base builder.
   *
   * @example
   * ```ts
   * const base = new PromptBuilder().use(a).use(b);
   * const variant = base.fork().use(c); // base is unchanged
   * ```
   */
  fork(): PromptBuilder<TCtx> {
    const forked = new PromptBuilder<TCtx>();
    forked.sections = [...this.sections];
    return forked;
  }

  /**
   * Build the final prompt string.
   *
   * 1. Filters out sections whose `when` guard returns false
   * 2. Sorts by priority (stable sort preserves insertion order for equal priorities)
   * 3. Renders each section
   * 4. Filters out empty strings
   * 5. Joins with separator and trims
   */
  build(ctx: TCtx): string {
    return this.buildWithMeta(ctx).prompt;
  }

  /**
   * Build the prompt and return metadata about which sections were
   * included/excluded. Useful for debugging and logging.
   *
   * A section is "excluded" if its `when` guard returns false.
   * A section is "included" only if it passes the guard and renders
   * a non-empty string.
   */
  buildWithMeta(ctx: TCtx): {
    prompt: string;
    included: string[];
    excluded: string[];
  } {
    const included: string[] = [];
    const excluded: string[] = [];

    const rendered = this.sections
      .filter((s) => {
        if (s.when && !s.when(ctx)) {
          excluded.push(s.id);
          return false;
        }
        return true;
      })
      .toSorted((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((s) => {
        const output = s.render(ctx);
        if (output) {
          included.push(s.id);
        } else {
          excluded.push(s.id);
        }
        return output;
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();

    return { prompt: rendered, included, excluded };
  }
}
