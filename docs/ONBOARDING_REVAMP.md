# Onboarding & Product Positioning Revamp — v2

## Design Direction: 3D Interactive Carousel Landing

### The Big Idea

Replace the static weather landing page with an **interactive 3D carousel** that IS the onboarding. Each card in the carousel represents a Fourcast vertical — Crypto, Sports, Politics, Weather — rendered as a "portal" into a 3D scene that communicates what that vertical does. The background gradient reacts to the active card's color scheme.

This combines two proven design patterns:

1. **Gradientslider** (Clément Grellier) — Infinite 3D carousel where each card's colors drive a reactive canvas-based background gradient. Smooth physics-based momentum, drag/wheel navigation, GSAP entry animations, GPU-friendly transforms.

2. **3D Interactive Cards** (Franco Beltramella) — Flat cards that reveal full Three.js/GLB 3D scenes inside card boundaries. "Flat to Deep" concept: a UI card becomes a portal into a miniature environment. Dark glass aesthetic, subtle rotation on interaction.

Your existing `Scene3D.js` + `weather3d/` components already give you the Three.js infrastructure. This design layers on top of it.

---

## The Landing Page (`/app/page.js`)

### Layout

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   [Reactive canvas gradient background]          │
│   (animates colors based on active card)         │
│                                                  │
│                                                  │
│       ┌──────┐  ┌──────────┐  ┌──────────┐      │
│       │      │  │          │  │          │      │
│       │ Crypto│  │  Sports  │  │ Politics │      │
│       │      │  │          │  │          │      │
│       └──────┘  └──────────┘  └──────────┘      │
│               ┌──────────┐                       │
│               │  Weather  │                      │
│               │ (3D scene)│                      │
│               └──────────┘                       │
│                                                  │
│   ◄─────── drag / scroll ──────────────────►     │
│   (infinite carousel, wraps around)              │
│                                                  │
│   [Fourcast title + tagline, centered]           │
│                                                  │
│   Active card shows:                             │
│   ┌────────────────────────────┐                 │
│   │  🔮  Market Intelligence   │                 │
│   │  200+ ML models · Live Wx  │                 │
│   │  [Enter →]                 │                 │
│   └────────────────────────────┘                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

### The 3D Carousel Mechanics

**Cards** — Each card is a dark, rounded-rectangle portal containing a Three.js scene:

| Card | 3D Scene Content | Value Prop | Routes To |
|------|------------------|------------|-----------|
| Crypto | Floating geometric shapes (cubes, spheres) with particle system, pulsing with market-like movement | "ML-powered crypto prediction edges" | `/markets?category=Crypto` |
| Sports | Mini stadium/field with weather effects (rain/sun passing over) | "Weather-aware sports market analysis" | `/markets?category=Sports` |
| Politics | Data visualization nodes + graphs, flowing connections | "Political forecast intelligence" | `/markets?category=Politics` |
| Weather | Your existing 3D weather scene (Scene3D) embedded as the card's content | "Predict how weather moves markets" | `/weather` |

Each card has:
- A small, persistent Three.js scene rendering inside its boundaries (GLB model or procedural geometry)
- Subtle auto-rotation of the 3D content (~0.5rpm)
- When active (centered): content rotates toward the viewer, lighting intensifies
- Title label overlay at bottom: "Crypto", "Sports", "Politics", "Weather"

**Carousel behavior** (from Gradientslider):
- Infinite wrapping — scroll/drag loops endlessly
- Physics-based momentum: friction decay, throw velocity on release
- Mouse wheel and drag support
- GPU-friendly: `will-change: transform`, `translate3d`, `contain: layout paint`
- Selective blur on non-core cards for depth-of-field effect
- Cards apply 3D transforms: `rotateY()` up to 28°, `translateZ()` for depth, subtle `scale()` variation

**Background gradient** (from Gradientslider):
- Canvas-based animated gradient
- Colors extracted from the active card's 3D scene (or predefined palette per vertical)
- Two floating radial gradients that drift slowly
- Smooth GSAP transition when active card changes
- Blur filter applied to canvas for softer look

**Entry animation**:
- GSAP timeline — cards slide in from their start positions with staggered delays
- Cards start transparent, fade + scale up to final position
- Background gradient starts animating immediately

---

### Interaction Flow

1. **First visit**: Full carousel + entry animation plays. No hero overlay needed — the carousel IS the onboarding.

2. **User browses**: Drags through Crypto → Sports → Politics → Weather → loops back. Each card centers, the background color shifts, the 3D scene inside becomes active.

3. **User stops on a card**: A gentle "pulse" animation plays on the centered card. Below or overlaid on the card, a compact info panel appears:
   - Icon + short description of the vertical
   - "Enter" CTA button
   - Small feature badges (ML, Weather, On-Chain)

4. **User clicks "Enter"**: Routes to the appropriate page with pre-applied context.

5. **User picks Weather**: Routes to `/weather` — your full 3D weather scene as it exists today, now contextualized as a prediction vertical.

6. **Returning user**: Same carousel, but the entry animation is skipped. A small "Welcome back" toast appears briefly. `localStorage` remembers their last selection.

---

### Responsive Behavior

**Desktop (>768px)**:
- Cards are `min(26vw, 360px) × 4/5 aspect ratio` (from Gradientslider's sizing)
- 4 cards visible at a time (1 center + 2 flanking + partial next/prev)
- Full 3D scenes render inside each card
- Cursor changes to `grab`/`grabbing` during drag

**Mobile (<768px)**:
- Cards scale to near-full-width with smaller height
- 1-2 cards visible at a time — horizontal swipe
- Touch-native: swipe gestures with inertial scrolling
- 3D scenes inside cards use lower polygon/particle counts for performance
- Background gradient canvas scales down resolution on lower-end devices

**Performance strategy** (from Gradientslider):
- 3D scenes inside non-center cards freeze/swap to static thumbnail
- Only the active (centered) card runs full Three.js rendering
- Background canvas throttles to 30fps when not transitioning
- `visibilitychange` pauses all animation when tab is hidden

---

## Architecture Change

### Before

```
/         → WeatherPage.js (3D weather scene)
/markets  → MarketsPage
/signals  → SignalsPage
```

### After

```
/                → 3D Interactive Carousel Landing (NEW)
/weather         → WeatherPage.js (moved — now a dedicated vertical)
/markets         → MarketsPage (unchanged, reads URL params)
/signals         → SignalsPage (unchanged)
```

### Route Details

| Route | Content | Notes |
|-------|---------|-------|
| `/` | 3D carousel with 4 cards | Always shows. No redirect. Carousel is always the landing. |
| `/weather` | Your full WeatherPage | Moved from `/`. Scene3D renders in full glory. Added "Related Markets" section below weather stats. |
| `/markets?category=X` | MarketsPage with pre-filter | Category param is applied to `discoveryFilters` on mount. |
| `/markets?analyze=X` | MarketsPage with auto-analysis | Opens specified market and runs AI analysis automatically. |

---

## File Changes

### New files

| File | Purpose |
|------|---------|
| `app/page.js` | 3D carousel landing page. Full replacement. |
| `app/weather/page.js` | WeatherPage.js moved here. Add weather-related prediction markets section. |

### Modified files

| File | Change |
|------|--------|
| `app/WeatherPage.js` | Deleted from `/app/`. Content lives at `/app/weather/page.js`. |
| `app/markets/page.js` | Add `useEffect` to read `?category=` and `?analyze=` URL params. Apply to filters. |
| `constants/appConstants.js` | Add any new constants for carousel card data. |

### Unchanged files

| File | Reason |
|------|--------|
| `components/Scene3D.js` | Reused on `/weather` and potentially as the Weather card's scene. |
| `app/signals/page.js` | No changes needed. |
| `components/weather3d/*` | Unchanged. Still rendered by Scene3D. |
| `app/api/*` | All API routes unchanged. |

---

## Implementation Schedule

### Week 1: Core Carousel

| Day | Task |
|-----|------|
| 1 | Create `app/page.js` — set up the 3D carousel structure: DOM layout, card elements, canvas background |
| 2 | Implement carousel math: infinite scroll, wrapping, 3D transforms (rotateY, translateZ, scale) per card position |
| 3 | Add drag/wheel/touch interaction with physics momentum (friction, velocity decay) |
| 4 | Add reactive canvas gradient background — color palettes per card, GSAP transitions, floating animation |
| 5 | Implement entry animation (GSAP timeline, card fly-in), loader/hide loader, first-ice detection |

### Week 2: Card Content & Integration

| Day | Task |
|-----|------|
| 1 | Create static card content (titles, icons, descriptions, CTAs) — no 3D scenes yet, just styled DOM |
| 2 | Create mini Three.js scenes for each card: Crypto (geometry + particles), Sports (procedural field), Politics (graph nodes), Weather (reuse/embed Scene3D fragment) |
| 3 | Wire card interaction: clicking "Enter" routes to appropriate page with URL params. Add `localStorage` for interest collection. |
| 4 | Responsive behavior: mobile layout, touch gestures, performance throttling. |
| 5 | Move `WeatherPage.js` to `app/weather/page.js`. Add "Related Markets" section. Wire URL params in `MarketsPage`. |

### Week 3: Polish

| Day | Task |
|------|------|
| 1 | Performance optimization: freeze off-center 3D scenes, throttle background canvas, `visibilitychange` handler |
| 2 | Animation refinements: easing curves, blur amounts, gap spacing, friction tuning |
| 3 | Final cross-browser testing, mobile testing, accessibility review |

---

## Design System Integration

The carousel landing inherits from your existing design system:

- **Font**: Inter (already used in your app)
- **Cards**: Dark glass aesthetic (your existing `glass-subtle` class with `bg-slate-900/60 border-white/20`)
- **Gradients**: Your purple/pink gradient from OnboardingTour CTA buttons can inspire the color palettes
- **CTAs**: Use your existing gradient button style (`bg-gradient-to-r from-purple-500 to-pink-500`)
- **Typography**: Light/thin font weights for the futuristic feel (matches your existing `font-thin` and `font-light` usage on weather stats)

Color palettes per card (for background gradient):

| Card | Primary | Secondary |
|------|---------|-----------|
| Crypto | Deep purple (#6B21A8) → Magenta (#BE185D) | Rich vibrant tones |
| Sports | Emerald (#059669) → Teal (#0D9488) | Fresh, energetic |
| Politics | Indigo (#4338CA) → Blue (#2563EB) | Trustworthy, data-driven |
| Weather | Sky (#0284C7) → Cyan (#06B6D4) | Clean, atmospheric |

---

## What This Achieves

| Requirement | How It's Met |
|-------------|-------------|
| Keep beautiful weather page | Weather is one of the 4 carousel cards and has its own full-page experience at `/weather` |
| Showcase agentic integration | Crypto card can show live edge detection data (edge %, confidence) as a floating label in the 3D scene |
| Desktop + mobile look amazing | Carousel adapts (full-width swipe on mobile, 4 visible on desktop). GSAP animations run on both. |
| Adhere to competitor onboarding principles | The carousel IS the onboarding — it collects interest data (which card they pick), shows value props visually, builds excitement before they enter |
| Memorable first impression | Nobody in prediction markets has a 3D interactive carousel as a landing page. This is genuinely differentiated. |
| Smooth transition to paywall (future) | The "Enter" action creates a natural moment for a premium upsell: "Crypto Pro gives you unlimited AI analyses" |

---

*Last updated: May 18, 2026*
*Inspired by: "3D Infinite Carousel with Reactive Background Gradients" (Clément Grellier) + "Building Interactive 3D Cards in Webflow with Three.js" (Franco Beltramella)*
