# Anti-slop checklist: bright 3D hyper-casual cooking game UI
Distilled from taste-skill and impeccable (craft-floor, delight, animate, critique), adapted from web to a phone-portrait game.

## 1. Tells of AI-made UI (avoid)
- Default fonts: Inter, Roboto, system-ui, Arial, or Impact/Arial Black as the display face. Source and self-host a real rounded display face.
- Purple/indigo-to-pink gradients; gradient text; dark navy base with neon accent.
- Glassmorphism / blurred translucent panels as decoration. A frosted card over the 3D scene is the top menu tell.
- Emoji or unicode glyphs as icons (coin, gem, star, lock). Icons must be drawn SVG or rendered assets in one stroke/weight/style.
- Same-size rounded cards of icon + heading + paragraph (menu tiles, upgrade grids, shop rows that all look identical).
- Nested cards; card inside panel inside modal; border-1px under a wide soft shadow ("ghost card").
- Zero-offset coloured glow halos as depth; or hard 4px 4px 0 offset shadows as a costume.
- A thin coloured bar down one side of a rounded box (accent stripe) to signal state or rarity.
- Pill and radius used everywhere identically; every button the same size, same weight, same grey.
- Centered title + subtitle + two buttons stacked in the middle of the screen over the scene (the generic "hero").
- Lots of white/grey flat panels. Pure white cards, grey borders, grey text on coloured surfaces (tint secondary text from the surface hue).
- Eyebrow/kicker labels above headings, section numbers, "01 / 02 / 03", tiny uppercase tracking-wide captions.
- Big-number-small-label stat templates for currency; sparklines, progress rings, or decorative charts as filler.
- Default browser surfaces: blue tap highlight, native scrollbars, text selection, focus rings, native select/inputs, system alert dialogs.
- One identical fade-up entrance on everything; bounce/elastic applied by reflex to every element; spinning loaders for loads.
- Modals for things that need no interruption; every action opening a popup with an X and "Got it".
- Generic copy: "Welcome back!", "Unlock the power of", "Seamless", "Get Started", "Level Complete! Great job!", lorem, "Item 1", round placeholder prices (9.99 everywhere), fake stats.
- Same elevation, same saturation, same weight on every element, so nothing is the one thing to press.
- Mixed icon/illustration styles; 3D scene in one style and UI in flat corporate style.

## 2. Rules that make it feel crafted
Typography
- One chunky rounded display face (heavy weight, slight positive stroke) for numbers, titles, buttons; one plain readable face at 16px+ for descriptions. Max 2 families.
- Numbers are the stars: tabular figures, big, with a dark outline or shadow of the hue so they read on any colour (white text with 2-3px dark-hue stroke is the genre default).
- Short labels (1-2 words). Title case or caps only for buttons. Tracking never below -0.02em; no text overflow at 360px width or at 1024px.
Colour
- Fixed palette of 5-7 saturated hues, each with a job: coin=gold, gem=cyan/magenta, progress=green, danger/limited=red, primary action=one hot colour used ONLY for the main CTA.
- Every surface has a hue (tinted shadow and highlight from its own colour); no neutral grey panels, no pure #000 or #fff blocks.
- Saturation and contrast drawn from the 3D scene (candy kitchen colours), so UI and world share one world.
- Contrast: body text >=4.5:1, large text >=3:1, checked on the real surface, not the idea of it.
Depth and shape
- Chunky "gel" buttons: 2-tone fill, top inner highlight, thick bottom ledge (darker shade of the SAME hue, offset and soft), outer dark-hue outline. One consistent corner radius family. Pressing sinks the ledge.
- Layers read as stacked physical plates: panel > row > button, each a distinct size/hue; never the same card repeated 3 deep.
- Shadows have offset and blur and hue; one elevation language across HUD, panels and popups.
Motion and feedback
- One authored language: squash-and-stretch on press (~90 ms down, ~180 ms overshoot back), ease-out arrivals (cubic-bezier(0.16,1,0.3,1)), exits faster than entrances. Overshoot is allowed because it is the genre, but only on rewards and presses.
- Currency feedback: coins fly from the source to the HUD counter, counter ticks up and pops, icon pulses on arrival; count-up numbers; haptic and sound hooks on every spend.
- Purchases/upgrades: item visibly changes (before vs after stat shown), burst particles, price button greys out then next tier is previewed. Rewards feel big, not a toast.
- Order bubbles: pop in with a small overshoot, drain-ring patience indicator in colour that shifts green to amber to red, shake when about to fail. Bubble tail points at the customer, scales with distance, never covers the counter.
- Level-up/reward popups: dim scene, hero object rotating or bursting, big number, ONE obvious collect button, rays/confetti sparing and then settle. Skippable after ~600 ms. Intensity proportional to rarity.
- Respect prefers-reduced-motion (swap movement for colour/opacity) and a sound/haptics toggle.
Iconography
- Drawn set, one outline weight, one corner style, 2-colour fills with highlight; coin and gem are distinct SILHOUETTES (round vs faceted), not just different colours. Rarity shown by shape/frame, not only colour.
Copy voice
- Say the thing in the game's own words: "Upgrade Oven", "Grill speed x1.5", "+12 coins", "Out of gems"; verbs for buttons ("Collect", "Buy", "Upgrade", "Play"), exact numbers, real item names. Errors state problem + fix ("Need 40 more coins").
Layout and touch
- Portrait phone first: HUD in the top safe area (coins left/gems right, level bar below), actions in thumb zone at bottom; honour env(safe-area-inset-*). Keep the centre of the screen free for the 3D scene.
- Touch targets >=48 px (primary 56-64 px), >=8 px gap; no hover-only states; press, disabled, loading, locked, maxed and empty states all designed.
- Tablet/desktop: constrain UI to a phone-sized column or scale chunks, don't stretch controls; keep the HUD anchored to corners.
- Menu: the live 3D scene is the hero; ONE huge Play button, shop/upgrades as 2-3 distinct icon buttons of different shape/size, logo lettering in the game's own style. Asymmetric composition, not a centred stack.
- Hierarchy per screen: exactly one primary, <=2 secondary, <=4 simultaneous choices; group shop items by value (best-value item larger/animated), not an even grid.

## 3. Review rubric (yes/no on a screenshot; any "no" = fix)
1. Is there exactly one clearly dominant action, in the one reserved CTA colour?
2. Is it free of white/grey flat panels, with every surface tinted from the palette?
3. Is the type a rounded chunky display face with outlined/shadowed numbers, not Inter/system?
4. Are all icons drawn in one consistent style, with no emoji or glyph icons?
5. Do coins and gems differ by silhouette as well as colour, and are both shown with real amounts?
6. Do buttons look pressable (ledge, highlight, outline), with consistent radius and elevation?
7. Is there no glassmorphism, gradient text, side-stripe border, ghost card, or nested card?
8. Does the 3D scene stay visible and uncovered in the middle, with HUD in safe areas and thumb-zone actions?
9. Are touch targets >=48 px and text >=16 px (or outlined numerals >=20 px), nothing clipped at 360 px?
10. Does the copy use real item names, numbers and verbs, with no generic filler?
11. Does the upgrade/shop row show a before/after benefit and a clear affordable/locked/maxed state?
12. Would a neighbouring game NOT be able to reuse this screen unchanged (own lettering, palette, motion character)?
