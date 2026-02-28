import { PromptBuilder, type PromptContext, section } from './src';

type Flags = {
  webSearchEnabled: boolean;
  verbose: boolean;
};

type Vars = {
  name: string;
  tasks: { title: string; status: string }[];
  date: string;
};

type Ctx = PromptContext<Flags, Vars>;

const identity = section(
  'identity',
  (ctx: Ctx) => `You are ${ctx.vars.name}, a helpful AI assistant.`,
);

const guidelines = section(
  'guidelines',
  () => `# Guidelines
- Be concise and direct.
- Cite sources when making factual claims.
- Ask for clarification when a request is ambiguous.`,
);

const verbose = section('verbose', (ctx: Ctx) => {
  if (!ctx.flags.verbose) return null;
  return 'Provide detailed, step-by-step explanations with examples.';
});

const webSearch = section('web-search', (ctx: Ctx) => {
  if (!ctx.flags.webSearchEnabled) return null;
  return 'You have access to web search. Use it for current events or information that may be outdated.';
});

const hasTasks = section('has-tasks', (ctx: Ctx) => {
  if (ctx.vars.tasks.length === 0) return null;
  const lines = ctx.vars.tasks.map((t) => `- ${t.title} [${t.status}]`);
  return `## Active Tasks\n\n${lines.join('\n')}`;
});

const noTasks = section('no-tasks', (ctx: Ctx) => {
  if (ctx.vars.tasks.length > 0) return null;
  return '## Active Tasks\n\nNo tasks currently running.';
});

const date = section('date', (ctx: Ctx) => `Today's date is ${ctx.vars.date}.`);

const builder = new PromptBuilder<Ctx>()
  .use(identity)
  .use(guidelines)
  .use(verbose)
  .group('tools', (b) => b.use(webSearch))
  .useOneOf(hasTasks, noTasks)
  .use(date);

const ctx: Ctx = {
  flags: { webSearchEnabled: true, verbose: false },
  vars: {
    name: 'Daniel',
    tasks: [
      { title: 'Fix auth bug', status: 'in_progress' },
      { title: 'Update docs', status: 'pending' },
    ],
    date: 'February 28, 2026',
  },
};

console.log('=== text ===\n');
console.log(builder.build(ctx));

console.log('\n\n=== xml ===\n');
console.log(builder.build(ctx, { format: 'xml' }));

console.log('\n\n=== no tasks, verbose on, web search off ===\n');
console.log(
  builder.build(
    { ...ctx, flags: { webSearchEnabled: false, verbose: true }, vars: { ...ctx.vars, tasks: [] } },
    { format: 'xml' },
  ),
);

console.log('\n\n=== fork ===\n');
const minimal = builder.fork().without('guidelines').without('tools');
console.log(minimal.build(ctx, { format: 'xml' }));

console.log('\n\n=== metadata ===\n');
const meta = builder.buildWithMeta(ctx);
console.log('included:', meta.included);
console.log('excluded:', meta.excluded);
