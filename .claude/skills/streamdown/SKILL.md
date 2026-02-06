---
name: streamdown
description: |
  Streamdown is a Vercel open-source React component for rendering AI-streamed Markdown content. Use when: (1) implementing chat UI with streaming AI responses, (2) rendering Markdown from AI models with incomplete/unterminated syntax, (3) adding code highlighting, math (KaTeX), or Mermaid diagrams to AI output, (4) debugging Streamdown rendering issues, (5) configuring Streamdown plugins or custom components. Triggers on: streaming markdown, AI chat rendering, react-markdown replacement, Shiki highlighting, mermaid diagrams, KaTeX math, CJK text handling.
---

# Streamdown v2.x

Drop-in replacement for `react-markdown` optimized for AI-powered streaming. Handles incomplete Markdown gracefully during token-by-token generation.

## Installation

```bash
pnpm add streamdown @streamdown/code @streamdown/mermaid @streamdown/math
# Optional: @streamdown/cjk for CJK language support
```

Update `globals.css` for Tailwind:

```css
@source "../node_modules/streamdown/dist/*.js";
```

## Basic Usage

```tsx
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";

<Streamdown plugins={{ code, mermaid, math }} isAnimating={isStreaming}>
  {markdownContent}
</Streamdown>;
```

## Props Reference

| Prop                      | Type                           | Default                           | Description                                          |
| ------------------------- | ------------------------------ | --------------------------------- | ---------------------------------------------------- |
| `children`                | `string`                       | -                                 | Markdown content to render                           |
| `isAnimating`             | `boolean`                      | `false`                           | Enable streaming mode (incomplete markdown handling) |
| `plugins`                 | `PluginConfig`                 | `{}`                              | Code, mermaid, math, cjk plugins                     |
| `components`              | `Components`                   | `{}`                              | Custom React components for elements                 |
| `controls`                | `ControlsConfig`               | `true`                            | Show/hide interactive controls                       |
| `mermaid`                 | `MermaidOptions`               | -                                 | Mermaid diagram configuration                        |
| `caret`                   | `"block" \| "circle"`          | -                                 | Streaming cursor style                               |
| `className`               | `string`                       | -                                 | Container CSS class                                  |
| `shikiTheme`              | `[BundledTheme, BundledTheme]` | `["github-light", "github-dark"]` | Shiki themes [light, dark]                           |
| `linkSafety`              | `LinkSafetyConfig`             | -                                 | External link confirmation modal                     |
| `remend`                  | `RemendOptions`                | -                                 | Incomplete markdown parsing options                  |
| `parseIncompleteMarkdown` | `boolean`                      | `true`                            | Use remend for streaming                             |

## Plugins

### Code Plugin (@streamdown/code)

Shiki-powered syntax highlighting with copy/download buttons.

```tsx
import { code, createCodePlugin } from "@streamdown/code";

// Default
plugins={{ code }}

// Custom themes
const customCode = createCodePlugin({
  themes: ["one-dark-pro", "one-light"]
});
plugins={{ code: customCode }}
```

### Math Plugin (@streamdown/math)

KaTeX rendering for LaTeX equations.

```tsx
import { math, createMathPlugin } from "@streamdown/math";
import "katex/dist/katex.min.css"; // Required!

// Default
plugins={{ math }}

// Enable single $ for inline math
const customMath = createMathPlugin({
  singleDollarTextMath: true,
  errorColor: "#ff0000"
});
plugins={{ math: customMath }}
```

Syntax:

- Inline: `$E = mc^2$` or `\\(E = mc^2\\)`
- Block: `$$\sum_{i=1}^n x_i$$` or `\\[...\\]`

### Mermaid Plugin (@streamdown/mermaid)

Interactive diagram rendering.

```tsx
import { mermaid, createMermaidPlugin } from "@streamdown/mermaid";

plugins={{ mermaid }}

// With config prop
<Streamdown
  plugins={{ mermaid }}
  mermaid={{
    config: {
      theme: "base",
      themeVariables: {
        primaryColor: "#73000a",
        primaryTextColor: "#ffffff",
      }
    },
    errorComponent: MyErrorComponent
  }}
>
```

### CJK Plugin (@streamdown/cjk)

> **WARNING**: This project disabled CJK due to English text corruption. Only use if CJK language support is required.

```tsx
import { cjk } from "@streamdown/cjk";
plugins={{ cjk }}
```

## Custom Components

Override default HTML element rendering:

```tsx
const components: Components = {
  code({ className, children, ...props }) {
    const language = className?.match(/language-(\w+)/)?.[1];
    if (language) {
      return (
        <SyntaxHighlighter language={language}>{children}</SyntaxHighlighter>
      );
    }
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  },

  pre({ children }) {
    return <>{children}</>; // Let code handle wrapping
  },

  a({ href, children, ...props }) {
    const isExternal = href?.startsWith("http");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },

  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">{children}</table>
      </div>
    );
  },
};

<Streamdown components={components}>...</Streamdown>;
```

## Controls Configuration

```tsx
// Enable all (default)
controls={true}

// Disable all
controls={false}

// Selective
controls={{
  table: true,      // Table copy/download
  code: true,       // Code copy/download
  mermaid: {
    download: true,
    copy: true,
    fullscreen: true,
    panZoom: true
  }
}}
```

## Link Safety

Confirmation modal for external links:

```tsx
<Streamdown
  linkSafety={{
    enabled: true,
    onLinkCheck: async (url) => {
      // Return true to auto-allow, false to show modal
      return url.startsWith("https://trusted-domain.com");
    },
    renderModal: ({ url, isOpen, onClose, onConfirm }) => (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <p>Open external link: {url}?</p>
          <Button onClick={onConfirm}>Continue</Button>
        </DialogContent>
      </Dialog>
    )
  }}
>
```

## Streaming Best Practices

### Error Boundary Pattern

Wrap Streamdown in an error boundary for graceful fallback:

```tsx
class StreamdownErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <pre className="whitespace-pre-wrap">{this.props.fallback}</pre>;
    }
    return this.props.children;
  }
}

<StreamdownErrorBoundary fallback={rawContent}>
  <Streamdown isAnimating={isStreaming}>{content}</Streamdown>
</StreamdownErrorBoundary>;
```

### Post-Stream Cleanup

Clean incomplete markers when streaming ends:

```tsx
const processedContent = useMemo(() => {
  if (isStreaming || !content?.trim()) return content;

  let cleaned = content;
  // Remove trailing incomplete bold/italic
  cleaned = cleaned.replace(/\s*\*{1,2}\s*$/, "");
  // Balance orphaned **
  const boldMatches = cleaned.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    cleaned = cleaned.replace(/\*\*(\s*)$/, "$1");
  }
  return cleaned;
}, [content, isStreaming]);
```

### Lazy Loading

Reduce initial bundle size:

```tsx
const StreamdownContent = lazy(() =>
  import("./streamdown-content").then((mod) => ({
    default: mod.StreamdownContent,
  })),
);

<Suspense fallback={<PlainTextFallback content={content} />}>
  <StreamdownContent content={content} isStreaming={isStreaming} />
</Suspense>;
```

## Common Issues

### CJK Plugin Corrupts English Text

**Symptom**: Random Chinese characters like "落" appear in English text.
**Solution**: Remove `@streamdown/cjk` plugin unless CJK support is required.

### Mermaid Diagrams Crash

**Symptom**: Invalid mermaid syntax causes render error.
**Solution**: Use error boundary with fallback + custom errorComponent prop.

### Math Not Rendering

**Symptom**: Raw LaTeX syntax displayed.
**Solution**: Ensure `katex/dist/katex.min.css` is imported.

### Code Blocks Unstyled

**Symptom**: Code blocks have no syntax highlighting.
**Solution**: Add `@source` directive in globals.css and use `@streamdown/code` plugin.

### Streaming Markers Persist

**Symptom**: Trailing `**` or `*` visible after streaming ends.
**Solution**: Implement post-stream content cleanup (see pattern above).

### Malformed Nested Bold

**Symptom**: Raw `**` appears before keywords in bullet points, e.g., `**The P-O-L-C **Framework**:`.
**Cause**: AI model tries to emphasize a keyword within already-bold text, creating invalid nested markdown.
**Solution**: Add cleanup regex in post-stream processing:

```tsx
// Fix malformed nested bold: "**prefix **keyword**:" → "**prefix keyword**:"
cleaned = cleaned.replace(/\*\*([^*]+)\s\*\*(\w+)\*\*(:?)/g, "**$1 $2**$3");
```

## TypeScript Types

```tsx
import type {
  StreamdownProps,
  Components,
  PluginConfig,
  ControlsConfig,
  MermaidOptions,
  LinkSafetyConfig,
  CodeHighlighterPlugin,
  DiagramPlugin,
  MathPlugin,
  CjkPlugin,
} from "streamdown";

import type { BundledLanguage, BundledTheme } from "shiki";
```

## Integration with AI SDK

```tsx
import { useChat } from "@ai-sdk/react";

export function Chat() {
  const { messages, status } = useChat();
  const isStreaming = status === "streaming";

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) =>
            part.type === "text" ? (
              <Streamdown
                key={i}
                plugins={{ code, mermaid, math }}
                isAnimating={isStreaming && i === message.parts.length - 1}
              >
                {part.text}
              </Streamdown>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}
```

For project-specific implementation patterns, see `components/ui/streamdown-content.tsx`.
