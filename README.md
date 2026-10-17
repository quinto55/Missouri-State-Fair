# Missouri State Fair — Site Redesign Concept

A modern, fast, zero-dependency recreation of [mostatefair.com](https://www.mostatefair.com/),
built as a redesign concept for the Missouri State Fair. Same organization and facts,
rebuilt around what fairgoers actually come to do: pick a day, buy a ticket, plan the trip.

**This is an unofficial redesign concept.** All copy is newly written. Factual
details (dates, prices, hours, policies, lineup, history) were taken from the
official site on 2026-10-14. Where only 2026 details exist, pages label them as
the 2026 season. Ticket and application links point back to the official site.

**Photography and branding:** the photos and the official Missouri State Fair logo
are hotlinked from the fair's own site (`mostatefair.com/wp-content/uploads`). This
repository stores no copies. All trademarks, logos and photographs belong to the
Missouri State Fair / Missouri Department of Agriculture and the original
photographers. They appear here only as part of this concept, prepared for the
fair's review.

## What's inside

| | |
| --- | --- |
| `index.html` | Home: looping night-video hero, countdown, 11-day "pick your day" rail, admission board, Grandstand, 2026 by the numbers |
| `tickets.html` | Admission, carnival wristbands, deals, Ham Breakfast, box office |
| `events.html` | Grandstand lineup, filterable attractions, Parson Arena, schedules |
| `plan.html` | Hours, gates, directions, parking, trams, camping, food, accessibility, policies |
| `faq.html` | Searchable FAQ with self-contained answers (FAQPage schema) |
| `participate.html` | Exhibitors, Youth in Agriculture, contests, vendors, sponsorship, internships |
| `about.html` | History since 1901, milestones timeline, mission, news, team |
| `contact.html` | Phone and email directory, weather/safety alerts |
| `assets/css/styles.css` | The whole "Show-Me Blue Ribbon" design system in one file |
| `assets/js/main.js` | One deferred script: nav, countdown, today highlight, filters, FAQ search, .ics |
| `assets/video/` | Hero loops (WebM + MP4, desktop/720p/phone) and posters |
| `tools/video/` | Composite/loop and QA scripts used to finish the hero video |
| `sw.js` + `manifest.webmanifest` | Installable PWA with offline fallback |

## Design

- **Palette:** fair navy `#13325e`, Missouri red `#c8202f`, harvest gold `#f4b234`. Grand Champion purple `#5b2a86` is saved for the best-of-show moments.
- **Type:** Barlow Condensed (OFL, self-hosted) for display, which echoes the fair's condensed masthead lettering. Body text uses the system font stack.
- **Second voice:** Yellowtail (OFL, self-hosted), a sign-painter script used only for short accents like "See you in Sedalia".
- **Signatures:** these are fairground objects rather than generic cards.
  - A **letterboard price sign** with felt grooves, a wood frame and white letters.
  - The 11 days as **admission stubs** with a torn-stub edge, color-coded by day type.
  - Stats on **prize rosettes**, with numbers that count up.
  - The Grandstand lineup in a **chasing marquee-bulb frame**, inside a night section that carries on the hero's dusk.
  - A **header that floats over the hero video** and turns solid once you scroll past it.
  - An **editorial feature block** in place of a row of cards.
  - A **partners strip**, and a faint Missouri outline with a Sedalia star in the footer.
- **Photos:** the 20 images shown large were AI-upscaled 3× with Topaz Precision (faces at zero creativity) and stored in `assets/img/photos/`. Smaller card images are still hotlinked.

## The hero: night at the Main Gate

The home page opens on a 9-second looping video of the fair's real Main Gate at night. The Ferris wheel
turns, the midway lights chase, and a drone show draws the outline of Missouri, with a gold star on Sedalia, inside chasing red and blue rings. The 2026 Fair's
Grandstand concerts really did end with fireworks and a drone show.

How it was made (about $5 total on fal):

1. **Night still.** The fair's own Main Gate photo was relit as a night scene with a drone star
   (Nano Banana 2 Edit). For phones, the scene was outpainted to 9:16 (Bria Expand), so the original pixels
   are kept and only sky and plaza were added.
2. **Motion.** LTX-2.5 Pro image-to-video, 10 s, 1080p, static camera. The still is used as both the
   first and the last frame.
3. **Drone show choreography.** LTX kept spinning and warping the star, so the formation is redone in code
   with `tools/video/animate_star.py` (configs in `tools/video/cfg-*.json`):
   - Each of the ~260 drone lights is lifted out of the first frame.
   - The sky behind them is rebuilt from the real sky between the lights.
   - Every light is re-rendered on an exact path. The star holds, then makes one smooth 3D turn on its
     vertical axis, while the red and blue rings chase in opposite directions.
   - The Missouri seal, its lettering and the pole stay in front of the drones.
   - All motion repeats exactly once per loop, and the clip's tail crossfades into its head.

   `composite.py` is the earlier version, which only freezes the star and twinkles it.

   **Missouri, not Texas.** A lone star inside a circle reads as the Texas Lone Star, so the star was retired.
   `tools/video/animate_mo.py` (configs `cfg-mo-*.json`) keeps the red and blue rings but removes the star
   lights and draws the Missouri outline in drones instead (traced from the footer map), with a gold star on
   Sedalia. Two comets of light run around the state line and the Sedalia star gently pulses. Run it from
   the repo root so it can read the outline from `index.html`.
4. **Web encodes.** VP9 WebM, with H.264 MP4 as a fallback: 1080p (1.0 MB), 720p and a vertical phone
   cut (0.3 MB). Each has a poster image.

The video starts only when motion is allowed. It pauses off-screen, has a pause button, and shows the
still poster when reduced motion is preferred. Masters live in `_video/`, which is gitignored.

## Technical

- No build step, no frameworks, no trackers, no cookies.
- JSON-LD `Festival`, `FAQPage` and `BreadcrumbList`, plus OG tags, sitemap and robots.
- View Transitions and Speculation Rules for instant page-to-page navigation.
- Skip link, landmarks, `aria-current`, visible focus, reduced-motion support, AA contrast.
- Every page sets `noindex` and robots disallows crawling, so the demo can be shared safely. Remove both at a real launch.

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy

Pushing to `main` deploys to GitHub Pages through `.github/workflows/`.

## Font license

Barlow Condensed (Jeremy Tribby) and Yellowtail (Astigmatic) are self-hosted under the SIL Open Font License 1.1.
