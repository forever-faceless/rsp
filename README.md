# RSP Ventures: website, property register and field survey

A bilingual (English / ಕನ್ನಡ) real estate website for RSP Ventures, with a private admin panel
that doubles as a field tool: the owner signs in on a phone, stands on a property, marks its
location and boundary, and finishes the measurements later on a computer.

Built with Next.js 16, TypeScript, Tailwind CSS 4, Drizzle ORM on SQLite / Turso, Leaflet and GSAP.
The whole backend is JavaScript; there is no separate server to run.

## What is inside

| Area | What it does |
| --- | --- |
| Property numbers | Every listing has a number. `HSN-0001` is an independent property or a whole project; `HSN-0034(012)` is site 12 inside project `HSN-0034`. The letters name the district (HSN Hassan, MYS Mysuru, BNG Bengaluru) and each district counts on its own, so `MYS-0001` is the first Mysuru listing. A number is never reused. Districts are managed in settings. |
| Public site | Home, Properties (one searchable list of independent properties and project sites, with a map view), Projects, property and site pages, Sell with us, About, Contact, Enquire. Every page exists at `/en/...` and `/kn/...`. |
| Find by number | The search box in the header accepts `HSN-0034(012)`, `hsn-0034-012`, `MYS 7`, `34/12` and similar, and opens the listing. A number typed without letters is looked up in the main district. |
| Link previews | A listing's link shared in a chat app shows a picture drawn on request: property number, title, location, dimension, area, facing, price and status, beside the first photo or the site plan. The text under it repeats those details. |
| Price shown | Each property and site chooses what the website shows of its price: the total and the rate per sq ft, the total alone, or the rate alone. The figure held back stays in the office record and is never sent to a page. "Call for price" hides both. A negotiable price is worded "Slightly negotiable". |
| Location | A listing's location is the pin of its survey, and nothing else: the listing forms have no coordinate boxes. The pin can be given a name, which is written on it on every map (blank shows the property number). Saving, attaching, detaching or deleting a survey keeps the listing in step. A listing with no surveyed pin shows no map. |
| Find a place | The survey map has a search box: type a village, road or landmark, or paste coordinates, and the map goes there. Place names come from OpenStreetMap's search, asked from the server for signed-in staff only. |
| Import from Google Earth | A plot drawn in Google Earth can be brought into a survey as a KML or KMZ file. The polygon becomes the boundary, paths become measurements and pins become points. The file is read in the browser. |
| Sold stamp and live figures | A sold listing carries a SOLD stamp across its card. The home page figures (available, sold, projects delivered, clients) count from the register, so they move when a listing is marked sold. The band is switched on in settings and starts off. |
| Feet or metres | Every measurement box in the admin has a feet or metres switch. A figure typed in metres, as documents give it, is converted and saved in feet, which is what the website shows. This applies to the dimensions of a property only. Distances between places, such as a measurement line to the main road, are always in metres. |
| Call for price | A tick box on a property, a site or a whole project shows "Call for price" instead of the figure. The price stays in the admin for office use, is left out of the pages and is ignored by the budget filter. |
| Site plans | A listing with a survey shows a dimensioned drawing of the plot (side lengths, corner letters, area, scale bar, north arrow) and its outline on satellite imagery. |
| Field survey | `/admin/surveys`. GPS pin, boundary by walking the corners or tapping the satellite image, a rectangle tool for regular sites, extra distance lines, labelled points, photos, taped lengths per side. Work is kept on the phone when the signal drops and sent when it returns. |
| Google Earth | Every survey downloads as KML (and GeoJSON). The file opens in Google Earth with the outline and every side length. |
| Video reel | `/admin/surveys/<id>/reel` makes a 9:16 or 1:1 video of the plot: the map closes in from above, the boundary draws itself, the particulars slide in. Made in the browser, downloaded as MP4, and optionally attached to the listing. |
| Leads | Enquiry form on every listing, plus a seller form. Indian mobile validation, honeypot, rate limit. The admin gets one-tap Call and WhatsApp, status tracking, notes and a spreadsheet export. |
| Media | Photos are shrunk in the browser before upload. Videos upload with a progress bar, or can be linked from YouTube and Instagram. |

## Run it locally

```bash
npm install
npm run assets     # builds the logo cut-outs, favicon and link-preview image from public/brand/logo-source.jpg
npm run db:seed    # loads DEMO content (6 properties, 3 projects, 36 sites, surveys, enquiries)
npm run dev
```

Open http://localhost:3000. It redirects to `/en`, or to `/kn` when the browser prefers Kannada.

Admin: http://localhost:3000/admin. The username and password are in `.env.local`
(`ADMIN_USERNAME`, `ADMIN_PASSWORD`). Copy `.env.example` to `.env.local` on a fresh checkout.

> Everything the seed inserts is placeholder data: phone numbers, prices, approval numbers,
> coordinates and testimonials. The dashboard shows a notice while it is present, with a button
> that removes the demo rows and leaves anything you added yourself.

### Testing the survey tool on a real phone

Browsers only share the GPS position with pages served over HTTPS (localhost is the one exception).
To try it on a phone before deploying:

```bash
npx next dev --experimental-https -H 0.0.0.0
```

Then open `https://<your-computer's-IP>:3000/admin` on the phone and accept the certificate warning.
Once the site is deployed on a real domain with HTTPS, nothing special is needed.

On the phone, use the browser's "Add to Home screen" on the admin page. It then opens full screen
like an app, with a shortcut straight to a new survey.

## Environment variables

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin sign in |
| `AUTH_SECRET` | Long random string that signs the login cookie. Required in production. |
| `DATABASE_URL` | `file:./data/local.db` for a file on disk, `libsql://...turso.io` for Turso |
| `TURSO_AUTH_TOKEN` | Turso token, only when using Turso |
| `UPLOAD_DIR` | Folder for uploaded photos, PDFs and videos when no blob store is connected |
| `BLOB_READ_WRITE_TOKEN` | Set by Vercel when a Blob store is connected; uploads then go there |
| `NEXT_PUBLIC_SITE_URL` | Public address, used for the sitemap and link previews |
| `NEXT_PUBLIC_SATELLITE_TILES` | Optional. A `{z}/{x}/{y}` tile address to replace the default satellite imagery |
| `NEXT_PUBLIC_SATELLITE_ATTRIBUTION`, `NEXT_PUBLIC_SATELLITE_MAX_ZOOM` | Credit line and deepest zoom of that imagery |

## Hosting, cheapest first

The app is an ordinary Node.js application. It needs a place to run, a SQLite-compatible database
and somewhere to keep files. Two set-ups are supported without code changes.

### A. One small server (recommended for a business site)

Everything on one machine: the app, the database file and the uploads. A 2 GB virtual server
costs roughly ₹400 to ₹600 a month and has room for many gigabytes of photos and video.

```bash
npm ci && npm run build
DATABASE_URL=file:/var/lib/rsp/local.db UPLOAD_DIR=/var/lib/rsp/uploads npm start
```

Put a reverse proxy with automatic HTTPS in front of it (Caddy does this in three lines), run the
app under systemd or pm2, and back up `/var/lib/rsp` nightly. That folder is the entire site.

One thing to know when self-hosting: the image resizer built into Next.js can stall one size of a
photo if a visitor leaves the page at the instant that size is first being made, and it stays
stalled until the app restarts. The logos are served as ready-made files so they are never
affected. If a listing photo ever stops loading, restart the app. On Vercel the platform resizes
images itself and this does not apply.

### B. Serverless, free to start

1. **Hosting: Vercel.** Import the repository and deploy. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   and `AUTH_SECRET` in the project settings. Vercel's free Hobby plan is for personal,
   non-commercial use only. Showing a company's listings is commercial use even when no
   payment is taken on the site, so a business site belongs on the Pro plan (about US$20 a
   month per member). Option A costs less.
2. **Database: Turso**, from the Vercel Marketplace (free tier). It injects `TURSO_DATABASE_URL`
   and `TURSO_AUTH_TOKEN`. Migrations run automatically on the first request.
3. **Files: Vercel Blob.** Connecting a store injects `BLOB_READ_WRITE_TOKEN`. Photos are uploaded
   through the server; videos go straight from the browser to the store.

Redeploy once after connecting storage so the new variables are picked up.

### Map imagery

Street maps come from OpenStreetMap and satellite imagery from Esri World Imagery, both shown with
their credit lines. Neither needs an account at the traffic a company website sees. If you would
rather have a provider with a contract and a key (MapTiler, Mapbox, or Esri with an API key), set
the three `NEXT_PUBLIC_SATELLITE_*` variables; no code changes are needed.

## Day to day

- **A new property from the field:** Admin, Survey, New survey. Pin the location, mark the boundary,
  add photos. Back at the desk, open the survey and choose *Create the property*. It becomes a
  draft listing with the next number, carrying the location, size and photos.
- **A regular site (30 x 40 and the like):** in the survey's Boundary tool, enter width and depth
  and place the rectangle, then drag and turn it until it sits on the plot in the satellite image.
  Phone GPS is off by a few metres, which is a lot on a small plot, so this is more exact than
  walking the corners.
- **Taped measurements:** type them against each side in the survey. They replace the GPS-derived
  lengths on the website and in Google Earth.
- **Google Earth:** download the KML from the survey, then in Google Earth choose File, Import KML
  file. Add further measurements there as usual.
- **A layout:** Admin, Projects, New project. Add sites one at a time or as a numbered run. Survey
  the boundary of the layout and, site by site, the plots; they appear on the project's map
  coloured by availability.
- **Bilingual text:** every field has an English and a ಕನ್ನಡ version. Kannada falls back to English
  when left empty. Lists such as highlights are one item per line in the form `English | ಕನ್ನಡ`.
- **Enquiries:** Admin, Enquiries. Call or WhatsApp with one tap, set the status, add notes,
  download a spreadsheet.

## Accuracy, stated plainly

A phone's GPS is typically accurate to 3 to 5 metres in the open. Boundaries walked with GPS are
good for showing where a property is and roughly how it lies; they are not a substitute for a
licensed surveyor's sketch. The website says so under every plan drawn from GPS readings, and
marks plans as measured only when every side has a taped length or the plot was placed on the map.

## Project structure

```
src/app/(site)/[locale]/     public pages (en / kn)
src/app/(admin)/admin/       admin panel, survey tool, reel maker
src/app/api/                 number lookup, video upload
src/app/uploads/[...path]/   serves locally stored uploads, with byte ranges for video
src/components/site/         public UI (hero, cards, plot plan, forms)
src/components/admin/        admin UI (forms, media, survey tool)
src/components/map/          Leaflet map used on public pages
src/components/motion/       GSAP entrances, counters and the page curtain
src/lib/db/                  Drizzle schema, client (auto-migrates), queries
src/lib/actions/             server actions
src/lib/refs.ts              property number formatting and parsing
src/lib/geo.ts, survey.ts    distances, areas, plot geometry
src/lib/plan.ts              lays out the site plan drawing
src/lib/kml.ts               Google Earth and GeoJSON export
src/lib/reel.ts              draws the frames of the video reel
src/proxy.ts                 locale redirect and admin session guard
drizzle/                     SQL migrations (generated from src/lib/db/schema.ts)
scripts/                     assets.ts (logo, icons), seed.ts (demo data)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint |
| `npm run db:generate` | Generate a new migration after editing `schema.ts` |
| `npm run db:seed [-- --reset]` | Insert demo content (optionally wiping existing content first) |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run assets` | Rebuild the logo cut-outs, icons and link-preview image |
