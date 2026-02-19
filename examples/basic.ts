import { PromptBuilder, type PromptContext, type PromptSection } from '../src';

// 1. Define your context shape

type MyFlags = {
  webSearchEnabled: boolean;
  verboseEnabled: boolean;
};

type MyVars = {
  assistantName: string;
  mode: string;
  date: string;
};

type MyContext = PromptContext<MyFlags, MyVars>;

// 2. Define sections

const identity: PromptSection<MyContext> = {
  id: 'identity',
  render: (ctx) => `You are ${ctx.vars.assistantName}, a helpful AI assistant.`,
};

const guidelines: PromptSection<MyContext> = {
  id: 'guidelines',
  render: () => `# Guidelines
- Be concise and direct.
- Cite sources when making factual claims.
- Ask for clarification when a request is ambiguous.`,
};

const verboseMode: PromptSection<MyContext> = {
  id: 'verbose',
  render: (ctx) =>
    ctx.flags.verboseEnabled
      ? 'Provide detailed, step-by-step explanations with examples.'
      : 'Keep responses short and to the point.',
};

const webSearch: PromptSection<MyContext> = {
  id: 'web-search',
  when: (ctx) => ctx.flags.webSearchEnabled,
  render: () => `# Web Search
You have access to web search. Use it when the user asks about
current events or information that may be outdated.`,
};

const tone: PromptSection<MyContext> = {
  id: 'tone',
  render: () => `# Tone
- Be friendly but professional.
- Avoid jargon unless the user uses it first.`,
};

const date: PromptSection<MyContext> = {
  id: 'date',
  render: (ctx) => `Today's date is ${ctx.vars.date}.`,
};

// 3. Compose a base prompt

const base = new PromptBuilder<MyContext>()
  .use(identity)
  .use(guidelines)
  .use(verboseMode)
  .use(webSearch)
  .use(tone)
  .use(date);

// 4. Fork for variants

const readOnly: PromptSection<MyContext> = {
  id: 'read-only',
  when: (ctx) => ctx.vars.mode === 'read-only',
  render: () => 'You are in read-only mode. Answer questions but do not take any actions.',
};

const readOnlyMode = base
  .fork()
  .without(tone) // or `.without('tone')`
  .use(readOnly);

// 5. Build with context

const ctx: MyContext = {
  flags: { webSearchEnabled: true, verboseEnabled: false },
  vars: { assistantName: 'Daniel', mode: 'default', date: 'February 19, 2026' },
};

console.log('=== Base prompt ===\n');
console.log(base.build(ctx));

console.log('\n\n=== With web search disabled ===\n');
console.log(base.build({ ...ctx, flags: { ...ctx.flags, webSearchEnabled: false } }));

console.log('\n\n=== Read-only mode ===\n');
console.log(readOnlyMode.build({ ...ctx, vars: { ...ctx.vars, mode: 'read-only' } }));

console.log('\n\n=== Debugging ===\n');
const meta = base.buildWithMeta(ctx);
console.log('Included:', meta.included);
console.log('Excluded:', meta.excluded);
