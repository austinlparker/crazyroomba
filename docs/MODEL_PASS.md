# Model overhaul · September 5, 2026

Rebuilt the main model families across all four stages in the existing arcade art direction. Geometry remains generated locally: no downloaded models, asset packs, new runtime dependencies or texture transfers.

## Changes

- **Roomba:** continuous beveled shell, curved rubber bumper, inset sensor lenses, lid vents, charging contacts, treaded wheels and a three-arm bristle brush. All six painted skins fit the new lid and recolor shell/accent parts independently. The rigid body stays inside the 18 cm driving radius and 13 cm overhead clearance; the side brush remains cosmetic.
- **Dust and residents:** sculpted dust-bunny tufts and facial features; cat muzzle, whiskers, ear interiors and fur markings; dog muzzle, paws, collar, ears and tail; person with shaped clothing, cuffs, sneakers, collar, hair and facial features. Rigid limb parts are batched while retaining walk and head/tail animation.
- **Interiors:** upholstered sofa/chair cushions and piping, mattresses, pillows, folded bedding, wooden frames, open shelves, books, drawer handles, paneled appliances, curved ceramic basins, taps, a washing-machine door, CRT cases/screens, hollow mugs, lamps, plant pots and a shared charging dock. Fabric and wood use shared 128px procedural finish maps. Furniture feet retain the navigation model's locations; bed/sofa undersides preserve crawl clearance.
- **Street:** tapered vehicle cabins with sloped windshields, pillars, hood, trim, mirrors, wipers, tires, hub details and van roof cargo. Bins have tapered bodies, lids, handles and wheels; sheds have pitched roofs and braced doors; barbecue, planters, trees and house siding/shutters/chimneys have more recognizable construction.
- **Moon:** capsule habitat with ribs, portholes, airlock and connected landing supports; curved satellite dish with feed supports; six-wheel rover, suspension, equipment and camera mast; framed solar cells; shaped rocket, porthole, nozzle and solid fins; profiled UFO. Each crater is a continuous irregular mound instead of a ring on a square slab.
- **Batching:** static merging now converts vertices into the parent's local space, preserving placement under translated, rotated and scaled parents. This allows the new articulated parts to remain correctly positioned while sharing draw calls.

## Review tools

With `npm run dev`, open [the model gallery](http://127.0.0.1:5173/scripts/model-gallery.html). Cast, Interiors, Street and Moon isolate the main models with consistent studio lighting. Drag to orbit, or use Rotate. The gallery is a development HTML entry and is absent from the production build.

## Validation

- **215 tests / 14 files pass**, including new regression checks for transformed mesh merging, robot dimensions, furniture crawl spaces, resident grounding through a full walk cycle and resident mesh budgets.
- Both TypeScript targets and the production build pass. Stage topology/disposal and all existing gameplay/replay tests pass.
- Initial Apartment + engine + high-quality effects + HTML/CSS: **178.2 KiB gzip**, up 5.2 KiB from the prior pass and below the unchanged 185 KiB limit. Additional stage JavaScript remains lazy: House 10.2 KiB, Cul-de-sac 4.4 KiB, Moon 4.8 KiB. OAuth and garage remain separate.
- Browser review covered all four stage previews, close chase views in Apartment and House, and the dedicated cast/interior/street/lunar gallery. Close-up review corrected floating trim, cushion piping that did not follow the cushion rotation, habitat support joins and a sensor that slightly exceeded the robot radius.
- Two consecutive stage cycles returned identical retained geometry/texture counts at the sampled menu views: Apartment 128/29, House 284/80, Cul-de-sac 190/25, Moon 75/19. These are renderer resource counts at those views, not total source-mesh counts.
- A 180-frame House gameplay sample on this Mac had **16.6 ms median frame spacing**, **1.9 ms median JavaScript render time**, and **2.4 ms p95 render time**. The sampled full render used 474 draw calls including shadows/effects. This is one desktop scene sample, not a mobile or GPU benchmark.
- All six garage paint previews render on the new body; the final game console review reported no errors.
- No gameplay rules, scores, authentication or backend storage changed. The existing 2.5.0 ruleset is retained. No production deployment.

## Dust pickup follow-up

The dust bunny now has a squat oatmeal-colored puff, a gently irregular body surface, short asymmetric ears and two small, unobstructed eyes. Removed the protruding fur rods, bright cheeks and large yellow bubbles that made the old model look spiky and covered parts of its face. The fur variation is generated once in the geometry; it needs no texture, transparency, shader or animation work.

The pickup retains its existing instance transform and fits a 22.3 × 18.1 × 19.6 cm envelope. Three opaque, directly parented mesh batches replace seven; the geometry drops from 3,520 to 3,072 triangles per pickup. The existing 64-pickup instancing and scene disposal remain unchanged.

Reviewed the model from the front and three-quarter views in the gallery. Browser ray checks confirm that both eye centers are unobstructed, all batches have identity local transforms, and the lowest vertex clears the floor. The model suite's 12 checks pass and the gallery logs no warnings or errors. Whole-build and gameplay validation belongs to the accompanying polish pass.

## Seating attachment follow-up

The upholstered support under sofa and chair cushions now reaches the actual seat underside. The former fixed-height base left a 9.2 cm gap beneath the House sofa and a 6 cm gap beneath its armchair; the arms also hung above that base. The support is continuous from the existing wooden plinth to the seat and arms, with a small hidden overlap to avoid seams. The Apartment sofa retains its 17 cm crawl clearance and all legs, footprints and collision shapes stay unchanged. Backrest tuft buttons now inherit the back cushion's lean and intersect its surface instead of floating in front of it.

The geometry checks cover the House sofa, armchair, rotated window bench, reading chair, Apartment sofa and development-gallery sofa. Vertical ray intersections verify uninterrupted material from the base through seats and arms, while front-facing rays verify button attachment. All 20 model checks pass, including existing crawl-clearance and disposal checks. Browser surfaces were unavailable during this subagent pass; the combined release review owns visual verification.
