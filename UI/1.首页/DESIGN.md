# Design System Specification

## 1. Overview & Creative North Star
### The Creative North Star: "The Precision Instrument"
This design system moves away from the "web-app" aesthetic and toward the feel of a high-end, calibrated physical tool—think of a Leica camera or a Swiss-engineered chronograph. While many developer tools feel cluttered or generic, this system achieves professional authority through **Atmospheric Density**.

We break the standard "box-in-a-box" layout by utilizing a high-information density that doesn't feel cramped. We achieve this through a "Chromeless" philosophy: functionality is prioritized through tonal shifts rather than structural lines, creating a workspace that feels like a single, continuous surface designed for deep focus.

---

## 2. Colors & Surface Philosophy

The palette is anchored in a sophisticated range of neutral grays that minimize eye strain during long diffing sessions, with high-intent semantic accents.

### Surface Hierarchy & The "No-Line" Rule
**Explicit Instruction:** 1px solid borders for sectioning are prohibited. 
Structural boundaries must be defined solely through background color shifts. This creates a more cohesive, integrated environment.
- **Base Layer:** Use `surface` (`#f7fafc`) for the global application backdrop.
- **Primary Workspaces:** Use `surface_container_lowest` (`#ffffff`) for code editors to provide maximum contrast for syntax.
- **Navigation/Sidebars:** Use `surface_container_low` (`#eff4f7`) to create a clear but soft distinction for file trees.
- **Utility Toolbars:** Use `surface_container_high` (`#dfeaef`) to anchor action buttons.

### Semantic Diffing Tokens
- **Additions:** `secondary` (`#006e40`) for text and `secondary_container` (`#91f8b8`) for line highlights.
- **Deletions:** `tertiary` (`#ba1d24`) for text and `tertiary_container` (`#fd4f4d`) for line highlights.
- **Changes/Modified:** `primary` (`#1960a3`) for text and `primary_container` (`#d3e4ff`) for line highlights.

### The "Glass & Gradient" Rule
To elevate the tool from "functional" to "premium," floating overlays (like command palettes or hover-modals) must use **Glassmorphism**. Apply a semi-transparent `surface_variant` with a 12px backdrop-blur. For primary Action CTAs, use a subtle linear gradient from `primary` to `primary_dim` to add "soul" and tactile depth.

---

## 3. Typography

The system utilizes a dual-font strategy to separate the *Application Interface* from the *Data Content*.

- **The Interface (Sans):** **Inter** is the standard. It provides exceptional legibility at small sizes (`label-sm`: 11px) required for high-density toolbars.
- **The Data (Monospace):** **JetBrains Mono** or **Fira Code**. These are used exclusively for code editors and file paths. Use `body-md` (14px) for code to ensure comfortable scanning.

### Hierarchy Roles
- **Display/Headline:** Rarely used in a utility-first tool, reserved for "Empty States" or "Welcome" screens.
- **Title-SM (16px):** Used for pane headers (e.g., "Left Branch," "Right Branch").
- **Label-MD/SM:** The workhorse of the UI. Used for button labels, file names in trees, and status bar metadata.

---

## 4. Elevation & Depth

### The Layering Principle
Instead of drop shadows, we use **Tonal Stacking**. An active tab or a selected file in a tree should be indicated by moving from `surface_container_low` to `surface_container_lowest`. This "lift" is perceived by the eye as a physical shift in depth.

### Ambient Shadows & Ghost Borders
- **Floating Modals:** Use an ultra-diffused shadow: `box-shadow: 0 10px 30px rgba(40, 52, 57, 0.08);`. 
- **The Ghost Border:** If a boundary is absolutely required for accessibility (e.g., separating two identical code panes), use `outline_variant` at **15% opacity**. Never use 100% opaque lines.

---

## 5. Components

### Multi-Pane Layouts (The Core)
Panes should be separated by a 4px "gutter" using the `surface_dim` (`#ccdde4`) color. This gutter acts as the draggable handle. Avoid any visible line inside this gutter; the color transition is the boundary.

### High-Density Toolbars
- **Action Buttons:** Small (24x24px) icons. State transitions:
    - **Idle:** No background.
    - **Hover:** `surface_container_highest` with `md` (0.375rem) roundedness.
    - **Active:** `primary_container` with `on_primary_container` icon color.
- **Spacing:** Use spacing scale `1.5` (0.3rem) between icons to maintain high density without accidental clicks.

### Tree Views & Lists
- **No Dividers:** Lists must never use horizontal lines. Use vertical white space (`spacing 1` or `1.5`) to separate items.
- **Selection:** Use `primary_fixed_dim` for the selected item background with a `sm` (0.125rem) rounded corner.

### Code Editors (Side-by-Side)
- **Gutter:** The line number gutter should be `surface_container_low`. 
- **The "Diff Bridge":** The center area between two panes should use `surface_container_highest` to house the "merge arrow" icons. Use `Glassmorphism` on these arrows when hovered to show they are interactive.

---

## 6. Do's and Don'ts

### Do
- **Do** use `surface_container` variations to group related logic (e.g., grouping "Search" and "Filter" tools on a distinct tonal island).
- **Do** prioritize the Monospace font for any text that is "output" or "data," even if it’s just a single version number.
- **Do** use `secondary` (green) and `tertiary` (red) sparingly. Only use them for actual diff logic, not for "Success" or "Error" messages in the general UI (use `primary` for those).

### Don't
- **Don't** use standard "Material Design" shadows. They are too heavy for a high-density desktop tool.
- **Don't** use rounded corners larger than `md` (0.375rem) for functional elements. Larger rounds (like `xl`) feel too "mobile/consumer" and waste screen real estate.
- **Don't** use 1px dividers. If the UI feels messy, increase the contrast between your `surface_container` layers instead of adding a line.