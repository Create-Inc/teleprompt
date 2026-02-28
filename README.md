# teleprompt

Compose LLM system prompts from discrete sections instead of monolithic template literals.

Conditional logic, variants, and prompt changes stay co-located with their content. Adding a new flag is one section in one file, not a boolean threaded through 15 function signatures.

```bash
pnpm add @anythingai/teleprompt
```

## Quick Start

```ts
import { PromptBuilder, section, type PromptContext } from '@anythingai/teleprompt';

// Define your context shape
type MyFlags = { webSearchEnabled: boolean };
type MyVars = { assistantName: string };
type MyContext = PromptContext<MyFlags, MyVars>;

// Static section — no context needed, no type parameter
const guidelines = section('guidelines', () => `# Guidelines
- Be concise and direct.
- Cite sources when making factual claims.
- Ask for clarification when a request is ambiguous.`);

// Dynamic section — uses context
const identity = section('identity', (ctx: MyContext) =>
  `You are ${ctx.vars.assistantName}, a helpful AI assistant.`
);

// Conditional section — return null to exclude
const webSearch = section('web-search', (ctx: MyContext) => {
  if (!ctx.flags.webSearchEnabled) return null;
  return `You have access to web search. Use it when the user asks about
current events or information that may have changed after your training cutoff.`;
});

// Compose and build
const prompt = new PromptBuilder<MyContext>()
  .use(identity)
  .use(guidelines)
  .use(webSearch)
  .build({
    flags: { webSearchEnabled: true },
    vars: { assistantName: 'Daniel' },
  });
```

## Sections

Create sections with the `section()` helper. Return a string to include, `null` to exclude:

```ts
// Always included
const rules = section('rules', () => 'Be helpful and concise.');

// Conditional — null means excluded
const citation = section('citation', (ctx: MyContext) => {
  if (!ctx.flags.citationEnabled) return null;
  return 'Always include citations with links when referencing external sources.';
});
```

Sections render in the order you call `.use()`. To reorder, change the call order.

Static sections (no type parameter) work in any builder — you don't need to match the builder's context type:

```ts
const disclaimer = section('disclaimer', () => 'Responses are not legal advice.');

// Works in any builder regardless of context type
new PromptBuilder<MyContext>().use(disclaimer)
new PromptBuilder<OtherContext>().use(disclaimer)
```

## Mutually Exclusive Sections

Use `.useOneOf()` when exactly one of several sections should render. The first candidate that returns a non-empty string wins:

```ts
const hasTasks = section('has-tasks', (ctx: MyContext) => {
  if (ctx.vars.tasks.length === 0) return null;
  return `## Active Tasks\n\n${ctx.vars.tasks.map(t => `- ${t.title}`).join('\n')}`;
});

const noTasks = section('no-tasks', () => '## Active Tasks\n\nNo tasks currently running.');

builder.useOneOf(hasTasks, noTasks);
```

## Groups

Group related sections together. In text mode, groups are transparent. In XML mode, they wrap children in tags:

```ts
const prompt = new PromptBuilder<MyContext>()
  .use(identity)
  .group('tools', b => b
    .use(webSearch)
    .use(calculator)
  )
  .use(guidelines)
  .build(ctx, { format: 'xml' });

// <identity>
// You are Daniel, a helpful AI assistant.
// </identity>
//
// <tools>
// <web-search>
// You have access to web search...
// </web-search>
//
// <calculator>
// You can evaluate math expressions...
// </calculator>
// </tools>
//
// <guidelines>
// # Guidelines
// ...
// </guidelines>
```

Groups can be nested:

```ts
builder.group('capabilities', b => b
  .group('tools', b => b
    .use(webSearch)
    .use(calculator)
  )
  .group('integrations', b => b
    .use(slack)
    .use(linear)
  )
)
```

## XML Format

Both Claude and Gemini recommend structuring prompts with XML tags. Pass `{ format: 'xml' }` to `.build()` to wrap each section in `<id>` tags:

```ts
builder.build(ctx, { format: 'xml' })
```

The section `id` becomes the tag name. Content is not indented or escaped — tags are structural delimiters for the model, not strict XML.

## Forking

Create variants without duplicating prompt code:

```ts
const base = new PromptBuilder<MyContext>()
  .use(identity)
  .use(guidelines)
  .use(tone);

// Customer support agent — adds escalation rules
const supportAgent = base.fork()
  .use(escalationPolicy)
  .use(ticketFormat);

// Code assistant — swaps guidelines, drops tone
const codeAssistant = base.fork()
  .without(guidelines)
  .without(tone)
  .use(codingGuidelines)
  .use(outputFormat);
```

Each fork is independent. Modifying one doesn't affect the others.

## Context

Sections receive a typed context with boolean flags and arbitrary variables:

```ts
type MyFlags = {
  webSearchEnabled: boolean;
  citationEnabled: boolean;
};

type MyVars = {
  assistantName: string;
  language: string;
};

type MyContext = PromptContext<MyFlags, MyVars>;
```

Both `PromptContext` and `PromptBuilder` have defaults, so you can skip the type parameter for simple cases:

```ts
// No context needed
const builder = new PromptBuilder();
```

You build the context once and pass it to `.build(ctx)`. Every section receives the same object — no threading booleans through function signatures.

## Builder API

```ts
new PromptBuilder<MyContext>()
  .use(section)                      // append (replaces if same id)
  .useOneOf(sectionA, sectionB)      // first match wins
  .group('name', b => b.use(...))    // named group (XML wrapper)
  .without(section)                  // remove by object or string id
  .has(section)                      // check existence
  .ids()                             // list all section ids
  .fork()                            // independent copy
  .build(ctx)                        // render to string
  .build(ctx, { format: 'xml' })     // render with XML tags
  .buildWithMeta(ctx)                // render + { included, excluded }
```

## Testing

```ts
import { mockContext, renderSection } from '@anythingai/teleprompt/testing';

// Render a section in isolation
const output = renderSection(webSearch, { flags: { webSearchEnabled: true } });
expect(output).toContain('web search');

// Assert on prompt structure
const { included, excluded } = builder.buildWithMeta(ctx);
expect(included).toContain('web-search');
expect(excluded).toContain('citation');
```

## License

MIT
