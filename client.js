/**
 * Liquid-glass surface tuning for the Harness Web UI.
 *
 * What this does: the macOS desktop window is already created with
 * `vibrancy: 'sidebar'`, `visualEffectState: 'active'` and
 * `backgroundColor: '#00000000'`, so the native frosted material is live behind
 * the page. What hides it is that the page paints mostly opaque surfaces
 * (`--dsw-alias-bg-base` = #fff / #151517, sidebar fill, overlay fills). This
 * module replaces those alias tokens with translucent values, so the native
 * vibrancy shows through the window.
 *
 * Floating surfaces stay opaque on purpose: `--dsw-alias-bg-layer-2` is what
 * the Modal primitive and the Settings panel both paint, and a translucent
 * popup is where legibility breaks first. The Settings panel additionally gets
 * a deeper, fully opaque gray through a subtree-scoped variable override.
 *
 * Deliberately NO `backdrop-filter` here: Chromium cannot sample the native
 * vibrancy layer, so an in-page blur over a transparent region does nothing.
 * That layer is a separate, riskier step.
 *
 * `overrideTokens` is the theme plugin's supported third-party entry point: a
 * per-source stack of layers, later layers win per token, and removing the
 * layer restores exactly what it covered. Both the token layer and the style
 * tag are torn down with this plugin, so disabling the bundle restores the
 * stock look.
 *
 * Tuning: each token is `{ light, dark }`. Raise the alpha to gain contrast,
 * lower it to gain glass.
 */
window.__ModuleLoader__.load({
  id: 'dsh-liquid-glass',
  factory() {
    const SOURCE = 'dsh-liquid-glass';

    /** Translucent window-level surface tokens. Alpha is the tuning knob. */
    const TOKENS = {
      // Application base: the center column and the right bar paint this.
      '--dsw-alias-bg-base': {
        light: 'rgba(255, 255, 255, 0.62)',
        dark: 'rgba(21, 21, 23, 0.58)',
      },
      // Primary raised surface. Kept fully opaque: this single token already
      // backs the code/diff hover preview, every text input (Input.module.css
      // .wrap), the JSON tree, segmented controls and the right-sidebar panels,
      // and a translucent fill with no blur behind it lets the transcript text
      // read straight through the surface. The hover preview in particular is
      // portaled to document.body, so no column-scoped rule can reach it.
      '--dsw-alias-bg-layer-1': {
        light: '#ffffff',
        dark: '#232324',
      },
      // Floating surfaces: the Settings panel and the Modal primitive both
      // paint this. Fully opaque — no glass in popups.
      '--dsw-alias-bg-layer-2': {
        light: '#ffffff',
        dark: '#2c2c2e',
      },
      // Overlays and popovers: kept high so text stays legible.
      '--dsw-alias-bg-overlay': {
        light: 'rgba(233, 236, 242, 0.86)',
        dark: 'rgba(97, 102, 107, 0.78)',
      },
      // Sidebar column and title row. The layout already mixes this with
      // transparent on darwin; lowering it lets more of the desktop through.
      '--dsw-specific-sidebar-fill': {
        light: 'rgba(249, 250, 251, 0.50)',
        dark: 'rgba(27, 27, 28, 0.46)',
      },

      // Softer, more continuous corners. Modest on purpose: several controls
      // have fixed heights, so this is a nudge, not a redesign.
      '--dsw-radius-md': { light: '14px', dark: '14px' },
      '--dsw-radius-lg': { light: '18px', dark: '18px' },
      '--dsw-radius-xl': { light: '24px', dark: '24px' },
      '--dsw-radius-panel': { light: '32px', dark: '32px' },
      // Apple-style squircle corners (Chromium 139+; ignored elsewhere).
      '--dsw-corner-shape': {
        light: 'superellipse(1.6)',
        dark: 'superellipse(1.6)',
      },
    };

    /**
     * The Settings panel is a floating overlay that paints
     * `background: var(--dsw-alias-bg-layer-2)`, and its cards paint
     * `--dsw-alias-settings-card-fill: var(--dsw-alias-bg-layer-2)`.
     * Custom properties inherit, so redefining the variable on the settings
     * seat's slot wrapper re-paints that subtree only — opaque and one palette
     * step deeper — without naming a single hashed CSS-module class and
     * without touching any other popup. `--dsw-alias-settings-card-fill` is a
     * var() alias resolved at use site, so the cards follow automatically.
     */
    const STYLES = `
      [data-slot='sidebar.settings'] {
        --dsw-alias-bg-layer-2: #f5f6f7;
      }
      body[data-ds-dark-theme] [data-slot='sidebar.settings'] {
        --dsw-alias-bg-layer-2: #232324;
      }

      /*
       * Conversation surface. The layout paints the center column and the right
       * bar with --dsw-alias-bg-base; the sidebar instead composites
       * --dsw-specific-sidebar-fill down to 40% (light) / 50% (dark) on darwin.
       * Reproducing that same composite inside those two columns makes the whole
       * frame read as one glass plane, and redefining the variable (rather than
       * only the column's own paint) carries every surface inside the
       * conversation area along with it.
       *
       * The shipped rule is [data-platform=darwin] .<hash>_centerCol, so the
       * html[data-platform=darwin] qualifier outranks it without !important.
       * [class*='_centerCol'] matches the hashed CSS-module name: the hash prefix
       * changes between builds, the local name does not.
       *
       * Dial-back knob: raise 40% / 50% (e.g. 60% / 70%) for a more solid
       * conversation area, or lower it for more desktop.
       */
      html[data-platform='darwin'] [class*='_centerCol'],
      html[data-platform='darwin'] [class*='_rightbarCol'] {
        --dsw-alias-bg-base: color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) 40%, transparent);
        background: var(--dsw-alias-bg-base);
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] [class*='_centerCol'],
      html[data-platform='darwin'] body[data-ds-dark-theme] [class*='_rightbarCol'] {
        --dsw-alias-bg-base: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 50%, transparent);
        background: var(--dsw-alias-bg-base);
      }

      /*
       * Composer (the input card). It paints --dsw-specific-input-major, which
       * the theme sets to an opaque #fff / #2c2c2e, and the same token also
       * backs the Settings sign-in inputs and the approval / question cards.
       * Scoping the redefinition to the card's own data attribute — a stable
       * hook the renderer sets explicitly — changes only the input box.
       *
       * Transparency alone does not work here: the transcript scrolls behind
       * the card, so a drop in alpha lets that text show straight through it.
       * Two things together fix it — a mostly opaque fill (86% / 88%, the rest
       * is the glass) and a real blur layer, so whatever is behind the card
       * arrives as an even smear instead of readable type.
       *
       * The blur sits on a pseudo-element rather than on the card: that mirrors
       * the app's own MenuSurface material, and keeps the card from becoming a
       * backdrop root or a fixed-position containing block, which would trap
       * any popover anchored inside the composer.
       *
       * Knobs: the fill alpha above; the blur radius below (lower it if the
       * card feels heavy while scrolling). With the blur in place the fill can
       * safely go down to about 0.70 if you want more glass back.
       */
      html[data-platform='darwin'] [data-composer-card] {
        --dsw-specific-input-major: rgba(255, 255, 255, 0.86);
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] [data-composer-card] {
        --dsw-specific-input-major: rgba(44, 44, 46, 0.88);
      }
      html[data-platform='darwin'] [data-composer-card]::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        pointer-events: none;
      }

      /*
       * Edge highlight on the input card: a lit 1px top edge, an all-round
       * hairline, and a faint glow falling from the top. Composed with the
       * card's own elevation shadow rather than replacing it — no component
       * state repaints this shadow, so nothing is suppressed.
       */
      html[data-platform='darwin'] [data-composer-card] {
        box-shadow:
          var(--dsw-elevation-soft),
          inset 0 1px 0 rgba(255, 255, 255, 0.70),
          inset 0 0 0 0.5px rgba(255, 255, 255, 0.22),
          inset 0 10px 18px -14px rgba(255, 255, 255, 0.40);
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] [data-composer-card] {
        box-shadow:
          var(--dsw-elevation-soft),
          inset 0 1px 0 rgba(255, 255, 255, 0.30),
          inset 0 0 0 0.5px rgba(255, 255, 255, 0.13),
          inset 0 10px 18px -14px rgba(255, 255, 255, 0.18);
      }

      /*
       * Window rim: one lit line along the top edge and a faint shade along the
       * bottom, across the whole window. Drawn as an overlay on the shell frame
       * so the columns cannot paint over it; the #root child combinator keeps it
       * to the shell frame (a nested panel could also carry a _frame class).
       * Pointer-inert, and popovers are portaled outside the frame, so they
       * stay above it.
       */
      html[data-platform='darwin'] #root > [class*='_frame'] {
        position: relative;
      }
      html[data-platform='darwin'] #root > [class*='_frame']::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 6;
        pointer-events: none;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.75),
          inset 0 -1px 0 rgba(0, 0, 0, 0.06);
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] #root > [class*='_frame']::after {
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.15),
          inset 0 -1px 0 rgba(0, 0, 0, 0.40);
      }
    `;

    return {
      /**
       * Install the stylesheet unconditionally, then stack the token layer on
       * the theme service as soon as it exists.
       *
       * There is deliberately no plugin-level `inject: ['theme']` here. That
       * hard dependency gated the entire plugin on the theme service: if the
       * theme plugin's Client half was reloaded or evicted (which is exactly
       * what a live composition does when the module graph changes), cordis
       * tore this plugin down, taking the stylesheet with it — the whole look
       * vanished at once. The stylesheet depends on nothing, so it must never
       * be gated; the token layer is best-effort and retries briefly.
       *
       * @param ctx - the Client Cordis context.
       */
      apply(ctx) {
        let disposed = false;

        ctx.effect(() => () => {
          disposed = true;
        }, 'liquid-glass: disposal flag');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = SOURCE;
          tag.textContent = STYLES;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'liquid-glass: stylesheet');

        const applyTokens = (attempt) => {
          if (disposed) return;
          const theme = typeof ctx.get === 'function' ? ctx.get('theme') : undefined;
          if (theme !== undefined && theme !== null && typeof theme.overrideTokens === 'function') {
            try {
              ctx.effect(
                () => theme.overrideTokens(SOURCE, TOKENS),
                'liquid-glass: surface tokens',
              );
            } catch (error) {
              console.error('[liquid-glass] token layer failed', error);
            }
            return;
          }
          // The theme service appears shortly after its own Client half loads.
          if (attempt < 40) {
            setTimeout(() => applyTokens(attempt + 1), 100);
          } else {
            console.error('[liquid-glass] theme service never appeared; stylesheet only');
          }
        };
        applyTokens(0);
      },
    };
  },
});
