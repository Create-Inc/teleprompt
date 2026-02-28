import type { PromptContext, PromptSection } from './types';

function assertNever(value: never): never {
  throw new Error(`Unexpected format: ${value}`);
}

/**
 * A named group of prompt nodes, rendered as an XML wrapper
 * in `xml` format and transparently in `text` format.
 */
interface PromptGroup<TCtx extends PromptContext> {
  id: string;
  children: PromptNode<TCtx>[];
}

type PromptNode<TCtx extends PromptContext> = PromptSection<TCtx> | PromptGroup<TCtx>;

function isSection<TCtx extends PromptContext>(
  node: PromptNode<TCtx>,
): node is PromptSection<TCtx> {
  return 'render' in node;
}

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
    const idx = this.nodes.findIndex((n) => n.id === section.id);
    if (idx >= 0) {
      this.nodes[idx] = section;
    } else {
      this.nodes.push(section);
    }
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
    const idx = this.nodes.findIndex((n) => n.id === id);
    if (idx >= 0) {
      this.nodes[idx] = group;
    } else {
      this.nodes.push(group);
    }
    return this;
  }

  /** Remove a section or group. Accepts an id string or an object with `id`. Searches recursively into groups. */
  without(ref: string | { id: string }): this {
    const id = typeof ref === 'string' ? ref : ref.id;
    this.nodes = this.removeNode(this.nodes, id);
    return this;
  }

  /** Check if a section or group exists. Accepts an id string or an object with `id`. Searches recursively into groups. */
  has(ref: string | { id: string }): boolean {
    const id = typeof ref === 'string' ? ref : ref.id;
    return this.hasNode(this.nodes, id);
  }

  /** Get all ids (sections and groups) in order, including children of groups. */
  ids(): string[] {
    return this.collectIds(this.nodes);
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
    forked.nodes = this.deepCopy(this.nodes);
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

    const parts = this.renderNodes(this.nodes, ctx, format, included, excluded);
    const prompt = parts.join('\n\n').trim();

    return { prompt, included, excluded };
  }

  // --- Private ---

  private renderNodes(
    nodes: PromptNode<TCtx>[],
    ctx: TCtx,
    format: PromptFormat,
    included: string[],
    excluded: string[],
  ): string[] {
    const parts: string[] = [];

    for (const node of nodes) {
      if (isSection(node)) {
        if (node.when && !node.when(ctx)) {
          excluded.push(node.id);
          continue;
        }
        const output = node.render(ctx);
        if (output) {
          included.push(node.id);
          parts.push(this.formatSection(node.id, output, format));
        } else {
          excluded.push(node.id);
        }
      } else {
        const childParts = this.renderNodes(node.children, ctx, format, included, excluded);
        if (childParts.length > 0) {
          parts.push(...this.formatGroup(node.id, childParts, format));
        }
      }
    }

    return parts;
  }

  /** Wrap a single section's rendered content according to the output format. */
  private formatSection(id: string, content: string, format: PromptFormat): string {
    switch (format) {
      case 'text':
        return content;
      case 'xml':
        return `<${id}>\n${content}\n</${id}>`;
      default:
        return assertNever(format);
    }
  }

  /**
   * Wrap a group's rendered children according to the output format.
   * Returns an array — in text mode the children are spread inline,
   * in xml mode they are joined and wrapped in a single entry.
   */
  private formatGroup(id: string, childParts: string[], format: PromptFormat): string[] {
    switch (format) {
      case 'text':
        return childParts;
      case 'xml':
        return [`<${id}>\n${childParts.join('\n\n')}\n</${id}>`];
      default:
        return assertNever(format);
    }
  }

  private hasNode(nodes: PromptNode<TCtx>[], id: string): boolean {
    for (const node of nodes) {
      if (node.id === id) return true;
      if (!isSection(node) && this.hasNode(node.children, id)) return true;
    }
    return false;
  }

  private removeNode(nodes: PromptNode<TCtx>[], id: string): PromptNode<TCtx>[] {
    return nodes
      .filter((n) => n.id !== id)
      .map((n) => {
        if (!isSection(n)) {
          return { ...n, children: this.removeNode(n.children, id) };
        }
        return n;
      });
  }

  private collectIds(nodes: PromptNode<TCtx>[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
      ids.push(node.id);
      if (!isSection(node)) {
        ids.push(...this.collectIds(node.children));
      }
    }
    return ids;
  }

  private deepCopy(nodes: PromptNode<TCtx>[]): PromptNode<TCtx>[] {
    return nodes.map((n) => {
      if (!isSection(n)) {
        return { ...n, children: this.deepCopy(n.children) };
      }
      return n;
    });
  }
}
