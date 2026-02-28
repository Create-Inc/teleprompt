import type { PromptContext, PromptSection } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Supported output formats for prompt rendering. */
export type PromptFormat = 'text' | 'xml';

/** Options for {@link PromptBuilder.build} and {@link PromptBuilder.buildWithMeta}. */
export interface BuildOptions {
  /**
   * Output format.
   *
   * - `'text'` (default) — sections joined with `\n\n`, groups are transparent.
   * - `'xml'` — each section wrapped in `<id>...</id>` tags, groups
   *   wrapped in `<id>...</id>` containing their children.
   */
  format?: PromptFormat;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

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
export class PromptBuilder<TCtx extends PromptContext = PromptContext> {
  private nodes: PromptNode<TCtx>[] = [];

  /**
   * Add a section to the prompt.
   *
   * If a section with the same `id` already exists, it is replaced.
   * This makes `.use()` idempotent — you can safely call it multiple
   * times with the same section without creating duplicates.
   */
  use(section: PromptSection<TCtx>): this {
    const idx = this.nodes.findIndex((n) => !isOneOf(n) && n.id === section.id);
    if (idx >= 0) {
      this.nodes[idx] = section;
    } else {
      this.nodes.push(section);
    }
    return this;
  }

  /**
   * Add mutually exclusive sections. The first candidate that renders
   * a non-empty string wins — the rest are excluded.
   *
   * @example
   * ```ts
   * builder.useOneOf(activeTasks, noActiveTasks)
   * ```
   */
  useOneOf(...candidates: PromptSection<TCtx>[]): this {
    this.nodes.push({ candidates });
    return this;
  }

  /**
   * Add a named group of sections. In `xml` format, children are
   * wrapped in `<id>...</id>`. In `text` format, groups are transparent
   * and children render as if they were top-level sections.
   *
   * @example
   * ```ts
   * builder.group('tools', b => b
   *   .use(bashSection)
   *   .use(gitSection)
   * )
   * ```
   */
  group(id: string, configure: (builder: PromptBuilder<TCtx>) => void): this {
    const inner = new PromptBuilder<TCtx>();
    configure(inner);
    const group: PromptGroup<TCtx> = { id, children: inner.nodes };
    const idx = this.nodes.findIndex((n) => !isOneOf(n) && n.id === id);
    if (idx >= 0) {
      this.nodes[idx] = group;
    } else {
      this.nodes.push(group);
    }
    return this;
  }

  /** Remove a section or group. Accepts an id string or an object with `id`. Searches recursively into groups and oneOf candidates. */
  without(ref: string | { id: string }): this {
    const id = typeof ref === 'string' ? ref : ref.id;
    this.nodes = removeNode(this.nodes, id);
    return this;
  }

  /** Check if a section or group exists. Accepts an id string or an object with `id`. Searches recursively into groups and oneOf candidates. */
  has(ref: string | { id: string }): boolean {
    const id = typeof ref === 'string' ? ref : ref.id;
    return hasNode(this.nodes, id);
  }

  /** Get all ids (sections, groups, and oneOf candidates) in order. */
  ids(): string[] {
    return collectIds(this.nodes);
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
    forked.nodes = deepCopy(this.nodes);
    return forked;
  }

  /**
   * Build the final prompt string.
   *
   * 1. Filters out sections whose `when` guard returns false
   * 2. Renders each section
   * 3. Filters out empty strings
   * 4. Joins with separator and trims
   *
   * Pass `{ format: 'xml' }` to wrap each section in `<id>` tags.
   */
  build(ctx: TCtx, options?: BuildOptions): string {
    return this.buildWithMeta(ctx, options).prompt;
  }

  /**
   * Build the prompt and return metadata about which sections were
   * included/excluded. Useful for debugging and logging.
   *
   * A section is "excluded" if its `when` guard returns false.
   * A section is "included" only if it passes the guard and renders
   * a non-empty string.
   */
  buildWithMeta(
    ctx: TCtx,
    options?: BuildOptions,
  ): {
    prompt: string;
    included: string[];
    excluded: string[];
  } {
    const included: string[] = [];
    const excluded: string[] = [];
    const format = options?.format ?? 'text';

    const parts = renderNodes(this.nodes, ctx, format, included, excluded);
    const prompt = parts.join('\n\n').trim();

    return { prompt, included, excluded };
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PromptGroup<TCtx extends PromptContext> {
  id: string;
  children: PromptNode<TCtx>[];
}

interface PromptOneOf<TCtx extends PromptContext> {
  candidates: PromptSection<TCtx>[];
}

type PromptNode<TCtx extends PromptContext> =
  | PromptSection<TCtx>
  | PromptGroup<TCtx>
  | PromptOneOf<TCtx>;

function isSection<TCtx extends PromptContext>(
  node: PromptNode<TCtx>,
): node is PromptSection<TCtx> {
  return 'render' in node;
}

function isGroup<TCtx extends PromptContext>(node: PromptNode<TCtx>): node is PromptGroup<TCtx> {
  return 'children' in node;
}

function isOneOf<TCtx extends PromptContext>(node: PromptNode<TCtx>): node is PromptOneOf<TCtx> {
  return 'candidates' in node;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertNever(value: never): never {
  throw new Error(`Unexpected format: ${value}`);
}

function formatSection(id: string, content: string, format: PromptFormat): string {
  switch (format) {
    case 'text':
      return content;
    case 'xml':
      return `<${id}>\n${content}\n</${id}>`;
    default:
      return assertNever(format);
  }
}

function formatGroup(id: string, childParts: string[], format: PromptFormat): string[] {
  switch (format) {
    case 'text':
      return childParts;
    case 'xml':
      return [`<${id}>\n${childParts.join('\n\n')}\n</${id}>`];
    default:
      return assertNever(format);
  }
}

function renderSection<TCtx extends PromptContext>(
  section: PromptSection<TCtx>,
  ctx: TCtx,
  format: PromptFormat,
  parts: string[],
  included: string[],
  excluded: string[],
): boolean {
  if (section.when && !section.when(ctx)) {
    excluded.push(section.id);
    return false;
  }
  const output = section.render(ctx);
  if (output) {
    included.push(section.id);
    parts.push(formatSection(section.id, output, format));
    return true;
  }
  excluded.push(section.id);
  return false;
}

function renderOneOf<TCtx extends PromptContext>(
  node: PromptOneOf<TCtx>,
  ctx: TCtx,
  format: PromptFormat,
  parts: string[],
  included: string[],
  excluded: string[],
): void {
  let found = false;
  for (const candidate of node.candidates) {
    if (found) {
      excluded.push(candidate.id);
      continue;
    }
    if (renderSection(candidate, ctx, format, parts, included, excluded)) {
      found = true;
    }
  }
}

function renderNodes<TCtx extends PromptContext>(
  nodes: PromptNode<TCtx>[],
  ctx: TCtx,
  format: PromptFormat,
  included: string[],
  excluded: string[],
): string[] {
  const parts: string[] = [];

  for (const node of nodes) {
    if (isSection(node)) {
      renderSection(node, ctx, format, parts, included, excluded);
    } else if (isGroup(node)) {
      const childParts = renderNodes(node.children, ctx, format, included, excluded);
      if (childParts.length > 0) {
        parts.push(...formatGroup(node.id, childParts, format));
      }
    } else {
      renderOneOf(node, ctx, format, parts, included, excluded);
    }
  }

  return parts;
}

function hasNode<TCtx extends PromptContext>(nodes: PromptNode<TCtx>[], id: string): boolean {
  for (const node of nodes) {
    if (isSection(node)) {
      if (node.id === id) return true;
    } else if (isGroup(node)) {
      if (node.id === id) return true;
      if (hasNode(node.children, id)) return true;
    } else {
      for (const c of node.candidates) {
        if (c.id === id) return true;
      }
    }
  }
  return false;
}

function removeNode<TCtx extends PromptContext>(
  nodes: PromptNode<TCtx>[],
  id: string,
): PromptNode<TCtx>[] {
  const result: PromptNode<TCtx>[] = [];
  for (const n of nodes) {
    if (isSection(n)) {
      if (n.id !== id) result.push(n);
    } else if (isGroup(n)) {
      if (n.id !== id) {
        result.push({ ...n, children: removeNode(n.children, id) });
      }
    } else {
      const remaining = n.candidates.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        result.push({ candidates: remaining });
      }
    }
  }
  return result;
}

function collectIds<TCtx extends PromptContext>(nodes: PromptNode<TCtx>[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (isSection(node)) {
      ids.push(node.id);
    } else if (isGroup(node)) {
      ids.push(node.id);
      ids.push(...collectIds(node.children));
    } else {
      ids.push(...node.candidates.map((c) => c.id));
    }
  }
  return ids;
}

function deepCopy<TCtx extends PromptContext>(nodes: PromptNode<TCtx>[]): PromptNode<TCtx>[] {
  return nodes.map((n) => {
    if (isGroup(n)) {
      return { ...n, children: deepCopy(n.children) };
    }
    if (isOneOf(n)) {
      return { candidates: [...n.candidates] };
    }
    return n;
  });
}
