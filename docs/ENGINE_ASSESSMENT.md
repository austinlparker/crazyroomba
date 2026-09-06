# Engine direction · September 2026

Keep Three.js for the current browser build. Consider Godot when authoring larger houses, imported characters and animation becomes the main development bottleneck. This is an implementation judgment, not a claim that Three.js is a complete game engine.

Godot would provide a scene editor, animation tools, physics and navigation in an integrated workflow. Its [current web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) uses WebGL 2 with the Compatibility renderer; Forward+ and Mobile rendering are unavailable on the web. Threaded exports require cross-origin isolation headers. These constraints mean an engine change does not automatically improve browser lighting or fix overlapping surfaces.

A migration should preserve the browser shell for OAuth and profiles, and use [JavaScriptBridge](https://docs.godotengine.org/en/stable/tutorials/platform/web/javascript_bridge.html) to connect it to Godot. The deterministic TypeScript simulation currently runs both in the browser and the Cloudflare Worker. Replacing it with engine physics would require a new authoritative replay strategy, not just translating the rendering code.

A useful future evaluation is one exported room, a staircase, an imported animated pet and both cameras, measured on desktop and mobile for load time, frame time and input latency. Before choosing it, prove that a recorded run reproduces its score through the chosen server verification path. No Godot prototype or migration was performed in this polish pass.

## This pass

- Exposed wall-union surfaces replace overlapping wall boxes, paint skins and trim caps.
- Full-width tread/riser geometry replaces the sloped stair runner. The deterministic incline tracks route progress; a separate auto-climber supports the rendered chassis above the highest tread under its footprint, with position-synchronized turbo hops. The camera follows a smooth rail and tests its sightline against tread noses. Reduced motion removes the extra kick and roll.
- Room-specific materials, patterned wallpaper, carpet/tile/wood, rugs, bedding and light colors use generated local textures.
- A compact delivery/bin station backs against the living room east wall.
- Cat, dog and resident routines run in fixed simulation ticks. They pause at stops, yield to a parked robot, and produce soft bumper contacts. These are authored patrols with activities, not general-purpose AI navigation. The tutorial keeps its guided approach free of residents.
