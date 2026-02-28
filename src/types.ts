export interface PromptContext<
  TFlags extends Record<string, boolean> = Record<string, boolean>,
  TVars extends Record<string, unknown> = Record<string, unknown>,
> {
  flags: TFlags;
  vars: TVars;
}

export interface PromptSection<TCtx extends PromptContext = PromptContext> {
  id: string;
  /** Return `false` to exclude this section from the output. */
  when?: (ctx: TCtx) => boolean;
  render: (ctx: TCtx) => string;
}
