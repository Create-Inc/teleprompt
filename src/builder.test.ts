import { describe, expect, it } from 'vitest';
import { PromptBuilder } from './builder';
import { mockContext } from './testing';
import type { PromptContext, PromptSection } from './types';

type TestFlags = Record<string, boolean>;
type TestVars = Record<string, unknown>;
type Ctx = PromptContext<TestFlags, TestVars>;

const ctx = mockContext<TestFlags, TestVars>();

const section = (
  id: string,
  content: string,
  opts?: Partial<PromptSection<Ctx>>,
): PromptSection<Ctx> => ({
  id,
  render: () => content,
  ...opts,
});

describe('PromptBuilder', () => {
  describe('use', () => {
    it('adds a section and renders it', () => {
      const result = new PromptBuilder<Ctx>().use(section('a', 'Hello')).build(ctx);

      expect(result).toBe('Hello');
    });

    it('replaces a section with the same id', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'v1'))
        .use(section('a', 'v2'))
        .build(ctx);

      expect(result).toBe('v2');
    });
  });

  describe('without', () => {
    it('removes a section by id string', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'Keep'))
        .use(section('b', 'Remove'))
        .without('b')
        .build(ctx);

      expect(result).toBe('Keep');
    });

    it('removes a section by section object', () => {
      const b = section('b', 'Remove');
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'Keep'))
        .use(b)
        .without(b)
        .build(ctx);

      expect(result).toBe('Keep');
    });

    it('is a no-op for non-existent ids', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'Keep'))
        .without('nonexistent')
        .build(ctx);

      expect(result).toBe('Keep');
    });
  });

  describe('has', () => {
    it('returns true for registered sections by string', () => {
      const builder = new PromptBuilder<Ctx>().use(section('a', 'test'));
      expect(builder.has('a')).toBe(true);
    });

    it('returns true for registered sections by object', () => {
      const a = section('a', 'test');
      const builder = new PromptBuilder<Ctx>().use(a);
      expect(builder.has(a)).toBe(true);
    });

    it('returns false for unregistered sections', () => {
      const builder = new PromptBuilder<Ctx>();
      expect(builder.has('a')).toBe(false);
    });
  });

  describe('ids', () => {
    it('returns section ids in insertion order', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(section('c', '', { priority: 0 }))
        .use(section('a', '', { priority: 1 }))
        .use(section('b', '', { priority: 2 }));

      expect(builder.ids()).toEqual(['c', 'a', 'b']);
    });
  });

  describe('fork', () => {
    it('creates an independent copy', () => {
      const base = new PromptBuilder<Ctx>().use(section('a', 'shared'));
      const variant = base.fork().use(section('b', 'extra'));

      expect(base.has('b')).toBe(false);
      expect(variant.has('b')).toBe(true);
    });

    it('does not affect the original when modified', () => {
      const base = new PromptBuilder<Ctx>().use(section('a', 'original'));
      const variant = base.fork().use(section('a', 'modified'));

      expect(base.build(ctx)).toBe('original');
      expect(variant.build(ctx)).toBe('modified');
    });
  });

  describe('when guards', () => {
    it('excludes sections whose when guard returns false', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'included'))
        .use(section('b', 'excluded', { when: () => false }))
        .build(ctx);

      expect(result).toBe('included');
    });

    it('includes sections whose when guard returns true', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'first'))
        .use(section('b', 'second', { when: () => true }))
        .build(ctx);

      expect(result).toBe('first\n\nsecond');
    });

    it('supports flag-based guards', () => {
      const flaggedCtx = mockContext({ flags: { myFlag: true } });
      const unflaggedCtx = mockContext({ flags: { myFlag: false } });

      const builder = new PromptBuilder<Ctx>().use(section('a', 'always')).use(
        section('b', 'flagged', {
          when: (ctx) => ctx.flags.myFlag === true,
        }),
      );

      expect(builder.build(flaggedCtx)).toBe('always\n\nflagged');
      expect(builder.build(unflaggedCtx)).toBe('always');
    });
  });

  describe('priority ordering', () => {
    it('sorts sections by priority', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('c', 'third', { priority: 30 }))
        .use(section('a', 'first', { priority: 10 }))
        .use(section('b', 'second', { priority: 20 }))
        .build(ctx);

      expect(result).toBe('first\n\nsecond\n\nthird');
    });

    it('preserves insertion order for equal priorities', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'first'))
        .use(section('b', 'second'))
        .use(section('c', 'third'))
        .build(ctx);

      expect(result).toBe('first\n\nsecond\n\nthird');
    });
  });

  describe('empty string filtering', () => {
    it('filters out sections that render empty strings', () => {
      const result = new PromptBuilder<Ctx>()
        .use(section('a', 'keep'))
        .use(section('b', ''))
        .use(section('c', 'also keep'))
        .build(ctx);

      expect(result).toBe('keep\n\nalso keep');
    });
  });

  describe('buildWithMeta', () => {
    it('returns included and excluded section ids', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(section('a', 'yes'))
        .use(section('b', 'no', { when: () => false }))
        .use(section('c', 'yes'));

      const meta = builder.buildWithMeta(ctx);

      expect(meta.included).toEqual(['a', 'c']);
      expect(meta.excluded).toEqual(['b']);
      expect(meta.prompt).toBe('yes\n\nyes');
    });

    it('excludes sections that render empty strings', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(section('a', 'content'))
        .use(section('b', ''))
        .use(section('c', 'more'));

      const meta = builder.buildWithMeta(ctx);

      expect(meta.included).toEqual(['a', 'c']);
      expect(meta.excluded).toEqual(['b']);
      expect(meta.prompt).toBe('content\n\nmore');
    });

    it('reports included in priority order', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(section('c', 'third', { priority: 30 }))
        .use(section('a', 'first', { priority: 10 }))
        .use(section('b', 'second', { priority: 20 }));

      const meta = builder.buildWithMeta(ctx);

      expect(meta.included).toEqual(['a', 'b', 'c']);
    });
  });

  describe('render receives context', () => {
    it('passes context to render function', () => {
      const dynamicCtx = mockContext({ vars: { name: 'Claude' } });

      const builder = new PromptBuilder<Ctx>().use({
        id: 'greeting',
        render: (ctx) => `Hello, ${(ctx.vars as Record<string, string>).name}!`,
      });

      expect(builder.build(dynamicCtx)).toBe('Hello, Claude!');
    });
  });
});
