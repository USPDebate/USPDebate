# Modern Design System Integration

**Source:** `design-skills-repo/skills/modern/`  
**Brand:** "Ship software peacefully"  
**Style:** Contemporary editorial, serif typography, minimal palettes, clean layouts

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#553F83` | Purple; main brand color, CTAs, headers |
| Secondary | `#111111` | Black; text, borders, secondary elements |
| Success | `#16A34A` | Green; positive feedback (accepted presence, etc.) |
| Warning | `#D97706` | Amber; caution states (pending draws, etc.) |
| Danger | `#DC2626` | Red; destructive actions, errors |
| Surface | `#553F83` | Same as primary; backgrounds, panels |
| Text | `#ffffff` | White; text on dark backgrounds |

## Typography

### Fonts
- **Serif (IBM Plex Serif):** Headings, body text, editorial content
  - Weights: 100–900
- **Mono (JetBrains Mono):** Labels, captions, code, numbers

### Scale (px)
```
--text-xs:   0.75rem  (12px)   — labels, captions
--text-sm:   0.875rem (14px)   — small text
--text-base: 1rem     (16px)   — body text
--text-lg:   1.25rem  (20px)   — subheadings
--text-xl:   1.5rem   (24px)   — headings
--text-2xl:  2rem     (32px)   — hero headings
```

### Usage Classes
```html
<!-- Large heading -->
<h1 class="text-modern-h1">Tournament Results</h1>

<!-- Body text -->
<p class="text-modern-body">Registration details here</p>

<!-- Labels (caps, mono) -->
<span class="text-modern-label">Room 1</span>
```

## Spacing Scale

```
--space-xs:  4px
--space-sm:  8px
--space-md:  12px
--space-base: 16px
--space-lg:  24px
--space-xl:  32px
```

### Usage Classes
```html
<div class="p-base gap-md">
  <!-- padding: 16px, gaps: 12px -->
</div>
```

## Border Radius

```
--radius-sm: 4px   — subtle corners
--radius-md: 8px   — standard corners
```

## Implementation Examples

### Modern Button
```jsx
<button className="bg-modern-primary text-white px-base py-sm rounded-md 
  text-modern-label focus-modern hover:bg-modern-secondary transition">
  Register
</button>
```

### Modern Card
```jsx
<div className="bg-modern-secondary p-lg rounded-md border-l-4 border-modern-primary">
  <h3 className="text-modern-h1 text-white mb-md">Draw Results</h3>
  <p className="text-modern-body text-gray-300">...</p>
</div>
```

### Modern Form
```jsx
<label className="text-modern-label text-modern-secondary block mb-sm">
  Speaker Name
</label>
<input 
  type="text" 
  className="w-full bg-white text-modern-secondary p-base rounded-md
    border-2 border-modern-primary focus:outline-none focus-modern"
  placeholder="Enter name"
/>
```

## Accessibility (WCAG 2.2 AA)

✓ Keyboard-first interactions  
✓ Visible focus states (2px outline, 2px offset)  
✓ Sufficient color contrast  
✓ Semantic HTML  
✓ Reduced motion support (`prefers-reduced-motion`)

### Focus States
All interactive elements get:
```css
outline: 2px solid var(--modern-primary);
outline-offset: 2px;
```

## Migration Path

### Current site uses:
- `--bordo` (#c14059), `--gold` (#cda963)
- `--bg` (#161113), dark theme

### To adopt Modern design:

**Option 1: Full migration** — Replace globals.css colors with Modern palette  
**Option 2: Blended** — Keep current aesthetic, add Modern for new components  
**Option 3: Hybrid** — Modern typography (serif headers), keep current colors

### Recommended for USPD site:
**Blended approach:**
- Use Modern typography (IBM Plex Serif for headings)
- Keep dark theme (`--bg`, `--surface`)
- Replace accent colors with Modern palette:
  - `--bordo` → `#553F83` (Modern primary)
  - `--gold` → `#D97706` (Modern warning)
  - `--success` → `#16A34A` (Modern success)

## Files

- `src/app/design-tokens-modern.css` — CSS variables, utilities, presets
- `src/app/layout.jsx` — Font imports (IBM Plex Serif, JetBrains Mono)

## References

- Full skill: `design-skills-repo/skills/modern/SKILL.md`
- Design intent: `design-skills-repo/skills/modern/DESIGN.md`
- Curated skills: `design-skills-repo/skills/*/`
