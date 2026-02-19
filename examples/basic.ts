import { PromptBuilder, type PromptContext, type PromptSection } from '../src';

// 1. Define your context shape

type AgentContext = PromptContext<
  { askQuestionsEnabled: boolean; codebaseExplorationEnabled: boolean },
  { brandName: string; date: string }
>;

// 2. Define sections

const identity: PromptSection<AgentContext> = {
  id: 'identity',
  render: (ctx) => `You are an expert software engineer for ${ctx.vars.brandName}.`,
};

const instructions: PromptSection<AgentContext> = {
  id: 'instructions',
  render: () => `# Instructions
- Clarify intent before acting.
- Break requests into atomic requirements.
- Implement with precision.
- Verify the result.`,
};

const ambiguity: PromptSection<AgentContext> = {
  id: 'ambiguity',
  render: (ctx) =>
    ctx.flags.askQuestionsEnabled
      ? '- When a request is ambiguous, ask 1-3 clarifying questions before proceeding.'
      : '- Make reasonable assumptions and proceed.',
};

const codebaseExploration: PromptSection<AgentContext> = {
  id: 'codebase-exploration',
  when: (ctx) => ctx.flags.codebaseExplorationEnabled,
  render: () => `# Codebase Exploration
1. Start with semantic search to locate relevant code.
2. Use grep to find specific patterns.
3. Read files you need to understand.`,
};

const rules: PromptSection<AgentContext> = {
  id: 'rules',
  render: () => `# Rules
- Do not use comments. Always include unchanged code in full.
- Verify changes before finishing.`,
};

const date: PromptSection<AgentContext> = {
  id: 'date',
  render: (ctx) => `Today's date is ${ctx.vars.date}.`,
};

// 3. Compose a base prompt

const base = new PromptBuilder<AgentContext>()
  .use(identity)
  .use(instructions)
  .use(ambiguity)
  .use(codebaseExploration)
  .use(rules)
  .use(date);

// 4. Fork for variants

const discussionMode = base
  .fork()
  .without(rules)
  .use({
    id: 'discussion-guard',
    when: (ctx) => ctx.mode === 'discussion',
    render: () => 'You are in discussion mode. Do not make changes to code.',
  });

// 5. Build with context

const ctx: AgentContext = {
  flags: { askQuestionsEnabled: true, codebaseExplorationEnabled: true },
  mode: 'default',
  vars: { brandName: 'Anything', date: 'February 19, 2026' },
};

console.log('=== Base prompt ===\n');
console.log(base.build(ctx));

console.log('\n\n=== With exploration disabled ===\n');
console.log(base.build({ ...ctx, flags: { ...ctx.flags, codebaseExplorationEnabled: false } }));

console.log('\n\n=== Discussion mode ===\n');
console.log(discussionMode.build({ ...ctx, mode: 'discussion' }));

console.log('\n\n=== buildWithMeta ===\n');
const meta = base.buildWithMeta(ctx);
console.log('Included:', meta.included);
console.log('Excluded:', meta.excluded);
