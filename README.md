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
- **Signatures:** prize-ribbon rosette and ribbon-tab cards, admission-stub buttons, and an 11-day rail. The Fair *is* eleven days, so the rail is how the schedule is presented.

## The hero: night at the Main Gate

The home page opens on a 9-second looping video of the fair's real Main Gate at night. The Ferris wheel
turns, the midway lights chase, and a red, white and blue drone-show star twinkles overhead. The 2026 Fair's
Grandstand concerts really did end with fireworks and a drone show.

How it was made (about $5 total on fal):

1. **Night still.** The fair's own Main Gate photo was relit as a night scene with a drone star
   (Nano Banana 2 Edit). For phones, the scene was outpainted to 9:16 (Bria Expand), so the original pixels
   are kept and only sky and plaza were added.
2. **Motion.** LTX-2.5 Pro image-to-video, 10 s, 1080p, static camera. The still is used as both the
   first and the last frame.
3. **Drone star.** LTX kept spinning and warping the star, so `tools/video/composite.py` freezes it from
   the clip's first frame. It then gives each drone light its own looping twinkle and crossfades the
   clip's tail into its head, so the loop has no visible seam.
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

Barlow Condensed (Jeremy Tribby) is self-hosted under the SIL Open Font License 1.1.
