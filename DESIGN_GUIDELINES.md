# Design Guidelines

A comprehensive design system guide for maintaining consistent styling across the application. Based on the professional mobile-first design implemented in the Dashboard Generation and Schedules modules.

---

## Table of Contents

1. [Color Palette](#color-palette)
2. [CSS Variables](#css-variables)
3. [Typography](#typography)
4. [Cards & Containers](#cards--containers)
5. [Buttons](#buttons)
6. [Badges & Status Indicators](#badges--status-indicators)
7. [Form Elements](#form-elements)
8. [Modals](#modals)
9. [Animations](#animations)
10. [Responsive Design](#responsive-design)
11. [Code Examples](#code-examples)

---

## Color Palette

### Primary Colors (Purple Theme)

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | `#8240FF` | Main accent, active states, focus rings |
| Primary Light | `#D2B8FF` | Text on dark, hover states, icons |
| Primary Gradient | `linear-gradient(135deg, #D2B8FF 0%, #8240FF 100%)` | Buttons, active segments, badges |

### Background Colors

| Color | Hex/Value | Usage |
|-------|-----------|-------|
| Background Primary | `#0f0f1a` | Page background |
| Card Background | `rgba(255, 255, 255, 0.04)` | Cards, containers |
| Card Hover | `rgba(255, 255, 255, 0.08)` | Card hover state |
| Input Background | `rgba(255, 255, 255, 0.06)` | Form inputs |

### Border Colors

| Color | Value | Usage |
|-------|-------|-------|
| Default Border | `rgba(255, 255, 255, 0.08)` | Cards, dividers |
| Hover Border | `rgba(130, 64, 255, 0.4)` | Interactive hover |
| Focus Border | `#8240FF` | Input focus |

### Text Colors

| Color | Value | Usage |
|-------|-------|-------|
| Text Primary | `#ffffff` | Headings, important text |
| Text Secondary | `rgba(255, 255, 255, 0.7)` | Body text, labels |
| Text Muted | `rgba(255, 255, 255, 0.5)` | Helper text, placeholders |

### Semantic Colors

| Status | Color | Background |
|--------|-------|------------|
| Success | `#34d399` | `rgba(16, 185, 129, 0.15)` |
| Warning | `#fbbf24` | `rgba(245, 158, 11, 0.15)` |
| Danger | `#f87171` | `rgba(239, 68, 68, 0.15)` |
| Info | `#60a5fa` | `rgba(59, 130, 246, 0.15)` |

---

## CSS Variables

Add these CSS variables to your stylesheet root:

```css
:root {
  /* Primary Colors */
  --primary: #8240FF;
  --primary-light: #D2B8FF;
  --primary-gradient: linear-gradient(135deg, #D2B8FF 0%, #8240FF 100%);

  /* Background Colors */
  --bg-primary: #0f0f1a;
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-card-hover: rgba(255, 255, 255, 0.08);
  --bg-input: rgba(255, 255, 255, 0.06);

  /* Border Colors */
  --border: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(130, 64, 255, 0.4);

  /* Text Colors */
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-muted: rgba(255, 255, 255, 0.5);

  /* Semantic Colors */
  --success: #10b981;
  --success-light: #34d399;
  --warning: #f59e0b;
  --warning-light: #fbbf24;
  --danger: #ef4444;
  --danger-light: #f87171;
  --info: #3b82f6;
  --info-light: #60a5fa;
}
```

---

## Typography

### Font Sizes

| Element | Size | Weight |
|---------|------|--------|
| Page Title (h1) | `1.75rem` | 700 |
| Section Title (h2) | `1.5rem` | 600 |
| Card Title (h6) | `1rem` | 500 |
| Body Text | `0.95rem` | 400 |
| Small Text | `0.85rem` | 400 |
| Labels | `0.8rem` | 600 |
| Badges | `0.7rem` | 600 |

### Label Styling

```css
.form-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

/* Uppercase label variant */
.form-label-uppercase {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-weight: 600;
}
```

---

## Cards & Containers

### Standard Card

```css
.card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  border-color: var(--border-hover);
  box-shadow: 0 12px 32px rgba(130, 64, 255, 0.2);
}

.card-header {
  background: transparent;
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.25rem;
}

.card-body {
  padding: 1.25rem;
}

.card-footer {
  background: transparent;
  border-top: 1px solid var(--border);
  padding: 1rem 1.25rem;
}
```

### Stats Card with Accent

```css
.stats-card {
  position: relative;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  overflow: hidden;
}

/* Gradient accent bar at top */
.stats-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--card-accent, var(--primary-gradient));
  opacity: 0.8;
}

/* Variants */
.stats-card.primary { --card-accent: var(--primary-gradient); }
.stats-card.success { --card-accent: linear-gradient(135deg, #34d399 0%, #10b981 100%); }
.stats-card.warning { --card-accent: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
.stats-card.info { --card-accent: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); }
```

### Filter/Container Card

```css
.filter-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}
```

---

## Buttons

### Primary Button (Gradient)

```css
.btn-primary {
  background: var(--primary-gradient);
  border: none;
  color: #fff;
  font-weight: 500;
  padding: 0.625rem 1.25rem;
  border-radius: 12px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(130, 64, 255, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(130, 64, 255, 0.4);
}
```

### Secondary Button (Outline)

```css
.btn-secondary,
.btn-outline-secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-secondary);
  font-weight: 500;
  padding: 0.625rem 1.25rem;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.btn-secondary:hover,
.btn-outline-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--primary);
  color: var(--primary-light);
}
```

### Icon Button

```css
.btn-icon {
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

/* Color variants */
.btn-icon.primary {
  background: transparent;
  border: 1px solid rgba(130, 64, 255, 0.4);
  color: var(--primary-light);
}

.btn-icon.primary:hover {
  background: rgba(130, 64, 255, 0.2);
  border-color: var(--primary);
}

.btn-icon.success {
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.btn-icon.success:hover {
  background: rgba(16, 185, 129, 0.2);
}

.btn-icon.warning {
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.btn-icon.warning:hover {
  background: rgba(245, 158, 11, 0.2);
}

.btn-icon.danger {
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.btn-icon.danger:hover {
  background: rgba(239, 68, 68, 0.2);
}
```

---

## Badges & Status Indicators

### Type Badge (Pill Style)

```css
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.type-badge.primary {
  background: rgba(130, 64, 255, 0.15);
  color: var(--primary-light);
}

.type-badge.secondary {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}
```

### Status Badge

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.pending {
  background: rgba(130, 64, 255, 0.2);
  color: var(--primary-light);
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.status-badge.paused {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.status-badge.completed {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
```

---

## Form Elements

### Text Input / Textarea

```css
.form-control {
  background: var(--bg-input);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: var(--text-primary);
  padding: 0.75rem 1rem;
  transition: all 0.2s ease;
}

.form-control:focus {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(130, 64, 255, 0.15);
  outline: none;
}

.form-control::placeholder {
  color: var(--text-muted);
}
```

### Select Dropdown

```css
.form-select {
  background: var(--bg-input);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 0.625rem 1rem;
  transition: all 0.2s ease;
}

.form-select:focus {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(130, 64, 255, 0.15);
  outline: none;
}

.form-select option {
  background: #1a1a2e;
  color: var(--text-primary);
}
```

### Checkbox

```css
.form-check-input {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  width: 1.1em;
  height: 1.1em;
}

.form-check-input:checked {
  background-color: var(--primary);
  border-color: var(--primary);
}

.form-check-input:focus {
  box-shadow: 0 0 0 3px rgba(130, 64, 255, 0.15);
}

.form-check-label {
  color: var(--text-secondary);
}
```

### Segmented Control

```css
.segmented-control {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14px;
  padding: 4px;
  gap: 4px;
}

.segmented-control .btn-check {
  display: none;
}

.segmented-control .segment-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1rem;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.25s ease;
}

.segmented-control .segment-btn i {
  font-size: 1.35rem;
  margin-bottom: 0.35rem;
}

.segmented-control .segment-btn span {
  font-size: 0.8rem;
  font-weight: 500;
}

.segmented-control .btn-check:checked + .segment-btn {
  background: var(--primary-gradient);
  color: #fff;
  box-shadow: 0 4px 12px rgba(130, 64, 255, 0.4);
}

.segmented-control .segment-btn:hover:not(.btn-check:checked + .segment-btn) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}
```

---

## Modals

### Modal Container

```css
.modal-content {
  background: rgba(15, 15, 26, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
}

.modal-header {
  background: transparent;
  border-bottom: 1px solid var(--border);
  padding: 1.25rem 1.5rem;
}

.modal-title {
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-title i {
  color: var(--primary-light);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  background: transparent;
  border-top: 1px solid var(--border);
  padding: 1rem 1.5rem;
}
```

### Custom Scrollbar

```css
.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(130, 64, 255, 0.3);
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(130, 64, 255, 0.5);
}
```

---

## Animations

### Fade In Up

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.3s ease;
}
```

### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease;
}
```

### Dropdown Fade In

```css
@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Loading Pulse

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### Shimmer (Loading State)

```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.loading-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Spinner

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(130, 64, 255, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile | < 576px | Single column, stacked layouts |
| Tablet | 576px - 768px | 2 columns, adjusted spacing |
| Desktop | > 768px | Full layout |
| Large Desktop | > 1024px | Maximum width constraints |

### Mobile-First Grid Example

```css
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### Touch-Friendly Targets

```css
@media (pointer: coarse) {
  .btn,
  .interactive-element {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### Safe Area Insets (iOS)

```css
.page {
  padding-bottom: env(safe-area-inset-bottom);
}

.fixed-bottom-bar {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
```

### Responsive Typography

```css
@media (max-width: 768px) {
  h1 { font-size: 1.5rem; }
  .btn {
    font-size: 0.85rem;
    padding: 0.5rem 1rem;
  }
}
```

---

## Code Examples

### Complete Card Component

```html
<div class="card">
  <div class="card-header">
    <span class="type-badge primary">
      <i class="bi bi-calendar-event"></i>
      Type
    </span>
    <span class="status-badge active">Active</span>
  </div>
  <div class="card-body">
    <h6 class="card-title">Card Title</h6>
    <p class="text-secondary small">Description text here</p>
  </div>
  <div class="card-footer">
    <div class="d-flex gap-2">
      <button class="btn-icon primary"><i class="bi bi-eye"></i></button>
      <button class="btn-icon secondary"><i class="bi bi-pencil"></i></button>
      <button class="btn-icon danger"><i class="bi bi-trash"></i></button>
    </div>
  </div>
</div>
```

### Stats Grid

```html
<div class="stats-grid">
  <div class="stats-card primary">
    <div class="stats-icon"><i class="bi bi-graph-up"></i></div>
    <div class="stats-value">1,234</div>
    <div class="stats-label">Total</div>
  </div>
  <div class="stats-card success">
    <div class="stats-icon"><i class="bi bi-check-circle"></i></div>
    <div class="stats-value">890</div>
    <div class="stats-label">Completed</div>
  </div>
</div>
```

### Segmented Control

```html
<div class="segmented-control">
  <input type="radio" class="btn-check" name="options" id="opt1" checked>
  <label class="segment-btn" for="opt1">
    <i class="bi bi-image"></i>
    <span>Option 1</span>
  </label>
  <input type="radio" class="btn-check" name="options" id="opt2">
  <label class="segment-btn" for="opt2">
    <i class="bi bi-film"></i>
    <span>Option 2</span>
  </label>
</div>
```

### Form Group

```html
<div class="mb-3">
  <label class="form-label">Label Text</label>
  <input type="text" class="form-control" placeholder="Enter value...">
  <small class="text-muted">
    <i class="bi bi-info-circle me-1"></i>
    Helper text here
  </small>
</div>
```

---

## Quick Reference

### Do's

- Use the purple gradient for primary actions
- Apply glassmorphism (backdrop-filter) to cards and modals
- Use semi-transparent backgrounds instead of solid colors
- Add hover states with subtle transforms and shadows
- Use CSS variables for consistency
- Ensure touch targets are at least 44px on mobile

### Don'ts

- Avoid Bootstrap's default warning (yellow) and success (green) colors
- Don't use solid background colors for cards
- Avoid sharp corners - use 10-16px border-radius
- Don't skip hover/focus states on interactive elements
- Avoid pure black backgrounds - use dark blue-black (#0f0f1a)

---

## File References

- **Generation Dashboard CSS**: `/public/css/dashboard-generation.css`
- **Schedules Dashboard CSS**: `/public/css/dashboard-schedules.css`
- **Main Dashboard View**: `/views/dashboard.hbs`
- **Schedules View**: `/views/dashboard/schedules.hbs`
