import type { PromptContext, PromptSection } from './types';

export type PromptFormat = 'text' | 'xml';

export interface BuildOptions {
  format?: PromptFormat;
}

/**
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

  /** Replaces an existing section with the same id. */
  use(section: PromptSection<TCtx>): this {
    const idx = this.nodes.findIndex((n) => !isOneOf(n) && n.id === section.id);
    if (idx >= 0) {
      this.nodes[idx] = section;
    } else {
      this.nodes.push(section);
    }
    return this;
  }

  /** First candidate that renders a non-empty string wins. */
  useOneOf(...candidates: PromptSection<TCtx>[]): this {
    this.nodes.push({ candidates });
    return this;
  }

  /** In `xml` format, wraps children in `<id>` tags. Transparent in `text` format. */
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

  /** Searches recursively into groups and oneOf candidates. */
  without(ref: string | { id: string }): this {
    const id = typeof ref === 'string' ? ref : ref.id;
    this.nodes = removeNode(this.nodes, id);
    return this;
  }

  /** Searches recursively into groups and oneOf candidates. */
  has(ref: string | { id: string }): boolean {
    const id = typeof ref === 'string' ? ref : ref.id;
    return hasNode(this.nodes, id);
  }

  ids(): string[] {
    return collectIds(this.nodes);
  }

  /** Creates an independent copy. Modifications to the fork don't affect the original. */
  fork(): PromptBuilder<TCtx> {
    const forked = new PromptBuilder<TCtx>();
    forked.nodes = deepCopy(this.nodes);
    return forked;
  }

  build(ctx: TCtx, options?: BuildOptions): string {
    return this.buildWithMeta(ctx, options).prompt;
  }

  /** Like `build`, but also returns which section ids were included/excluded. */
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
