/**
 * Liquid-glass surfaces for the Harness Web UI, with a live control panel.
 *
 * What this does: the macOS desktop window is already created with
 * `vibrancy: 'sidebar'`, `visualEffectState: 'active'` and
 * `backgroundColor: '#00000000'`, so the native frosted material is live behind
 * the page. What hides it is that the page paints mostly opaque surfaces. This
 * plugin repaints the window chrome as glass, and leaves every content-bearing
 * surface opaque — popups, code previews, generic inputs — because a
 * translucent surface with no blur behind it lets the transcript read straight
 * through it.
 *
 * Two vehicles, deliberately separated:
 *
 * 1. CSS custom properties (`--lg-*`, set on `document.body`) drive everything
 *    the stylesheet can scale on its own — mixes, alphas, blur radius, radii.
 *    Dragging a slider writes these directly, so it is instant and cheap.
 * 2. Alias tokens that ui-layout writes inline on `body` (the sidebar fill)
 *    cannot be set from a stylesheet, so those go through
 *    `ctx.theme.overrideTokens`, the theme plugin's supported third-party
 *    entry point: a per-source layer stack, replaced on every change and removed
 *    when the plugin unloads, which restores the stock look exactly.
 *
 * The panel lives in two additive slots — a button beside Settings at the
 * sidebar foot and the frame-wide overlay layer — so nothing shipped is
 * replaced. Values persist in localStorage; the defaults reproduce the shipped
 * look byte for byte.
 *
 * Not routing the panel's copy through the locale service yet: labels are
 * Chinese, matching the project this was built for.
 */
window.__ModuleLoader__.load({
  id: 'dsh-liquid-glass',
  factory(require) {
    // React comes from the shell's platform module table. Taken defensively so a
    // missing entry disables the control panel instead of taking the
    // stylesheet — and therefore the whole look — down with it.
    let React = null;
    try {
      React = require('react');
    } catch (error) {
      console.error('[liquid-glass] React is unavailable; the control panel stays off', error);
    }
    const h = React === null ? null : React.createElement;
    const SOURCE = 'dsh-liquid-glass';
    const STORAGE_KEY = 'dsh-liquid-glass.values';

    /**
     * Every tunable, with its shipped default.
     *
     * These are the values the author tuned with the control panel, published as
     * the out-of-the-box look: the window carries no page tint of its own and
     * shows the native macOS material directly, with a frosted composer and a
     * bright window rim. `sidebar: 0` also zeroes the material the conversation
     * columns composite, so raising `colMix` alone changes nothing until the
     * sidebar alpha is raised too.
     */
    const DEFAULTS = {
      colMix: 6, // 对话区材质浓度 (%), a multiplier on the sidebar material
      sidebar: 0, // 侧边栏材质不透明度倍数 (light base .50, dark base .46)
      composer: 0.72, // 输入框底色不透明度 (dark uses +0.02)
      blur: 37, // 输入框模糊半径 (px)
      edge: 0.7, // 卡片边缘高光强度倍数
      rim: 1.75, // 窗口内沿高光强度倍数
      radius: 1.1, // 圆角倍数 (bases 14 / 18 / 24 / 32 px)
      settings: 0, // 设置面板灰度深度: 0 = 官方色, 1 = 最深
      bubble: '#007aff', // 自己的消息气泡颜色 (文字色按对比度自动选黑/白)
      tail: true, // iMessage 式气泡形状: 尾巴 + 尾侧平角 + 同消息合并角
      groupGap: 2, // 连续同侧消息之间的间距 (px)
      bubbleRadius: 1, // 气泡圆角倍数 (基准 var(--dsw-radius-xl))
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    /** Interpolate two #rrggbb colours; a colour the stylesheet cannot derive. */
    const mixHex = (from, to, t) => {
      const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
      const at = (i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t);
      return `rgb(${at(0)}, ${at(1)}, ${at(2)})`;
    };

    /** Relative luminance decides whether a bubble needs dark or light type. */
    const contrastOn = (hex) => {
      const channel = (i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      const linear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const luminance =
        0.2126 * linear(channel(0)) + 0.7152 * linear(channel(1)) + 0.0722 * linear(channel(2));
      return luminance > 0.45 ? '#0f1115' : '#ffffff';
    };

    // ---------------------------------------------------------------- store

    const readStored = () => {
      const kept = {};
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return kept;
        const parsed = JSON.parse(raw);
        for (const key of Object.keys(DEFAULTS)) {
          const value = parsed === null ? undefined : parsed[key];
          if (key === 'bubble') {
            if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
              kept[key] = value.toLowerCase();
            }
          } else if (key === 'tail') {
            if (typeof value === 'boolean') kept[key] = value;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            kept[key] = value;
          }
        }
      } catch (error) {
        /* unreadable storage: fall back to the shipped values */
      }
      return kept;
    };

    let state = { open: false, ...DEFAULTS, ...readStored() };
    const listeners = new Set();

    const persist = () => {
      try {
        const values = {};
        for (const key of Object.keys(DEFAULTS)) values[key] = state[key];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch (error) {
        /* private mode or quota: tuning stays session-local */
      }
    };

    const update = (patch) => {
      state = { ...state, ...patch };
      persist();
      for (const listener of listeners) listener();
    };

    /** Subscribe a component to the store. */
    const useStore = () => {
      const [snapshot, setSnapshot] = React.useState(state);
      React.useEffect(() => {
        const listener = () => setSnapshot({ ...state });
        listeners.add(listener);
        listener();
        return () => {
          listeners.delete(listener);
        };
      }, []);
      return snapshot;
    };

    // ------------------------------------------------------------- derivations

    const cssVariables = (v) => ({
      '--lg-col-mix-light': `${Math.round(clamp(v.colMix * 0.8, 0, 100))}%`,
      '--lg-col-mix-dark': `${Math.round(clamp(v.colMix, 0, 100))}%`,
      '--lg-composer-alpha': String(clamp(v.composer, 0, 1)),
      '--lg-blur': String(clamp(v.blur, 0, 80)),
      '--lg-edge': String(clamp(v.edge, 0, 2)),
      '--lg-rim': String(clamp(v.rim, 0, 2)),
      '--lg-radius': String(clamp(v.radius, 0.4, 2.4)),
      '--lg-settings-light': mixHex('#ffffff', '#f0f1f4', clamp(v.settings, 0, 1)),
      '--lg-settings-dark': mixHex('#2c2c2e', '#1b1b1c', clamp(v.settings, 0, 1)),
      '--lg-bubble': v.bubble,
      '--lg-bubble-text': contrastOn(v.bubble),
      '--lg-bubble-radius': String(clamp(v.bubbleRadius, 0.4, 2.4)),
      '--lg-group-gap': `${Math.round(clamp(v.groupGap, 0, 12))}px`,
    });

    const themeTokens = (v) => ({
      '--dsw-alias-bg-base': {
        light: 'rgba(255, 255, 255, 0.62)',
        dark: 'rgba(21, 21, 23, 0.58)',
      },
      // Raised and floating surfaces stay opaque: this one token backs the
      // code/diff hover preview, every text input, the JSON tree, segmented
      // controls and the right-sidebar panels.
      '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#232324' },
      // The Settings panel and the Modal primitive both paint this.
      '--dsw-alias-bg-layer-2': { light: '#ffffff', dark: '#2c2c2e' },
      '--dsw-alias-bg-overlay': {
        light: 'rgba(233, 236, 242, 0.86)',
        dark: 'rgba(97, 102, 107, 0.78)',
      },
      '--dsw-specific-sidebar-fill': {
        light: `rgba(249, 250, 251, ${clamp(0.5 * v.sidebar, 0, 1).toFixed(3)})`,
        dark: `rgba(27, 27, 28, ${clamp(0.46 * v.sidebar, 0, 1).toFixed(3)})`,
      },
    });

    // ------------------------------------------------------------- stylesheet

    const STYLES = `
      /*
       * Global axes. Radii and the squircle factor are plain length values that
       * no alias token carries, so the stylesheet owns them and sliders move
       * them without a theme round-trip. Every reference below has a fallback,
       * so the sheet is already correct before the first variable write.
       *
       * The html qualifier is not decoration: the theme declares
       * --dsw-specific-bubble on body and its dark value on
       * body[data-ds-dark-theme], so a bare body rule loses in dark mode
       * whatever the sheet order. html body (0,0,2) and
       * html body[data-ds-dark-theme] (0,1,2) both outrank those deterministically.
       */
      html body {
        --dsw-radius-md: calc(14px * var(--lg-radius, 1));
        --dsw-radius-lg: calc(18px * var(--lg-radius, 1));
        --dsw-radius-xl: calc(24px * var(--lg-radius, 1));
        --dsw-radius-panel: calc(32px * var(--lg-radius, 1));
        --dsw-corner-shape: superellipse(1.6);
        --dsw-specific-bubble: var(--lg-bubble, #007aff);
      }
      html body[data-ds-dark-theme] {
        --dsw-specific-bubble: var(--lg-bubble, #007aff);
      }

      /*
       * User-authored bubbles. Three components paint --dsw-specific-bubble —
       * the chat message, the goal card and the question card — and all three
       * take their type colour from the global label token, which is why the
       * bubble needs its own text colour: on a saturated fill, label-primary is
       * the wrong ink in one of the two schemes. The body qualifier outranks the
       * component rule whatever order the sheets load in; the text colour comes
       * from the fill's relative luminance.
       */
      body [class*='_bubble'] {
        color: var(--lg-bubble-text, #ffffff);
      }

      /*
       * iMessage-style user bubbles: a tail on the last bubble of a message, and
       * a tighter gap between consecutive messages.
       *
       * The tail is measured off a real iMessage bubble rather than eyeballed, and
       * the measurement settled two things that earlier attempts got wrong:
       *
       * 1. iMessage does NOT flatten the tail-side corner. The bubble keeps its
       *    full radius on all four corners, and the tail is purely additive,
       *    tucked UNDER the bottom-right corner. Flattening the corner and
       *    bolting a wedge onto it is what made the first attempts look wrong.
       * 2. The tail starts exactly at the corner arc's foot on the bottom edge
       *    (one corner radius left of the right edge), hangs about a third of a
       *    radius below the bubble, drifts slightly right as it descends, and
       *    tapers to a point that sits just inside the bubble's right edge. It
       *    never overhangs horizontally, so it cannot push a scrollbar.
       *
       * border-radius cannot draw it (rounding a small square gives a rounded
       * square) and a mask bite leaves a rectangle; a clip-path wedge is the
       * shape. The path's coordinates come from the measured outline scaled to
       * this bubble's radius: a 28x10 box at right:0/bottom:-10px holds the whole
       * tail below the corner.
       *
       * Everything is scoped to body[data-lg-tail], which the panel toggles, so
       * switching the shape off leaves the component untouched.
       */
      body[data-lg-tail] [data-chat-flow-kind='user'] [class*='_bubble'] {
        border-radius: calc(var(--dsw-radius-xl) * var(--lg-bubble-radius, 1));
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
      }
      body[data-lg-tail] [data-chat-flow-kind='user'] [class*='_bubble']:last-child {
        position: relative;
      }
      body[data-lg-tail] [data-chat-flow-kind='user'] [class*='_bubble']:last-child::after {
        content: '';
        position: absolute;
        right: 0;
        bottom: -10px;
        width: 28px;
        height: 10px;
        background: var(--dsw-specific-bubble);
        clip-path: path('M0,0 L14.3,0 C14.6,3.2 15.8,6.6 16.8,10 C12.2,9 5.4,4.6 0,0 Z');
        pointer-events: none;
      }

      /*
       * A run of messages from the same side reads as one group. DSH owns the
       * rhythm through --dsh-chat-flow-gap, resolved on the later sibling, so
       * this overrides the value rather than the margin.
       */
      body :is([data-chat-flow-kind='user'], [data-chat-flow-kind='steering'])
        + :is([data-chat-flow-kind='user'], [data-chat-flow-kind='steering']) {
        --dsh-chat-flow-gap: var(--lg-group-gap, 2px);
      }

      /* User-message timestamps drop to the secondary scale, iMessage-like. */
      body [data-chat-flow-kind='user'] [class*='_timeStart'],
      body [data-chat-flow-kind='user'] [class*='_timeEnd'] {
        font-size: 11px;
        color: var(--dsw-alias-label-caption);
      }

      /* The bubble column is a little narrower than the transcript column. */
      body [class*='_userStack'] {
        max-width: min(calc(var(--dsh-chat-content-width, 748px) * 0.66), 78%);
      }

      /*
       * Settings panel: opaque, and one palette step deeper. The panel and its
       * cards both read --dsw-alias-bg-layer-2, so redefining it on the seat's
       * slot wrapper repaints that subtree only, without naming a hashed class
       * and without touching any other popup.
       */
      [data-slot='sidebar.settings'] {
        --dsw-alias-bg-layer-2: var(--lg-settings-light, #f8f8fa);
      }
      body[data-ds-dark-theme] [data-slot='sidebar.settings'] {
        --dsw-alias-bg-layer-2: var(--lg-settings-dark, #232324);
      }

      /*
       * Conversation surface. The layout paints the center column and the right
       * bar with --dsw-alias-bg-base; the sidebar instead composites
       * --dsw-specific-sidebar-fill down to 40% (light) / 50% (dark) on darwin.
       * Reproducing that composite makes the whole frame read as one glass
       * plane. The token itself is left alone, because --dsw-alias-bg-base is
       * also used as an occluder: the composer seat fades it in over the
       * transcript, and sticky rows (the compaction button, expanded disclosure
       * rows) paint it to hide what scrolls under them.
       *
       * The shipped rule is [data-platform=darwin] .<hash>_centerCol, so the
       * html[data-platform=darwin] qualifier outranks it without !important.
       * [class*='_centerCol'] matches the hashed CSS-module name: the hash
       * prefix changes between builds, the local name does not.
       */
      html[data-platform='darwin'] [class*='_centerCol'],
      html[data-platform='darwin'] [class*='_rightbarCol'] {
        background: color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) var(--lg-col-mix-light, 40%), transparent);
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] [class*='_centerCol'],
      html[data-platform='darwin'] body[data-ds-dark-theme] [class*='_rightbarCol'] {
        background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) var(--lg-col-mix-dark, 50%), transparent);
      }

      /*
       * Composer (the input card). It paints --dsw-specific-input-major, which
       * the theme sets to an opaque #fff / #2c2c2e, and the same token also
       * backs the Settings sign-in inputs and the approval / question cards.
       * Scoping the redefinition to the card's own data attribute — a stable
       * hook the renderer sets explicitly — changes only the input box.
       *
       * Transparency alone does not work here: the transcript scrolls behind the
       * card, so a drop in alpha lets that text show straight through it. Two
       * things together fix it — a mostly opaque fill and a real blur layer, so
       * whatever is behind the card arrives as an even smear instead of readable
       * type.
       */
      html[data-platform='darwin'] [data-composer-card] {
        --dsw-specific-input-major: rgba(255, 255, 255, calc(var(--lg-composer-alpha, 0.86)));
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] [data-composer-card] {
        --dsw-specific-input-major: rgba(44, 44, 46, calc(var(--lg-composer-alpha, 0.86) + 0.02));
      }
      /*
       * The blur sits on a pseudo-element rather than on the card: that mirrors
       * the app's own MenuSurface material, and keeps the card from becoming a
       * backdrop root or a fixed-position containing block, which would trap any
       * popover anchored inside the composer.
       */
      html[data-platform='darwin'] [data-composer-card]::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        backdrop-filter: blur(calc(var(--lg-blur, 24) * 1px)) saturate(180%);
        -webkit-backdrop-filter: blur(calc(var(--lg-blur, 24) * 1px)) saturate(180%);
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
          inset 0 1px 0 rgba(255, 255, 255, calc(0.70 * var(--lg-edge, 1))),
          inset 0 0 0 0.5px rgba(255, 255, 255, calc(0.22 * var(--lg-edge, 1))),
          inset 0 10px 18px -14px rgba(255, 255, 255, calc(0.40 * var(--lg-edge, 1)));
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] [data-composer-card] {
        box-shadow:
          var(--dsw-elevation-soft),
          inset 0 1px 0 rgba(255, 255, 255, calc(0.30 * var(--lg-edge, 1))),
          inset 0 0 0 0.5px rgba(255, 255, 255, calc(0.13 * var(--lg-edge, 1))),
          inset 0 10px 18px -14px rgba(255, 255, 255, calc(0.18 * var(--lg-edge, 1)));
      }

      /*
       * Window rim: one lit line along the top edge and a faint shade along the
       * bottom, across the whole window. Drawn as an overlay on the shell frame
       * so the columns cannot paint over it; the #root child combinator keeps it
       * to the shell frame (a nested panel could also carry a _frame class).
       * Pointer-inert, and popovers are portaled outside the frame, so they stay
       * above it.
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
          inset 0 1px 0 rgba(255, 255, 255, calc(0.75 * var(--lg-rim, 1))),
          inset 0 -1px 0 rgba(0, 0, 0, calc(0.06 * var(--lg-rim, 1)));
      }
      html[data-platform='darwin'] body[data-ds-dark-theme] #root > [class*='_frame']::after {
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, calc(0.15 * var(--lg-rim, 1))),
          inset 0 -1px 0 rgba(0, 0, 0, calc(0.40 * var(--lg-rim, 1)));
      }

      /*
       * Control panel chrome. Theme tokens only, so it follows light/dark like
       * any other surface. The overlay layer is click-through, so the panel opts
       * back into pointer events itself.
       */
      [data-lg-toggle] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 32px;
        max-width: 100%;
        padding: 0 8px;
        border: 0;
        border-radius: var(--dsw-radius-md);
        background: transparent;
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 14px;
        line-height: 20px;
        cursor: pointer;
      }
      [data-lg-toggle]:hover {
        background: var(--dsw-alias-interactive-bg-hover);
      }
      [data-lg-toggleGlyph] {
        font-size: 16px;
        line-height: 1;
      }

      [data-lg-panel] {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 30;
        box-sizing: border-box;
        width: 288px;
        max-height: min(74vh, 640px);
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px 14px;
        border-radius: var(--dsw-radius-lg);
        background: var(--dsw-specific-menu);
        backdrop-filter: var(--dsw-menu-backdrop-filter);
        color: var(--dsw-alias-label-primary);
        box-shadow: var(--dsw-elevation-panel);
        font-size: 13px;
        line-height: 20px;
        pointer-events: auto;
      }
      [data-lg-panel] .lg-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      [data-lg-panel] .lg-title {
        flex: 1;
        font-weight: 500;
      }
      [data-lg-panel] button {
        padding: 2px 8px;
        border: 0.5px solid var(--dsw-alias-border-l2);
        border-radius: var(--dsw-radius-sm);
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      [data-lg-panel] button:hover {
        background: var(--dsw-alias-interactive-bg-hover);
      }
      [data-lg-panel] .lg-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      [data-lg-panel] .lg-rowHead {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      [data-lg-panel] .lg-rowValue {
        color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
      }
      [data-lg-panel] input[type='range'] {
        width: 100%;
        margin: 0;
        accent-color: var(--dsw-alias-brand-primary);
      }
      [data-lg-panel] input[type='color'] {
        width: 100%;
        height: 26px;
        padding: 2px;
        border: 0.5px solid var(--dsw-alias-border-l2);
        border-radius: var(--dsw-radius-sm);
        background: transparent;
        cursor: pointer;
      }
      [data-lg-panel] .lg-check {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      [data-lg-panel] input[type='checkbox'] {
        margin: 0;
        accent-color: var(--dsw-alias-brand-primary);
      }
    `;

    // ------------------------------------------------------------- components

    const Slider = ({ label, text, min, max, step, value, onChange }) =>
      h(
        'label',
        { className: 'lg-row' },
        h(
          'span',
          { className: 'lg-rowHead' },
          h('span', { className: 'lg-rowLabel' }, label),
          h('span', { className: 'lg-rowValue' }, text),
        ),
        h('input', {
          type: 'range',
          min,
          max,
          step,
          value,
          onChange: (event) => onChange(Number(event.currentTarget.value)),
        }),
      );

    const Toggle = (props) => {
      const snapshot = useStore();
      const wide = props !== null && props !== undefined && props.wide === true;
      return h(
        'button',
        {
          type: 'button',
          'data-lg-toggle': '',
          'aria-pressed': snapshot.open,
          title: '液态玻璃参数',
          onClick: () => update({ open: !snapshot.open }),
        },
        h('span', { 'data-lg-toggleGlyph': '', 'aria-hidden': 'true' }, '◐'),
        wide ? h('span', null, '玻璃参数') : null,
      );
    };

    const Panel = () => {
      const v = useStore();
      if (!v.open) return null;
      const set = (patch) => update(patch);
      const row = (key, label, text, min, max, step) =>
        h(Slider, {
          label,
          text,
          min,
          max,
          step,
          value: v[key],
          onChange: (value) => set({ [key]: value }),
        });
      return h(
        'div',
        { 'data-lg-panel': '', role: 'group', 'aria-label': '液态玻璃参数' },
        h(
          'div',
          { className: 'lg-head' },
          h('span', { className: 'lg-title' }, '液态玻璃参数'),
          h('button', { type: 'button', onClick: () => set({ ...DEFAULTS }) }, '重置'),
          h('button', { type: 'button', 'aria-label': '关闭', onClick: () => set({ open: false }) }, '×'),
        ),
        row('colMix', '对话区浓度', `${Math.round(v.colMix)}%`, 0, 100, 1),
        row('sidebar', '侧边栏浓度', `${Math.round(v.sidebar * 100)}%`, 0, 2, 0.05),
        row('composer', '输入框浓度', `${Math.round(v.composer * 100)}%`, 0.3, 0.98, 0.01),
        row('blur', '输入框模糊', `${Math.round(v.blur)}px`, 0, 60, 1),
        row('edge', '卡片边缘高光', `${Math.round(v.edge * 100)}%`, 0, 2, 0.05),
        row('rim', '窗口内沿高光', `${Math.round(v.rim * 100)}%`, 0, 2, 0.05),
        row('radius', '圆角大小', `${v.radius.toFixed(2)}×`, 0.6, 1.8, 0.05),
        row('settings', '设置面板灰度', `${Math.round(v.settings * 100)}%`, 0, 1, 0.05),
        h(
          'label',
          { className: 'lg-row' },
          h(
            'span',
            { className: 'lg-rowHead' },
            h('span', { className: 'lg-rowLabel' }, '我的气泡颜色'),
            h('span', { className: 'lg-rowValue' }, v.bubble),
          ),
          h('input', {
            type: 'color',
            value: v.bubble,
            onChange: (event) => set({ bubble: event.currentTarget.value }),
          }),
        ),
        h(
          'label',
          { className: 'lg-check' },
          h('input', {
            type: 'checkbox',
            checked: v.tail,
            onChange: (event) => set({ tail: event.currentTarget.checked }),
          }),
          h('span', null, '气泡尾巴（iMessage 式）'),
        ),
        row('bubbleRadius', '气泡圆角', `${v.bubbleRadius.toFixed(2)}×`, 0.6, 1.8, 0.05),
        row('groupGap', '连续消息间距', `${Math.round(v.groupGap)}px`, 0, 12, 1),
      );
    };

    // ------------------------------------------------------------------ apply

    return {
      /**
       * Install the stylesheet unconditionally, push the current values, then
       * attach to the theme and slot services as soon as they exist.
       *
       * There is deliberately no plugin-level `inject` list. A hard dependency
       * gates the whole plugin: if a provider's Client half is reloaded or
       * evicted — which a live composition does whenever the module graph
       * changes — cordis tears this plugin down and the stylesheet goes with it,
       * so the whole look vanishes at once. The stylesheet depends on nothing,
       * so it must never be gated; the services are best-effort with a short
       * retry.
       *
       * @param ctx - the Client Cordis context.
       */
      apply(ctx) {
        let disposed = false;
        let themeService = null;
        let disposeTokens = null;
        let frame = 0;

        ctx.effect(
          () => () => {
            disposed = true;
          },
          'liquid-glass: disposal flag',
        );

        const pushVariables = (v) => {
          const body = document.body;
          const variables = cssVariables(v);
          for (const name of Object.keys(variables)) body.style.setProperty(name, variables[name]);
          // The bubble shape is a block of rules, not a value: an attribute
          // scopes it so switching it off restores the component's own radii.
          if (v.tail === true) body.setAttribute('data-lg-tail', '');
          else body.removeAttribute('data-lg-tail');
        };

        const pushTokens = () => {
          if (themeService === null || disposed) return;
          try {
            disposeTokens = themeService.overrideTokens(SOURCE, themeTokens(state));
          } catch (error) {
            console.error('[liquid-glass] token layer update failed', error);
          }
        };

        const sync = () => {
          if (disposed) return;
          pushVariables(state);
          pushTokens();
        };

        const schedule = () => {
          if (disposed || frame !== 0) return;
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            sync();
          });
        };

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = SOURCE;
          tag.textContent = STYLES;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'liquid-glass: stylesheet');

        ctx.effect(
          () => () => {
            listeners.delete(schedule);
          },
          'liquid-glass: store subscription',
        );
        listeners.add(schedule);

        // Values first, then the theme layer: the sheet is already correct on
        // its fallbacks, and the first token write lands as soon as the service
        // appears.
        pushVariables(state);

        const whenService = (name, adopt, attempt) => {
          if (disposed) return;
          const service = typeof ctx.get === 'function' ? ctx.get(name) : undefined;
          if (service !== undefined && service !== null) {
            try {
              adopt(service);
            } catch (error) {
              console.error('[liquid-glass] adopting service "' + name + '" failed', error);
            }
            return;
          }
          if (attempt < 40) {
            window.setTimeout(() => whenService(name, adopt, attempt + 1), 100);
          } else {
            console.error('[liquid-glass] service "' + name + '" never appeared');
          }
        };

        whenService(
          'theme',
          (service) => {
            themeService = service;
            ctx.effect(
              () => () => {
                if (disposeTokens === null) return;
                try {
                  disposeTokens();
                } catch (error) {
                  /* already gone with the theme service */
                }
                disposeTokens = null;
              },
              'liquid-glass: token layer',
            );
            pushTokens();
          },
          0,
        );

        whenService(
          'slots',
          (slots) => {
            if (React === null || h === null) return;
            ctx.effect(
              () =>
                slots.inject('sidebar.footer.action', () =>
                  slots.register(
                    {
                      name: 'sidebar.footer.action',
                      id: 'liquid-glass-controls',
                      order: 5,
                      label: '液态玻璃参数',
                    },
                    Toggle,
                  ),
                ),
              'liquid-glass: sidebar control button',
            );
            ctx.effect(
              () =>
                slots.inject('shell.overlay', () =>
                  slots.register(
                    { name: 'shell.overlay', id: 'liquid-glass-panel', order: 90 },
                    Panel,
                  ),
                ),
              'liquid-glass: control panel',
            );
          },
          0,
        );
      },
    };
  },
});
