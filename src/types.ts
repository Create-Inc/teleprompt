/**
 * The context passed to every section's `when` and `render` functions.
 *
 * @typeParam TFlags - Shape of the boolean flags object
 * @typeParam TVars - Shape of the runtime variables object
 */
export interface PromptContext<
  TFlags extends Record<string, boolean>,
  TVars extends Record<string, unknown>,
> {
  /** Boolean flags that control which sections are included and how they render */
  flags: TFlags;
  /** Runtime data sections can read from (model, mode, integrations, etc.) */
  vars: TVars;
}

/**
 * A single composable unit of prompt content.
 *
 * @typeParam TCtx - The prompt context type this section operates on
 */
export interface PromptSection<
  TCtx extends PromptContext<Record<string, boolean>, Record<string, unknown>>,
> {
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
