# Theming contract

**Theming is the ONLY place per-client variation is allowed.** Everything else — schema,
RPCs, RLS, reference logic — is identical across clients. An agent themes a build by filling
*one* tokens block and a font pair + logo; it must not fork component logic to restyle.

## Build input: the brand brief

Ask for (or extract from an existing site) before scaffolding. **No brief → ask; do not invent
a palette.**

```
brand:
  primary:    "#<hex>"   # main brand color (headings, primary actions)
  secondary:  "#<hex>"   # supporting accent (links, focus rings, time chips)
  accent:     "#<hex>"   # call-to-action ("btn-accent")
  supporting: "#<hex>"   # success / confirmation surfaces
  radius:     "0.75rem"  # global corner rounding
fonts:
  heading: "<family>"    # e.g. "Poppins"
  body:    "<family>"    # e.g. "Inter"
  # optional: a script font for a second language (the reference uses font-bangla)
logo:
  path: "/logo.svg"      # placed in the app's public/ ; referenced by the Layout
tone: "<one line>"       # voice for headings/microcopy (gentle, clinical, playful, …)
```

## The token block (shadcn / Tailwind v4)

Fill `:root` in the app's global stylesheet. These names are what the reference components
(`reference/site`, `reference/admin`) already reference — change the **values**, not the names.

```css
:root {
  /* brand — from the brief */
  --primary: <hex>;            --primary-foreground: #fff;
  --secondary: <hex>;          --secondary-foreground: #fff;
  --accent: <hex>;             --accent-foreground: #fff;
  --color-supporting: <hex>;   --supporting-foreground: #fff;

  /* neutrals (sensible defaults; tweak only if the brief demands) */
  --background: #ffffff;       --foreground: #1a1a1a;
  --surface: #f7f7f8;
  --muted-foreground: #6b7280; --border: #e5e7eb;
  --input: #e5e7eb;            --destructive: #dc2626;

  --radius: 0.75rem;
}
```

Tailwind v4: expose these via `@theme` so utilities like `text-primary`, `bg-secondary`,
`border-border` resolve. Fonts: bind `--font-heading` / `--font-body` and load them
(`next/font`, `@fontsource`, or a `<link>`), exposing a `font-heading` utility.

## Component-side contract (do not rename)

The reference code assumes these exist; provide them once in CSS:

| Token / class | Used for |
|---|---|
| `--primary` / `text-primary` | headings, hero, section titles |
| `--secondary` | links, focus ring, time-slot chips |
| `--accent` / `.btn-accent` | the primary CTA button |
| `--color-supporting` / `text-supporting` | success states (booking confirmed) |
| `.card-soft` | the soft rounded card surface used throughout |
| `--radius`, `--border`, `--input`, `--background`, `--foreground`, `--muted-foreground` | shadcn primitives |
| `font-heading` (+ optional second-language font class) | display type |

`.btn-accent` and `.card-soft` are the two project utility classes the reference relies on;
define them once against the tokens (e.g. `.btn-accent { background: var(--accent); color: var(--accent-foreground); border-radius: var(--radius); padding: .65rem 1.1rem; font-weight: 600; }`).

That's the entire surface. If a client wants a structurally different layout, that's a custom
job — the kit's promise is *same system, re-themed*, not *any design*.
