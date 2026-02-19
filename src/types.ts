/**
 * The context passed to every section's `when` and `render` functions.
 *
 * @typeParam TFlags - Shape of the feature flags object
 * @typeParam TVars - Shape of the runtime variables object
 */
export interface PromptContext<
  TFlags extends Record<string, boolean> = Record<string, boolean>,
  TVars extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Feature flags that control which sections are included and how they render */
  flags: TFlags;
  /** The operating mode (e.g. 'max', 'discussion', 'orchestrator') */
  mode: string;
  /** Arbitrary runtime data sections can read from (model, modules, integrations, etc.) */
  vars: TVars;
}

/**
 * A single composable unit of prompt content.
 *
 * Sections are the atomic building blocks of a prompt. Each section:
 * - Has a unique `id` for replacement/removal via `use()` and `without()`
 * - Can conditionally include itself via `when`
 * - Renders its content as a pure function of context
 * - Has an optional `priority` for ordering
 */
export interface PromptSection<TCtx extends PromptContext = PromptContext> {
  /** Unique identifier. Used by `use()`, `without()`, and `buildWithMeta()`. */
  id: string;

  /**
   * Guard function. Return `false` to exclude this section from the output.
   * If omitted, the section is always included.
   */
  when?: (ctx: TCtx) => boolean;

  /**
   * Render the section content. Receives the full prompt context.
   * Return an empty string to include nothing (different from `when: false`
   * which removes the section entirely including any separator).
   */
  render: (ctx: TCtx) => string;

  /**
   * Ordering weight. Lower values appear earlier in the output.
   * Sections with the same priority preserve insertion order.
   * @default 0
   */
  priority?: number;
}
