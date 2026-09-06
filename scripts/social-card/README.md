# Link preview card

The public game advertises `https://roomba.aparker.io/social/crazy-roomba-v1.jpg`
through static Open Graph and Twitter card tags in `index.html`. Crawlers do not
need JavaScript, authentication or the 3D engine to fetch the card.

The 1200 × 630 JPEG uses the shipping Cul-de-sac scene, Taxi skin and bundled
Racing Sans One / Chakra Petch fonts. Its editable source is the HTML/CSS and
capture script in this directory. The capture page is development-only; only
the exported image goes into the production build. The game does not preload
or import it.

To regenerate:

```sh
npm run dev
# In another terminal, install the capture browser once:
uv run --with playwright playwright install chromium
uv run --with playwright python scripts/social-card/render.py
```

Inspect `public/social/crazy-roomba-v1.jpg`, then build and deploy normally.
For a later artwork revision, use a new image filename in both the renderer
and HTML metadata so crawlers can discover a fresh image URL. Platforms may
keep previews already attached to existing posts.
