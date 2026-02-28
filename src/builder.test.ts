import { describe, expect, it } from 'vitest';
import { PromptBuilder } from './builder';
import { section } from './section';
import { mockContext } from './testing';
import type { PromptContext, PromptSection } from './types';

type TestFlags = Record<string, boolean>;
type TestVars = Record<string, unknown>;
type Ctx = PromptContext<TestFlags, TestVars>;

const ctx = mockContext<TestFlags, TestVars>();

const stub = (
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
      const result = new PromptBuilder<Ctx>().use(stub('a', 'Hello')).build(ctx);

      expect(result).toBe('Hello');
    });

    it('replaces a section with the same id', () => {
      const result = new PromptBuilder<Ctx>().use(stub('a', 'v1')).use(stub('a', 'v2')).build(ctx);

      expect(result).toBe('v2');
    });
  });

  describe('without', () => {
    it('removes a section by id string', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'Keep'))
        .use(stub('b', 'Remove'))
        .without('b')
        .build(ctx);

      expect(result).toBe('Keep');
    });

    it('removes a section by section object', () => {
      const b = stub('b', 'Remove');
      const result = new PromptBuilder<Ctx>().use(stub('a', 'Keep')).use(b).without(b).build(ctx);

      expect(result).toBe('Keep');
    });

    it('is a no-op for non-existent ids', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'Keep'))
        .without('nonexistent')
        .build(ctx);

      expect(result).toBe('Keep');
    });
  });

  describe('has', () => {
    it('returns true for registered sections by string', () => {
      const builder = new PromptBuilder<Ctx>().use(stub('a', 'test'));
      expect(builder.has('a')).toBe(true);
    });

    it('returns true for registered sections by object', () => {
      const a = stub('a', 'test');
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
        .use(stub('c', ''))
        .use(stub('a', ''))
        .use(stub('b', ''));

      expect(builder.ids()).toEqual(['c', 'a', 'b']);
    });
  });

  describe('fork', () => {
    it('creates an independent copy', () => {
      const base = new PromptBuilder<Ctx>().use(stub('a', 'shared'));
      const variant = base.fork().use(stub('b', 'extra'));

      expect(base.has('b')).toBe(false);
      expect(variant.has('b')).toBe(true);
    });

    it('does not affect the original when modified', () => {
      const base = new PromptBuilder<Ctx>().use(stub('a', 'original'));
      const variant = base.fork().use(stub('a', 'modified'));

      expect(base.build(ctx)).toBe('original');
      expect(variant.build(ctx)).toBe('modified');
    });
  });

  describe('when guards', () => {
    it('excludes sections whose when guard returns false', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'included'))
        .use(stub('b', 'excluded', { when: () => false }))
        .build(ctx);

      expect(result).toBe('included');
    });

    it('includes sections whose when guard returns true', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'first'))
        .use(stub('b', 'second', { when: () => true }))
        .build(ctx);

      expect(result).toBe('first\n\nsecond');
    });

    it('supports flag-based guards', () => {
      const flaggedCtx = mockContext({ flags: { myFlag: true } });
      const unflaggedCtx = mockContext({ flags: { myFlag: false } });

      const builder = new PromptBuilder<Ctx>().use(stub('a', 'always')).use(
        stub('b', 'flagged', {
          when: (ctx) => ctx.flags.myFlag === true,
        }),
      );

      expect(builder.build(flaggedCtx)).toBe('always\n\nflagged');
      expect(builder.build(unflaggedCtx)).toBe('always');
    });
  });

  describe('insertion order', () => {
    it('renders sections in insertion order', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'first'))
        .use(stub('b', 'second'))
        .use(stub('c', 'third'))
        .build(ctx);

      expect(result).toBe('first\n\nsecond\n\nthird');
    });
  });

  describe('empty string filtering', () => {
    it('filters out sections that render empty strings', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'keep'))
        .use(stub('b', ''))
        .use(stub('c', 'also keep'))
        .build(ctx);

      expect(result).toBe('keep\n\nalso keep');
    });
  });

  describe('buildWithMeta', () => {
    it('returns included and excluded section ids', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(stub('a', 'yes'))
        .use(stub('b', 'no', { when: () => false }))
        .use(stub('c', 'yes'));

      const meta = builder.buildWithMeta(ctx);

      expect(meta.included).toEqual(['a', 'c']);
      expect(meta.excluded).toEqual(['b']);
      expect(meta.prompt).toBe('yes\n\nyes');
    });

    it('excludes sections that render empty strings', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(stub('a', 'content'))
        .use(stub('b', ''))
        .use(stub('c', 'more'));

      const meta = builder.buildWithMeta(ctx);

      expect(meta.included).toEqual(['a', 'c']);
      expect(meta.excluded).toEqual(['b']);
      expect(meta.prompt).toBe('content\n\nmore');
    });

    it('reports included in insertion order', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(stub('c', 'third'))
        .use(stub('a', 'first'))
        .use(stub('b', 'second'));

      const meta = builder.buildWithMeta(ctx);

      expect(meta.included).toEqual(['c', 'a', 'b']);
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

  describe('default type parameter', () => {
    it('allows PromptSection without type param', () => {
      // Static section — no context needed
      const staticSection: PromptSection = {
        id: 'static',
        render: () => 'I am static',
      };

      const result = new PromptBuilder().use(staticSection).build(ctx);
      expect(result).toBe('I am static');
    });

    it('allows static sections in a typed builder', () => {
      type SpecificVars = { name: string };
      type SpecificCtx = PromptContext<Record<string, boolean>, SpecificVars>;

      // Section with no type param works in a builder with a specific context
      const staticSection: PromptSection = {
        id: 'static',
        render: () => 'I work anywhere',
      };

      const typedSection: PromptSection<SpecificCtx> = {
        id: 'typed',
        render: (ctx) => `Hello ${ctx.vars.name}`,
      };

      const specificCtx = mockContext<Record<string, boolean>, SpecificVars>({
        vars: { name: 'Claude' },
      });

      const result = new PromptBuilder<SpecificCtx>()
        .use(staticSection)
        .use(typedSection)
        .build(specificCtx);

      expect(result).toBe('I work anywhere\n\nHello Claude');
    });
  });

  describe('group', () => {
    it('adds sections inside a group', () => {
      const builder = new PromptBuilder<Ctx>().group('tools', (b) =>
        b.use(stub('bash', 'Bash tools')).use(stub('git', 'Git tools')),
      );

      expect(builder.has('tools')).toBe(true);
      expect(builder.has('bash')).toBe(true);
      expect(builder.has('git')).toBe(true);
    });

    it('replaces a group with the same id', () => {
      const builder = new PromptBuilder<Ctx>()
        .group('tools', (b) => b.use(stub('bash', 'Bash v1')))
        .group('tools', (b) => b.use(stub('git', 'Git v2')));

      expect(builder.has('bash')).toBe(false);
      expect(builder.has('git')).toBe(true);
    });

    it('supports nested groups', () => {
      const builder = new PromptBuilder<Ctx>().group('outer', (b) =>
        b.use(stub('a', 'A')).group('inner', (b) => b.use(stub('b', 'B'))),
      );

      expect(builder.has('outer')).toBe(true);
      expect(builder.has('inner')).toBe(true);
      expect(builder.has('b')).toBe(true);
      expect(builder.ids()).toEqual(['outer', 'a', 'inner', 'b']);
    });

    it('is transparent in text format', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'first'))
        .group('tools', (b) => b.use(stub('bash', 'Bash tools')).use(stub('git', 'Git tools')))
        .use(stub('b', 'last'))
        .build(ctx);

      expect(result).toBe('first\n\nBash tools\n\nGit tools\n\nlast');
    });
  });

  describe('without (groups)', () => {
    it('removes a section inside a group', () => {
      const builder = new PromptBuilder<Ctx>().group('tools', (b) =>
        b.use(stub('bash', 'Bash')).use(stub('git', 'Git')),
      );

      builder.without('bash');

      expect(builder.has('bash')).toBe(false);
      expect(builder.has('git')).toBe(true);
    });

    it('removes an entire group by id', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(stub('a', 'Keep'))
        .group('tools', (b) => b.use(stub('bash', 'Bash')).use(stub('git', 'Git')));

      builder.without('tools');

      expect(builder.has('tools')).toBe(false);
      expect(builder.has('bash')).toBe(false);
      expect(builder.build(ctx)).toBe('Keep');
    });
  });

  describe('ids (groups)', () => {
    it('returns group and child ids in order', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(stub('a', ''))
        .group('tools', (b) => b.use(stub('bash', '')).use(stub('git', '')))
        .use(stub('b', ''));

      expect(builder.ids()).toEqual(['a', 'tools', 'bash', 'git', 'b']);
    });
  });

  describe('fork (groups)', () => {
    it('deep copies groups so modifications are independent', () => {
      const base = new PromptBuilder<Ctx>().group('tools', (b) =>
        b.use(stub('bash', 'Bash')).use(stub('git', 'Git')),
      );
      const variant = base.fork().without('bash');

      expect(base.has('bash')).toBe(true);
      expect(variant.has('bash')).toBe(false);
    });
  });

  describe('xml format', () => {
    it('wraps sections in id tags', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('identity', 'You are an assistant.'))
        .build(ctx, { format: 'xml' });

      expect(result).toBe('<identity>\nYou are an assistant.\n</identity>');
    });

    it('wraps multiple sections with separator', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('role', 'You are helpful.'))
        .use(stub('rules', 'Be concise.'))
        .build(ctx, { format: 'xml' });

      expect(result).toBe('<role>\nYou are helpful.\n</role>\n\n<rules>\nBe concise.\n</rules>');
    });

    it('wraps groups in id tags containing children', () => {
      const result = new PromptBuilder<Ctx>()
        .group('tools', (b) => b.use(stub('bash', 'Bash tools')).use(stub('git', 'Git tools')))
        .build(ctx, { format: 'xml' });

      expect(result).toBe(
        '<tools>\n<bash>\nBash tools\n</bash>\n\n<git>\nGit tools\n</git>\n</tools>',
      );
    });

    it('renders nested groups', () => {
      const result = new PromptBuilder<Ctx>()
        .group('outer', (b) => b.use(stub('a', 'A')).group('inner', (b) => b.use(stub('b', 'B'))))
        .build(ctx, { format: 'xml' });

      expect(result).toBe('<outer>\n<a>\nA\n</a>\n\n<inner>\n<b>\nB\n</b>\n</inner>\n</outer>');
    });

    it('excludes sections by when guard', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'included'))
        .use(stub('b', 'excluded', { when: () => false }))
        .build(ctx, { format: 'xml' });

      expect(result).toBe('<a>\nincluded\n</a>');
    });

    it('omits empty groups when all children excluded', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'keep'))
        .group('tools', (b) => b.use(stub('bash', 'hidden', { when: () => false })))
        .build(ctx, { format: 'xml' });

      expect(result).toBe('<a>\nkeep\n</a>');
    });

    it('filters empty renders', () => {
      const result = new PromptBuilder<Ctx>()
        .use(stub('a', 'keep'))
        .use(stub('b', ''))
        .build(ctx, { format: 'xml' });

      expect(result).toBe('<a>\nkeep\n</a>');
    });

    it('tracks metadata correctly', () => {
      const builder = new PromptBuilder<Ctx>()
        .use(stub('a', 'yes'))
        .use(stub('b', 'no', { when: () => false }))
        .group('tools', (b) => b.use(stub('bash', 'Bash')).use(stub('git', '')));

      const meta = builder.buildWithMeta(ctx, { format: 'xml' });

      expect(meta.included).toEqual(['a', 'bash']);
      expect(meta.excluded).toEqual(['b', 'git']);
    });
  });

  describe('section() helper', () => {
    it('creates a section from a render function', () => {
      const s = section('greeting', () => 'Hello');
      const result = new PromptBuilder().use(s).build(ctx);

      expect(result).toBe('Hello');
    });

    it('excludes when render returns null', () => {
      const s = section('conditional', () => null);
      const result = new PromptBuilder().use(s).build(ctx);

      expect(result).toBe('');
    });

    it('tracks null-returning sections as excluded in metadata', () => {
      const always = section('always', () => 'yes');
      const never = section('never', () => null);

      const meta = new PromptBuilder().use(always).use(never).buildWithMeta(ctx);

      expect(meta.included).toEqual(['always']);
      expect(meta.excluded).toEqual(['never']);
    });

    it('passes context to the render function', () => {
      type Vars = { name: string | null };
      type TestCtx = PromptContext<Record<string, boolean>, Vars>;

      const greeting = section('greeting', (ctx: TestCtx) => {
        if (ctx.vars.name == null) return null;
        return `Hello ${ctx.vars.name}`;
      });

      const withName = mockContext<Record<string, boolean>, Vars>({ vars: { name: 'Claude' } });
      const withoutName = mockContext<Record<string, boolean>, Vars>({ vars: { name: null } });

      expect(new PromptBuilder<TestCtx>().use(greeting).build(withName)).toBe('Hello Claude');
      expect(new PromptBuilder<TestCtx>().use(greeting).build(withoutName)).toBe('');
    });

    it('supports a when guard option', () => {
      const flagCtx = mockContext({ flags: { debug: true } });
      const noFlagCtx = mockContext({ flags: { debug: false } });

      const debug = section('debug', () => 'Debug info', {
        when: (ctx) => ctx.flags.debug === true,
      });

      expect(new PromptBuilder().use(debug).build(flagCtx)).toBe('Debug info');
      expect(new PromptBuilder().use(debug).build(noFlagCtx)).toBe('');
    });
  });
});
