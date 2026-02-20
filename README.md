# teleprompt

Compose LLM system prompts from discrete sections instead of monolithic template literals.

Conditional logic, variants, and prompt changes stay co-located with their content. Adding a new flag is one section in one file, not a boolean threaded through 15 function signatures.

```bash
pnpm add @anythingai/teleprompt
```

## Quick Start

```ts
import { PromptBuilder, type PromptContext, type PromptSection } from '@anythingai/teleprompt';

// Define your context shape
type MyFlags = { webSearchEnabled: boolean };
type MyVars = { assistantName: string };
type MyContext = PromptContext<MyFlags, MyVars>;

// Sections are objects with an id and a render function
const identity: PromptSection<MyContext> = {
  id: 'identity',
  render: (ctx) => `You are ${ctx.vars.assistantName}, a helpful AI assistant.`,
};

// This is a static section with no context dependencies
const guidelines: PromptSection<MyContext> = {
  id: 'guidelines',
  render: () => `# Guidelines
- Be concise and direct.
- Cite sources when making factual claims.
- Ask for clarification when a request is ambiguous.`,
};

// Conditional logic lives in the section, not threaded through function signatures
const webSearch: PromptSection<MyContext> = {
  id: 'web-search',
  when: (ctx) => ctx.flags.webSearchEnabled,
  render: () => `You have access to web search. Use it when the user asks about
current events or information that may have changed after your training cutoff.`,
};

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

A section has an `id`, a `render` function, and optionally a `when` guard:

```ts
const citation: PromptSection<MyContext> = {
  id: 'citation',
  when: (ctx) => ctx.flags.citationEnabled,   // excluded when false
  render: () => 'Always include citations with links when referencing external sources.',
};
```

Sections render in the order you call `.use()`. To reorder, change the call order.

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

You build the context once and pass it to `.build(ctx)`. Every section receives the same object — no threading booleans through function signatures.

## Builder API

```ts
new PromptBuilder<MyContext>()
  // append a section (replaces if same id exists)
  .use(section)

  // remove by section object or string id
  .without(section)

  // check existence by section object or string id
  .has(section)

  // list all section ids
  .ids()

  // independent copy
  .fork()

  // render to string
  .build(ctx)

  // render + debug info: { included: string[], excluded: string[] }
  .buildWithMeta(ctx)        
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
