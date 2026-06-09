# Beplantingsplantekening — Projectdocumentatie

> Volledige technische beschrijving van de applicatie, database, API-routes,
> state management, filterpipeline, keurmerk systeem en editor.
> Bijgewerkt na sessie: keurmerken toegevoegd + volledige editor documentatie.

---

## Inhoudsopgave

1. [Wat doet de app?](#1-wat-doet-de-app)
2. [Technische stack](#2-technische-stack)
3. [Mappenstructuur](#3-mappenstructuur)
4. [Database — volledig schema](#4-database--volledig-schema)
5. [Feed sync pipeline](#5-feed-sync-pipeline)
6. [API-routes](#6-api-routes)
7. [TypeScript types](#7-typescript-types)
8. [Zustand stores](#8-zustand-stores)
9. [Persistentie (localStorage)](#9-persistentie-localstorage)
10. [Pagina's en routing](#10-paginas-en-routing)
11. [Workflow (7 stappen)](#11-workflow-7-stappen)
12. [Filterpipeline — wizard naar plantenlijst](#12-filterpipeline--wizard-naar-plantenlijst)
13. [Keurmerk systeem](#13-keurmerk-systeem)
14. [Huisstijl](#14-huisstijl)
15. [Omgevingsvariabelen](#15-omgevingsvariabelen)
16. [Bekende keuzes en aandachtspunten](#16-bekende-keuzes-en-aandachtspunten)
17. [Editor — canvas architectuur](#17-editor--canvas-architectuur)
18. [Editor — object types](#18-editor--object-types)
19. [Editor — PolyObject datamodel](#19-editor--polyobject-datamodel)
20. [Editor — teken tools en modi](#20-editor--teken-tools-en-modi)
21. [Editor — Zustand stores](#21-editor--zustand-stores)
22. [Editor — bulge / bogen systeem](#22-editor--bulge--bogen-systeem)
23. [Editor — boundary systeem (schuttingen, hekken)](#23-editor--boundary-systeem-schuttingen-hekken)
24. [Editor — boomvak varianten](#24-editor--boomvak-varianten)
25. [Editor — meting en coördinatensysteem](#25-editor--meting-en-coördinatensysteem)
26. [Editor — uitlijning en snapping](#26-editor--uitlijning-en-snapping)
27. [Editor — undo / redo](#27-editor--undo--redo)
28. [Editor — useDrawingLifecycle hook](#28-editor--usedrawinglifecycle-hook)
29. [Editor — performance optimalisaties](#29-editor--performance-optimalisaties)
30. [Editor — toetsenbordsnelkoppelingen](#30-editor--toetsenbordsnelkoppelingen)

---

## 1. Wat doet de app?

Een **beplantingsplan-editor** voor professionele hoveniers. De gebruiker:

1. Tekent tuinvlakken op een canvas (plantbedden, bomen, hagen, gebouwen, etc.)
2. Beantwoordt wizard-vragen over standplaats, grondsoort, stijl en hoogte
3. Kiest planten uit een catalogus (gefilterd op basis van de wizard-antwoorden)
4. Koppelt planten aan specifieke plantbedden in de tekening
5. Rondt het plan af tot een printbaar document

De plantencatalogus komt uit een Google Shopping XML-feed van `olaf-nijenkamp.nl`,
die via een sync-commando in een lokale SQLite-database wordt opgeslagen.

---

## 2. Technische stack

| Onderdeel | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Taal | TypeScript |
| Canvas | react-konva (Konva.js) |
| State | Zustand v5 |
| Database | SQLite via better-sqlite3 (synchronous, server-only) |
| Styling | Tailwind CSS + inline styles |
| XML-parsing | fast-xml-parser |
| Polygon math | clipper-lib |
| Fonts | DM Sans (Google Fonts) |

---

## 3. Mappenstructuur

```
src/
├── app/
│   ├── page.tsx                          # Canvas editor (hoofdpagina)
│   ├── plantenlijst/page.tsx             # Stap 5 — plant selectie
│   ├── beplantingsplan-afronden/page.tsx # Stap 7 — finalisatie
│   └── api/
│       ├── plants/
│       │   ├── route.ts                  # GET /api/plants
│       │   └── [id]/variants/route.ts   # GET /api/plants/[id]/variants
│       ├── garden-materials/route.ts    # GET /api/garden-materials
│       └── admin/
│           ├── sync/route.ts            # POST /api/admin/sync
│           └── sync-status/route.ts     # GET /api/admin/sync-status
├── features/editor/
│   ├── components/
│   │   ├── editor/                      # Canvas editor componenten
│   │   ├── plantSelection/              # Stap 5 componenten
│   │   │   ├── PlantProposalGrid.tsx    # Grid + lijst kaarten (ALLE 4 kaarttypen)
│   │   │   ├── PlantSelectionFiltersCard.tsx  # Filters sidebar
│   │   │   └── PlantSelectionPage.tsx   # Hoofdpagina stap 5
│   │   └── LinkedPlantSpecificationsOverlay.tsx
│   ├── config/
│   │   └── editorWorkflowConfig.ts      # 7-stappen workflow definitie
│   ├── hooks/
│   │   └── useDrawingLifecycle.ts       # Laden/opslaan tekeningen
│   ├── lib/
│   │   ├── plantScoring.ts             # Scoring: zeer geschikt / geschikt / goede aanvulling
│   │   ├── plantSelectionDummyData.ts   # Filter opties + groep definities
│   │   └── ...
│   └── state/                           # Zustand stores
├── lib/db/
│   ├── plantDatabase.ts                 # SQLite verbinding + schema + migraties
│   ├── plantQueries.ts                  # Query functies (WHERE clausules)
│   ├── plantTypes.ts                    # TypeScript types
│   ├── feedParser.ts                    # XML → ParsedFeedItem[]
│   └── feedSync.ts                      # Volledige sync pipeline
└── state/
    ├── projectStore.ts                  # Canvas objecten (hoofd state)
    └── areaMetrics.ts                   # Oppervlakte/afstand berekeningen
```

---

## 4. Database — volledig schema

**Locatie:** `data/plants.db` (staat in `.gitignore` — niet in GitHub)
**Driver:** better-sqlite3 (synchronous, server-side only)
**Modus:** WAL (Write-Ahead Logging) voor snellere writes

### Tabel: `plants`

Één rij per unieke plant/cultivar, gegroepeerd op `trefnaam` (SKU-basis).

| Kolom | Type | Standaard | Omschrijving |
|---|---|---|---|
| `id` | TEXT PK | — | Trefnaam/SKU (bijv. "RHICGRAN") |
| `botanical_name` | TEXT NOT NULL | — | Wetenschappelijke/handelsnaam |
| `dutch_name` | TEXT NOT NULL | — | Nederlandse naam |
| `category` | TEXT NOT NULL | — | Feed-categorie (bijv. "Vaste planten") |
| `app_group` | TEXT NOT NULL | — | UI-tab (zie PlantAppGroup) |
| `standplaats` | TEXT | `''` | Kommagescheiden: "zon, halfschaduw" |
| `grondsoort` | TEXT | `''` | Kommagescheiden grondsoorten |
| `bloeiperiode` | TEXT | `''` | Bijv. "mei - juni" |
| `kleur_bloem` | TEXT | `''` | Kommagescheiden bloemkleuren |
| `kleur_blad` | TEXT | `''` | Kommagescheiden bladkleuren |
| `volwassen_hoogte` | TEXT | `''` | Ruwe tekst, bijv. "100-150 cm" |
| `max_height_cm` | INTEGER | `0` | Geparsede maximale hoogte (0 = onbekend) |
| `planthoeveelheid_per_m2` | INTEGER | `1` | Plantdichtheid |
| `inheems` | INTEGER | `0` | 0 = nee, 1 = ja |
| `stikstofbehoefte` | TEXT | `''` | Stikstofbehoefte label |
| `toelichting` | TEXT | `''` | Extra notities |
| `image_url` | TEXT | `''` | URL naar productafbeelding |
| `min_price` | REAL | `0` | Goedkoopste in-stock prijs (excl. BTW) |
| `in_stock` | INTEGER | `0` | 1 als minstens één variant op voorraad is |
| `keurmerken` | TEXT | `''` | Kommagescheiden keurmerken, bijv. "MPS-A, Biologisch" |
| `updated_at` | TEXT | — | ISO-8601 timestamp van laatste sync |

**PlantAppGroup waarden:**
`bodembedekkers` | `vaste-planten` | `hagen` | `heesters-struiken` | `bomen` | `overig`

### Tabel: `plant_variants`

Één rij per verkoopbaar product (maat × prijs variant).

| Kolom | Type | Standaard | Omschrijving |
|---|---|---|---|
| `id` | TEXT PK | — | Product-ID vanuit de feed |
| `plant_id` | TEXT NOT NULL | — | FK → plants(id) ON DELETE CASCADE |
| `size_label` | TEXT | `''` | Bijv. "80-100 cm met kluit boskwaliteit" |
| `price` | REAL | `0` | Prijs excl. 9% BTW |
| `availability` | TEXT | `'out_of_stock'` | `"in_stock"` \| `"out_of_stock"` |
| `updated_at` | TEXT | — | ISO-8601 timestamp |

### Tabel: `sync_log`

| Kolom | Type | Omschrijving |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | — |
| `started_at` | TEXT | ISO-8601 starttijdstip |
| `finished_at` | TEXT | ISO-8601 eindtijdstip |
| `success` | INTEGER | 0 of 1 |
| `plants_imported` | INTEGER | Aantal unieke planten geschreven |
| `variants_imported` | INTEGER | Aantal varianten geschreven |
| `skipped_items` | INTEGER | Feed-items zonder trefnaam/naam |
| `duration_ms` | INTEGER | Duur in milliseconden |
| `error` | TEXT | NULL bij succes, foutmelding bij mislukking |

### Tabel: `garden_materials` + `garden_material_variants`

Tuinmaterialen (apart van planten, vanuit dezelfde feed). Zelfde structuur als plants/plant_variants maar zonder botanische velden.

### Database-indexes

```sql
idx_plants_app_group       ON plants(app_group)
idx_plants_in_stock        ON plants(in_stock)
idx_plants_inheems         ON plants(inheems)
idx_plants_dutch_name      ON plants (dutch_name COLLATE NOCASE)
idx_variants_plant_id      ON plant_variants(plant_id)
idx_gmat_in_stock          ON garden_materials(in_stock)
idx_gmat_variants_mid      ON garden_material_variants(material_id)
```

### Migraties (automatisch bij startup)

De `initialiseSchema` functie in `plantDatabase.ts` voert migrations uit bij elke opstart:
- Voegt `max_height_cm` toe als de kolom ontbreekt
- Voegt `toelichting` toe als de kolom ontbreekt
- Voegt `keurmerken` toe als de kolom ontbreekt ← nieuw

### Huidige database-inhoud (na laatste sync)

- **~9.967 unieke planten** in de `plants` tabel
- **~30.000+ varianten** in de `plant_variants` tabel
- Vaste planten met keurmerk: **2270** | zonder: **3304** | totaal: **5574**
- Heesters & struiken met keurmerk: **1549** | zonder: **1402** | totaal: **2951**

---

## 5. Feed sync pipeline

**Feed URL:** `https://olaf-nijenkamp.nl/shopping_feed_assortiment`

### Keurmerk in de feed

Het `<keurmerken>` veld is een **eigen XML-tag** op variant-niveau (NIET in de `<kenmerken>` JSON):

```xml
<keurmerken>MPS-A</keurmerken>
```

Mogelijke waarden in de feed: `MPS`, `MPS-A`, `MPS-A+`, `MPS-ABC`, `MPS-C`, `MPS-GAP`,
`MPS-S`, `NL greenlabel`, `PP GK`, `PlanetProof`, `Skal`, `Biologisch`

Per plant worden alle unieke keurmerken van alle varianten samengevoegd tot één
kommagescheiden string (bijv. `"MPS, MPS-A+"`).

### Sync uitvoeren

```powershell
curl.exe -X POST http://localhost:3000/api/admin/sync -H "x-sync-secret: JOUW_WACHTWOORD"
```

---

## 6. API-routes

### GET `/api/plants`

Gepagineerde, gefilterde plantenlijst.

**Query parameters:**

| Parameter | Type | Omschrijving |
|---|---|---|
| `q` | string | Vrije tekst op naam |
| `appGroup` | PlantAppGroup | Filter op UI-tab |
| `standplaats` | string (herhaalbaar) | OR-logica |
| `grondsoort` | string (herhaalbaar) | OR-logica |
| `bloeiperiode` | string (herhaalbaar) | OR-logica |
| `kleur` | string (herhaalbaar) | Bloemkleur filter |
| `category` | string (herhaalbaar) | Feed-categorie filter |
| `inheems` | "true" / "false" | Inheems filter |
| `inStockOnly` | "true" | Alleen op voorraad |
| `minHeightCm` | number | Minimale hoogte in cm |
| `maxHeightCm` | number | Maximale hoogte in cm |
| `keurmerkFilter` | "alleen-met-keurmerk" \| "alleen-zonder-keurmerk" | Wizard keurmerk filter |
| `keurmerk` | string (herhaalbaar) | Specifieke keurmerken (OR-logica, zoek-zelf filter) |
| `sort` | "a-z" / "z-a" | Alfabetische sortering |
| `page` | number | Pagina (1-based) |
| `limit` | number | Items per pagina (max 200) |

**Cache:** 5 minuten (`s-maxage=300, stale-while-revalidate=60`)

---

## 7. TypeScript types

### ApiPlant (wat de browser ontvangt)

```typescript
type ApiPlant = {
  id: string;
  botanicalName: string;
  dutchName: string;
  category: string;
  appGroup: PlantAppGroup;
  standplaatsen: string[];
  grondsoorten: string[];
  bloeiperiode: string;
  kleuren: string[];
  kleurBlad: string[];
  volwassenHoogte: string;
  maxHeightCm: number;
  planthoeveelheidPerM2: number;
  inheems: boolean;
  stikstofbehoefte: string;
  toelichting: string;
  imageUrl: string;
  pricePerPiece: number;
  inStock: boolean;
  keurmerken: string[];   // ← nieuw: bijv. ["MPS-A", "Biologisch"]
};
```

### PlantQueryParams

```typescript
type PlantQueryParams = {
  // ... (alle standaard filters)
  keurmerkFilter?: "alleen-met-keurmerk" | "alleen-zonder-keurmerk";  // wizard filter
  keurmerken?: string[];  // zoek-zelf specifieke keurmerken (OR)
};
```

---

## 8. Zustand stores

### rightStepMenuStore — Wizard-antwoorden (stappen 1–4)

```typescript
{
  activeStep: 1 | 2 | 3 | 4;
  step1: { locationType, gardenZones[] };
  step2: {
    standplaatsen[],
    groundTypes[],
    maintenanceLevel,
    certificationPreference  // "maakt-niet-uit" | "alleen-met-keurmerk" | "alleen-zonder-keurmerk"
  };
  step3: { structureStyle, customPercentages: { bodembedekkers, vastePlanten, heestersEnStruiken, bomen } };
  step4: { seasonExperience, heightStyle };
}
```

### plantCatalogStore — Filters

```typescript
type PlantCatalogFilters = {
  q: string;
  appGroup: PlantAppGroup | undefined;
  standplaatsen: string[];
  grondsoorten: string[];
  bloeiperiodes: string[];
  kleuren: string[];
  categories: string[];
  inheems: boolean | undefined;
  inStockOnly: boolean;
  minHeightCm: number | undefined;
  maxHeightCm: number | undefined;
  keurmerkFilter: "maakt-niet-uit" | "alleen-met-keurmerk" | "alleen-zonder-keurmerk" | undefined;
  keurmerken: string[];   // ← zoek-zelf specifieke keurmerken
  sort: "a-z" | "z-a" | undefined;
};
```

---

## 9. Persistentie (localStorage)

Alle tekendata wordt lokaal opgeslagen. Geen server-side persistentie.

| Sleutel | Inhoud |
|---|---|
| `hello-editor:drawings:v1` | Alle tekeningen |
| `hello-editor:drawings:v1::active-drawing` | ID van de actieve tekening |
| `hello-editor:drawings:v1::plant-selection` | PlantSelectie-snapshot per tekening-ID |
| `hello-editor:drawings:v1::panel-mode` | Panel-modus per tekening-ID |

---

## 10. Pagina's en routing

| Route | Pagina | Omschrijving |
|---|---|---|
| `/` | `HelloEditor` | Hoofdcanvas |
| `/plantenlijst` | `PlantSelectionPage` | Stap 5 — planten kiezen |
| `/beplantingsplan-afronden` | `FinalisatiePage` | Stap 7 — plan afronden |
| `/api/plants` | — | Plant catalogus API |
| `/api/plants/[id]/variants` | — | Plant varianten API |
| `/api/garden-materials` | — | Tuinmaterialen API |
| `/api/admin/sync` | — | Feed sync (POST, beveiligd) |
| `/api/admin/sync-status` | — | Sync status (GET, beveiligd) |

---

## 11. Workflow (7 stappen)

| Stap | Naam | Route |
|---|---|---|
| 1 | Locatie bepalen | `/` (rechter panel) |
| 2 | Situatie & randvoorwaarden | `/` (rechter panel) |
| 3 | Structuur & opbouw | `/` (rechter panel) |
| 4 | Beleving & ruimte | `/` (rechter panel) |
| 5 | Plantenvoorstel & aanpassen | `/plantenlijst` |
| 6 | Planten koppelen in tekening | `/` (canvas) |
| 7 | Beplantingsplan afronden | `/beplantingsplan-afronden` |

---

## 12. Filterpipeline — wizard naar plantenlijst

Dit is het meest complexe deel van de app. Er zijn twee aparte filterpaden.

### Pad A — Categorietabs (bodembedekkers, vaste-planten, hagen, heesters-struiken, bomen)

De wizard-antwoorden uit stap 2–4 worden omgezet naar API-filters.

```
Wizard stap 2-4
    ↓
PlantSelectionPage: useEffect (filter sync)
    ↓
setMultipleCatalogFilters({
  appGroup: selectedGroup,          ← tab (bijv. "vaste-planten")
  standplaatsen: step2.standplaatsen,
  grondsoorten: step2.groundTypes (gemapped via STEP2_GRONDSOORT_TO_FILTER_OPTION),
  minHeightCm / maxHeightCm: step4.heightStyle (via heightStyleToRange),
  keurmerkFilter: step2.certificationPreference
})
    ↓
plantCatalogStore.fetchPlants()
    ↓
GET /api/plants?appGroup=...&standplaats=...&keurmerkFilter=...
    ↓
plantQueries.ts: buildWhereClause() → SQL WHERE
    ↓
SQLite query → resultaten
```

**Grondsoort mapping** (`STEP2_GRONDSOORT_TO_FILTER_OPTION`):

| Wizard waarde | DB filter waarde |
|---|---|
| `zandgrond` | `Zandgrond` |
| `klei` | `Klei` |
| `lichte-klei-zandleem` | `Lichte klei` |
| `humusrijk-bosgrond` | `Humusrijke grond` |
| `veengrond-nat` | `Veengrond` |

**Hoogte mapping** (`heightStyleToRange`):

| Wizard waarde | SQL filter |
|---|---|
| `laag-horizontaal` | `max_height_cm <= 150` |
| `accent-op-hoogte` | `max_height_cm >= 60` |
| `gelaagd-ruimtelijk` | geen filter |

**Keurmerk mapping** (wizard stap 2 → `keurmerkFilter`):

| Wizard waarde | SQL filter |
|---|---|
| `maakt-niet-uit` | geen filter |
| `alleen-met-keurmerk` | `keurmerken != ''` |
| `alleen-zonder-keurmerk` | `keurmerken = ''` |

### Soft scoring (labels)

Op de gefilterde resultaten wordt client-side een score berekend:

| Score | Label |
|---|---|
| ≥ 75% | Zeer geschikt |
| 60–74% | Geschikt |
| 40–59% | Goede aanvulling |
| < 40% | Niet getoond |

Score is gebaseerd op: % standplaats match + % grondsoort match + hoogte groep (primary=100%, secondary=50%).

**Keurmerk telt NIET mee in de score** — het is een harde aan/uit filter.

### Pad B — Zoek zelf een plant

In de "zoek-zelf" tab worden de wizard-filters NIET toegepast. De gebruiker zoekt handmatig in de volledige catalogus.

```
Zoek-zelf advancedFilters (lokale state)
    ↓
setMultipleCatalogFilters({
  appGroup: undefined,           ← geen categoriefilter
  standplaatsen: advancedFilters.standplaatsen,
  grondsoorten: advancedFilters.grondsoorten,
  bloeiperiodes: advancedFilters.bloeiperiodes,
  kleuren: advancedFilters.kleuren,
  categories: advancedFilters.plantgroepen,
  keurmerkFilter: undefined,     ← wizard filter wordt NIET meegenomen
  keurmerken: advancedFilters.keurmerken,  ← specifieke keurmerken (OR)
})
```

De `keurmerken` array (specifieke keurmerken) in SQL:
```sql
(keurmerken LIKE '%MPS-A%' OR keurmerken LIKE '%Biologisch%')
```

### Initialisatie-volgorde (belangrijk!)

Er was een timing bug waarbij de filter sync `useEffect` runde vóórdat de Zustand stores
gehydreerd waren vanuit localStorage. **Fix:** In het hydration `useEffect` worden de
catalog-filters nu direct toegepast via `usePlantCatalogStore.getState().setMultipleFilters()`
met de waarden die net uit localStorage zijn gelezen — vóór de React re-render.

Tevens: als `selectedGroup = "zoek-zelf"` in het snapshot staat, wordt dit overschreven
naar `"bodembedekkers"` bij hydration, omdat zoek-zelf geen wizard-filters toepast.

---

## 13. Keurmerk systeem

### In de feed

XML-veld `<keurmerken>` per variant, één waarde per item:
```xml
<keurmerken>MPS-A</keurmerken>
```

### In de database

Kolom `keurmerken TEXT NOT NULL DEFAULT ''` in de `plants` tabel.
Opgeslagen als kommagescheiden string van unieke keurmerken over alle varianten:
`"MPS, MPS-A+"` of `"Biologisch"` of `""` (geen keurmerk).

### Logo mapping

Bestand: `public/images/keurmerken/`

| Keurmerk(en) | Bestand |
|---|---|
| MPS, MPS-A, MPS-A+, MPS-ABC, MPS-C, MPS-GAP, MPS-S | `MPS.png` |
| PlanetProof | `planet-proof.svg` |
| NL greenlabel | `nl-greenlabel.png` |
| Groenkeur | `groenkeur.png` |
| Skal, Biologisch | `skal-biologisch.png` |
| PP GK | `planet-proof.svg` + `groenkeur.png` (twee logo's) |

Deduplicatie: als een plant zowel `PlanetProof` als `PP GK` heeft, verschijnt
`planet-proof.svg` maar één keer. Logica zit in `getKeurmerkImages()` in `PlantProposalGrid.tsx`.

### Logo positie per kaarttype

Alle vier kaarttypen zitten in `PlantProposalGrid.tsx`:

| Kaart | Positie logos |
|---|---|
| Categorie grid (`DefaultPlantCard` grid) | Boven "Op voorraad" tekst |
| Categorie lijst (`DefaultPlantCard` list) | Boven "Op voorraad" tekst, mt-auto onderaan |
| Zoek-zelf grid (`SearchModeGridCard`) | Onder maatvoering, boven prijs |
| Zoek-zelf lijst (`SearchModeListCard`) | Onder prijs, mt-auto uitgelijnd met onderkant foto |

Logo-container rendert altijd met `minHeight: 20px`, ook als er geen logo's zijn.
Dit zorgt dat de prijs/voorraad-tekst altijd op dezelfde hoogte staat.

### Wizard filter (stap 2)

Drie opties in `rightStepMenuConfig.ts`:
- `maakt-niet-uit` → geen filter
- `alleen-met-keurmerk` → `keurmerken != ''` in SQL
- `alleen-zonder-keurmerk` → `keurmerken = ''` in SQL

Dit filter heeft **geen effect** op de "zoek-zelf" tab.

### Zoek-zelf filter

In de filters sidebar (onder Bloeiperiode) zit een "Keurmerk" uitklap-filter met alle
12 keurmerken als checkboxes. Werkt met OR-logica. Geselecteerde keurmerken verschijnen
als chips onder de zoekbalk. Heeft **geen effect** op de categorietabs.

---

## 14. Huisstijl

**Lettertype:** DM Sans (400, 500, 600, 700) via Google Fonts

### Kleuren

| Naam | Hex | Gebruik |
|---|---|---|
| Oranje (primair) | `#E94E1B` | Knoppen, actieve states |
| Groen (secundair) | `#58694C` | Iconen, actieve tekst |
| Groen licht | `#EEF0ED` | Achtergronden |
| Tekst | `#111111` | Primaire tekst |
| Muted | `#6B7280` / `#898988` | Subtekst |
| Border | `#E3E2E2` | Randen |
| Pagina BG | `#F7F6F4` | Achtergrondkleur |
| Prijs | `#FF0000` | Prijsweergave |

### Design-patronen

- Afrondingen: 6px (knoppen), 8px (grotere kaartjes), 4px (inputs)
- Schaduwen: `0 2px 8px rgba(0,0,0,0.04)`
- `COLORS`-constanten worden per component apart gedefinieerd (geen centraal thema)

---

## 15. Omgevingsvariabelen

Bestand: `.env.local` (staat in `.gitignore`)

| Variabele | Gebruik |
|---|---|
| `SYNC_SECRET` | Beveiliging van `/api/admin/sync` en `/api/admin/sync-status` |

---

## 16. Bekende keuzes en aandachtspunten

### Database staat niet in GitHub
`data/plants.db` staat in `.gitignore`. Na `git pull` eerst een sync uitvoeren.

### Geen server-side persistentie voor tekeningen
Alle tekendata staat in `localStorage`. Wisselen van browser = lege tekening.

### BTW-berekening
De feed levert prijzen inclusief 9% BTW. De parser deelt door 1.09. UI toont altijd netto.

### COLORS niet gecentraliseerd
Elk component definieert eigen `const COLORS = { ... }`. Kleurwijziging vereist aanpassingen op meerdere plekken.

### Turbopack crashes
Bij crashes: verwijder `.next/` en herstart met `npm run dev`.

### Keurmerk scoring
Keurmerken tellen NIET mee in de zachte scoring (Zeer geschikt / Geschikt / Goede aanvulling).
Dat is bewust: het is een harde aan/uit filter, geen kwaliteitsmaat.

### Zoek-zelf en wizard filters
De wizard-filters uit stap 2–4 (standplaats, grondsoort, hoogte, keurmerk) hebben
**alleen effect op de categorietabs** (bodembedekkers, vaste-planten, hagen,
heesters-struiken, bomen). De "Zoek zelf een plant" tab zoekt altijd in de volledige
catalogus ongeacht wat in de wizard is ingevuld.

### Initialisatie timing
De wizard-filters worden direct toegepast in het hydration `useEffect` van
`PlantSelectionPage.tsx` (via `usePlantCatalogStore.getState().setMultipleFilters()`).
Dit omzeilt een timing-probleem waarbij de filter sync `useEffect` te vroeg runde.

---

## 17. Editor — canvas architectuur

### Componenthiërarchie

```
app/page.tsx
└── HelloEditor                          # Wrapper, laadt useDrawingLifecycle
    ├── BaseFillLayer (react-konva Stage) # Vlakken (fill, achtergrondobjecten)
    ├── BaseStrokeLayer (react-konva)     # Contouren + boundary-render-pieces
    └── EditorTopLayer (react-konva)      # Interactie: vertices, handles, previews
        ├── AlignmentGuidesSection        # Uitlijnlijnen tijdens verslepen
        ├── BulgeDragSection              # Boogapex-handle tijdens bogsleep
        ├── MeasureToolOverlay            # Meetgereedschap UI
        └── LiveMeasurementSection        # Live maten tijdens vertex/edge-drag
```

**BaseFillLayer** (`BaseFillLayer.tsx`)
- Renders alle `PolyObject`s als gevulde Konva-shapes.
- Gebruikt `React.memo` — re-rendert alleen als `objects` array wijzigt.
- Polygon-objecten → `Konva.Line` (closed=true, fill+stroke).
- Polyline/boundary-objecten → rendert `renderPieces[]` als dikke banden.
- Treebed: apart render-pad met stam, kruin, leivorm-silhouet, etc.

**BaseStrokeLayer** (`BaseStrokeLayer.tsx`)
- Rendert de outline-contouren en eventuele plantbed-nummerlabels.
- Apart van fills zodat z-ordering correct is (stroke altijd boven fill).

**EditorTopLayer** (`EditorTopLayer.tsx`, ~4300 regels)
- Bevat alle interactieve Konva-elementen: vertex-handles, edge-handles, selectiekader, boogapex-handles, snapping-overlays, teken-preview.
- Luistert op `onMouseMove` / `onMouseDown` / `onMouseUp` / `onClick` van het Stage-element.
- Stuurt updates door naar `projectStore` via actions (geen directe state-mutaties).

### Stage en viewport

- De Konva `Stage` beslaat de volledige viewport (`window.innerWidth × window.innerHeight`).
- Pan/zoom via `stagePos` (x, y) en `stageScale` in `projectStore`.
- Hand-tool: panning via `Stage.draggable`.
- Scroll → zoom in/uit op het cursor-punt (exponentieel, `zoomFactor = 1.08`).

---

## 18. Editor — object types

Alle types zijn gedefinieerd in `src/features/editor/components/editor/objectMenuConfig.ts`.

### Ondergrond (geometry: polygon, `visibilityGroup: showGround`)

| Type | Label | Fill | Stroke |
|---|---|---|---|
| `grass` | Gras | `#DCE9DC` | `#4F6B4F` |
| `sand` | Zand | `#F3E2A4` | `#C2A44A` |
| `gravel` | Grind | `#CFC6B6` | `#9C8F7A` |
| `tiles` | Tegels/bestrating | `#E6E6E6` | `#8A8A8A` |
| `water` | Water | `#DCEAF4` | `#5C89A6` |
| `wood` | Hout | `#C9A27A` | `#8B5E3C` |
| `patio` | Terras | `#E2D4C2` | `#B8A48C` |
| `asphalt` | Asfalt | `#6E6E6E` | `#4B4B4B` |
| `concrete` | Beton | `#CFCFCF` | `#8F8F8F` |
| `parking` | Parkeerplaatsen | `#B8BDC4` | `#6B7280` |
| `road` | Rijbaan / weg | `#6E6E6E` | `#4B4B4B` |
| `bike_path` | Fietspad | `#C46E6E` | `#7C4747` |
| `footpath` | Voetpad | `#CFC6B6` | `#9C8F7A` |
| `sidewalk` | Stoep | `#E6E6E6` | `#8A8A8A` |
| `walking_path` | Wandelpad | `#E2D4C2` | `#B8A48C` |

### Verkeer/gebruik (polygon, `showGround`)

`road`, `bike_path`, `footpath`, `sidewalk`, `walking_path` — zie tabel boven.

### Afbakening / randen (polyline, `showBoundaries`)

| Type | Label |
|---|---|
| `border_edge` | Borderrand |
| `curb` | Opsluitband |
| `wall` | Muur |
| `bollards` | Paaltjes |
| `fence` | Schutting |
| `gate` | Hek |
| `poort` | Poort / toegangshek |

### Gebouwen (polygon, `showBuildings`)

`bridge`, `play_equipment`, `generic_building`, `office_building`, `warehouse`,
`storage`, `woonblok`, `house`, `garage`, `shed`, `garden_house`, `carport`, `veranda`, `canopy`

### Beplanting

| Type | Geometry | Label | visibilityGroup |
|---|---|---|---|
| `plantbed` | polygon | Plantvak | `showPlantbeds` |
| `hedge` | polygon | Haag | `showPlantbeds` |
| `treebed` | polygon | Boomvak | `showTreebeds` |

### zIndex volgorde (laag → hoog)

Ondergrond (1–15) → Randen (20–25) → Beplanting (30–31) → Gebouwen (40–51) → Schuttingen/hekken (60–62)

---

## 19. Editor — PolyObject datamodel

Definitie: `src/state/projectStore.ts` (geëxporteerd als `PolyObject`).

```typescript
type PolyObject = {
  id: string;                    // UUID
  type: ObjectType;              // bijv. "plantbed", "grass", "fence"
  geometry?: GeometryKind;       // "polygon" | "polyline" — afgeleid uit type als absent
  points: number[];              // flat array [x1,y1, x2,y2, ...] in editor-units

  // Polygon-specifiek
  holes?: number[][];            // tegenwijzers polygonen (gaten in vlak)
  bulges?: number[];             // bogen per segment — zie sectie 22

  // Polyline / boundary-specifiek
  boundarySegments?: number[][]; // meerdere losse lijnstukken binnen één object
  renderPieces?: number[][];     // gecachede dikke-banden-polygonen (afgeleid, niet bron)
  renderSide?: 1 | -1;           // welke zijde de band wordt getekend

  // Boomvak-specifiek
  treebedVariant?: TreebedVariant; // "standard" | "multi_stem" | "espalier" | "roof"
  rotationDeg?: number;          // rotatie in graden (leivorm)

  // Plantvak-specifiek
  plantbedNo?: number;           // volgnummer voor koppeling aan planten

  // Optioneel
  customStyle?: { fill?: string; stroke?: string };
};
```

**Coördinaten:** altijd in **editor-units** (niet pixels, niet meters). Zie sectie 25 voor de schaal.

**Flat array formaat:** `[x1, y1, x2, y2, x3, y3, ...]` — ook voor holes en boundarySegments.

**Geen server-side persistentie.** Alle objecten leven in `projectStore` en worden via `useDrawingLifecycle` naar `localStorage` geschreven.

---

## 20. Editor — teken tools en modi

### EditorTool type

```typescript
type EditorTool = "select" | "hand" | "cut" | "draw" | "measure";
```

In `projectStore`: `activeTool: EditorTool`

### Tool gedrag

| Tool | Omschrijving |
|---|---|
| `select` | Klikken = object selecteren. Slepen op geselecteerd object = verplaatsen. Vertex-handles verschijnen op geselecteerd object. |
| `hand` | Canvas pannen (Stage.draggable=true). Geen object-selectie. |
| `draw` | Polygon/polyline tekenen door te klikken. Elke klik = nieuw punt. Dubbelklik of klik op startpunt = afsluiten. |
| `cut` | Knip een gat in een bestaand polygon-object. Werkt als draw maar produceert een hole of split-resultaat via clipper-lib. |
| `measure` | Klik twee punten om de afstand te meten. Toont lijn + afstandslabel in meters. |

### Tekenflow (draw tool)

1. Eerste klik → `drawStart`: maakt tijdelijk preview-object aan in `drawPreviewStore`.
2. Volgende kliks → punten worden toegevoegd aan `currentDrawPoints` in `projectStore`.
3. `drawPreviewStore.previewPoint` volgt de muiscursor (via `setDrawPreviewPoint`) — dit triggert alleen `EditorTopLayer` re-render, niet `HelloEditor`.
4. Afsluiten (dubbelklik of klik op startpunt) → `finalizeDrawing()` action in `projectStore`.
5. Object wordt genormaliseerd via `normalizeSingleObjectToPieces()` (clipper-lib) en toegevoegd aan `objects[]`.

### Cut tool

- Tekent een polygon bovenop een bestaand object.
- Na afsluiten: `clipper-lib` berekent `ctDifference` van het bestaande object minus de gesneden vorm.
- Als het object in meerdere stukken valt, worden meerdere nieuwe `PolyObject`s aangemaakt.
- Holes worden gesaneerd via `sanitizeHoles()` (minimale oppervlakte filter).

### activeDrawType

`projectStore.activeDrawType: ObjectType | null` — welk object-type de gebruiker aan het tekenen is. Wordt gezet als de gebruiker een type kiest in het objectmenu.

---

## 21. Editor — Zustand stores

### projectStore (`src/state/projectStore.ts`)

De hoofdstore (~2000+ regels). Bevat:

```typescript
{
  // Canvas objects
  objects: PolyObject[];
  selectedObjectId: string | null;
  hoveredObjectId: string | null;

  // Viewport
  stagePos: { x: number; y: number };
  stageScale: number;

  // Tool state
  activeTool: EditorTool;
  activeDrawType: ObjectType | null;
  currentDrawPoints: number[];          // punten tijdens tekenen
  isDrawing: boolean;

  // Visibility
  viewVisibility: ViewVisibilityState;

  // Undo/redo
  undoStack: Command[];
  redoStack: Command[];

  // Drawing identity
  activeDrawingId: string | null;
  drawingName: string;
  plantbedNumberLayouts: Map<string, PlantbedLayout>;
}
```

**Actions (selectie):** `selectObject`, `deselectAll`, `setHoveredObject`
**Actions (tekenen):** `startDrawing`, `addDrawPoint`, `finalizeDrawing`, `cancelDrawing`
**Actions (bewerken):** `moveVertex`, `moveEdge`, `moveObject`, `resizeTreebed`, `rotateTreebed`
**Actions (structuur):** `addObject`, `removeObject`, `duplicateObject`, `reorderObject`
**Actions (bulge):** `setBulge`, `clearBulge`
**Actions (cut):** `cutObject`
**Actions (undo/redo):** `undo`, `redo`, `pushCommand`

---

### Geïsoleerde sub-stores (performance)

Deze stores bestaan uitsluitend om `HelloEditor` re-renders te voorkomen bij hoog-frequente updates (muisbeweging, RAF-frames).

#### `drawPreviewStore` (`src/features/editor/state/drawPreviewStore.ts`)

```typescript
{
  previewPoint: { x: number; y: number } | null;        // muiscursorpositie tijdens polygon-tekenen
  treebedPreviewPoint: { x: number; y: number } | null; // aparte preview voor boomvak
}
```

Updates via `setDrawPreviewPoint()` en `setTreebedDrawPreviewPoint()` — beide hebben een early-exit als de waarde niet is veranderd.
Alleen `EditorTopLayer` subscribet op deze store.

---

#### `selectionDragStore` (`src/features/editor/state/selectionDragStore.ts`)

```typescript
{
  alignmentGuides: AlignmentGuide[];  // uitlijnlijnen tijdens verslepen
}
```

Update via `setSelectionDragAlignmentGuides()`. Leeg array = stabiele referentie (vermijdt re-render).
Alleen `AlignmentGuidesSection` in `EditorTopLayer` subscribet.

---

#### `boxSelectStore` (`src/features/editor/state/boxSelectStore.ts`)

Houdt het kader bij tijdens rubber-band selectie (sleep op leeg canvas).

```typescript
{
  isActive: boolean;
  startX: number; startY: number;
  currentX: number; currentY: number;
}
```

---

#### `measureStore` (`src/features/editor/state/measureStore.ts`)

```typescript
{
  measurePreviewPoint: { x: number; y: number } | null;
}
```

Muiscursorpositie tijdens het meetgereedschap. Update via `setMeasurePreviewPoint()` (early-exit bij zelfde waarde).

---

#### `liveEditStore` (`src/features/editor/state/liveEditStore.ts`)

```typescript
{
  livePrimary: PolyObject | null;          // werkend object tijdens vertex/edge-drag
  liveLayouts: Map<string, any> | null;   // plantbed-layouts met live-object toegepast
}
```

Wordt elke RAF-frame bijgewerkt via `setLiveEditMeasurement()`. Alleen `LiveMeasurementSection` subscribet.

---

#### `bulgeDragStore` (`src/features/editor/state/bulgeDragStore.ts`)

```typescript
{
  isActive: boolean;
  screenX: number; screenY: number;        // positie van de apex-handle op scherm
  workingBulge: number;                    // huidige bulge-waarde
  snapName: string | null;                 // bijv. "kwartcirkel"
  chordX1: number; chordY1: number;        // eindpunten van de snaar (world coords)
  chordX2: number; chordY2: number;
  stageScale: number;
}
```

Alleen `BulgeDragSection` subscribet.

---

#### `rightStepMenuStore` (`src/features/editor/state/rightStepMenuStore.ts`)

Wizard-antwoorden stap 1–4 (zie ook sectie 8).

---

## 22. Editor — bulge / bogen systeem

### Concept

Een **bulge** is een signed getal dat beschrijft hoeveel een segment (lijnstuk van vertex i naar vertex i+1) gebogen is. Dit is het DXF/AutoCAD-formaat voor bogen.

```
bulge = tan(θ / 4)

waarbij θ = de centrale hoek van de boog (in radialen)
```

| Bulge-waarde | Betekenis |
|---|---|
| `0` | Rechte lijn |
| `0.414` | Kwartcirkel (90°) |
| `1.0` | Halve cirkel (180°) |
| `-x` | Boog in tegengestelde richting |

### Opslag

In `PolyObject.bulges: number[]` — één waarde per vertex (lengte = `points.length / 2`).
Altijd genormaliseerd via `normalizeBulges()`.

Alleen voor gesloten vlakken (polygon). Niet op fence/gate/treebed/boundary.

### Bewerking

In de editor verschijnt een **apex-handle** (ruit-icoon) op het midden van elk segment met `|bulge| > 0.01`. De gebruiker sleept dit handvat om de boog te vergroten/verkleinen.

Tijdens het slepen:
1. `bulgeDragStore` wordt elke RAF bijgewerkt (via `setBulgeDragLive()`).
2. Alleen `BulgeDragSection` re-rendert (toont apex-handvat + snaar-lijn).
3. Bij loslaten: `projectStore.setBulge(objectId, segmentIndex, newBulge)` wordt aangeroepen.

### Snap-punten

Tijdens bulge-drag snapt de waarde naar vaste hoeken:
- 0° (recht) → bulge = 0
- 45° kwartcirkel → bulge ≈ 0.199
- 90° kwartcirkel → bulge ≈ 0.414
- 180° halve cirkel → bulge = 1.0

### Rendering

De boog wordt client-side uitgerekend naar een reeks tussenliggende punten via een parametrische formule. `BaseFillLayer` en `BaseStrokeLayer` ontvangen de geïnterpoleerde puntarray.

### Remapping na normalisatie

Wanneer clipper-lib punten toevoegt of verwijdert (bij cut, union, normalisatie), worden de bulges opnieuw gemapped via `remapBulgesToRing()`. Dit probeert de segmenten te matchen op exacte eindpunten (tolerantie 1e-4). Niet-gematche segmenten krijgen bulge=0.

---

## 23. Editor — boundary systeem (schuttingen, hekken)

### Concept

Schuttingen (`fence`), hekken (`gate`, `poort`), opsluitbanden (`curb`), muurtjes (`wall`) etc. zijn **polyline**-objecten — ze hebben geen gevuld vlak maar worden als een **dikke band** gerenderd.

### boundarySegments

Een boundary-object kan meerdere losse lijnstukken bevatten in één `PolyObject`:

```typescript
boundarySegments?: number[][];  // array van punt-arrays, elk een apart lijnstuk
```

Zonder `boundarySegments` is `points` het enige lijnstuk.

### renderSide

```typescript
renderSide?: 1 | -1;
// 1  = linkse normaal van punt-volgorde
// -1 = rechtse normaal
```

Dit bepaalt aan welke kant de dikke band wordt getekend t.o.v. de centerline.

### renderPieces

```typescript
renderPieces?: number[][];  // gecachede polygonen voor de dikke banden
```

Dit is **afgeleide data** (cache). De source of truth is `points` + `boundarySegments`. `renderPieces` wordt herberekend na elke bewerking in `getBoundaryBandShape()` uit `boundarySystem.ts`. Het staat wél in `PolyObject` zodat het mee-serialiseert naar localStorage en niet elke render herberekend hoeft te worden.

### Legacy vs. unified boundary types

Oudere boundary-types (bijv. pre-2024 fence-objecten) worden herkend via `LEGACY_LINE_BOUNDARY_TYPES`. Nieuwere typen gebruiken het unified boundary systeem via `isUnifiedBoundaryType()`.

---

## 24. Editor — boomvak varianten

### TreebedVariant type

```typescript
type TreebedVariant = "standard" | "multi_stem" | "espalier" | "roof";
```

In het UI-label:
| Variant | Label |
|---|---|
| `standard` | Standaard |
| `multi_stem` | Meerstammig |
| `espalier` | Leivorm |
| `roof` | Dakvorm |

### Rendering per variant

Elk boomvak (`type: "treebed"`) heeft een aparte render-logica in `BaseFillLayer`:

**`standard`**
- Polygon-vlak (groen, fill `#008000`).
- Stam: kleine bruine cirkel in het centerpunt.
- Kruin: aparte groene cirkel gebaseerd op het ingeschreven-cirkelmiddelpunt.

**`multi_stem`**
- Zelfde als `standard` maar met meerdere stam-cirkels op berekende posities.

**`espalier` (leivorm)**
- Rendert het polygon als een smal silhouet.
- `rotationDeg` bepaalt de oriëntatie van het silhouet.
- Wordt in `EditorTopLayer` voorzien van een rotatie-handle.

**`roof` (dakvorm)**
- Rendert het polygon met een overhangende dakvorm-overlay.

### Treebed interact

In `select`-mode op een geselecteerd treebed:
- **Resize-handle**: sleep hoek/zijkant om het boomvak te vergroten/verkleinen (proportioneel).
- **Rotatie-handle** (leivorm): sleep om de oriëntatie te draaien.
- Tijdens drag: `liveEditStore` bijgewerkt elke RAF.
- Bij loslaten: `projectStore.resizeTreebed()` of `projectStore.rotateTreebed()`.

---

## 25. Editor — meting en coördinatensysteem

### Schaal

```
15 editor-units = 1 grid-stap = 0,1 meter (10 cm)
→ 1 editor-unit = 0,1 / 15 ≈ 0,00667 meter ≈ 6,67 mm
→ 150 editor-units = 1 meter
```

Definitie in `src/features/editor/constants/editorGeometry.ts`:
```typescript
export const EDITOR_GRID_SIZE = 15;   // editor-units per grid-stap
```

Definitie in `src/state/areaMetrics.ts`:
```typescript
const GRID_STEP_PER_METER = 10;       // grid-stappen per meter
const EDITOR_UNITS_PER_METER = EDITOR_GRID_SIZE * GRID_STEP_PER_METER; // = 150
```

### Oppervlakte berekening

Vlakobjecten met `isAreaMeasurable: true` tonen een oppervlakte-label in de canvas.

```typescript
// areaMetrics.ts
function getAreaM2(points: number[]): number {
  // Shoelace-formule → oppervlakte in editor-units²
  // Delen door (EDITOR_UNITS_PER_METER)² → m²
}
```

Gaten (`holes`) worden afgetrokken van de bruto-oppervlakte.

### Afstand berekening

```typescript
function getDistanceM(p1: Point, p2: Point): number {
  const editorUnits = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return editorUnits / EDITOR_UNITS_PER_METER;
}
```

### Meetgereedschap

`MeasureToolOverlay.tsx` — apart Konva overlay component.
- Eerste klik: startpunt vastzetten.
- Muisbeweging: `measureStore.measurePreviewPoint` bijwerken (geïsoleerde store).
- Tweede klik: eindpunt vastzetten, toont afstand als label op het canvas.
- `Escape` of tool wisselen: meting wissen.

---

## 26. Editor — uitlijning en snapping

### Grid snapping

Standaard snappen alle nieuw geplaatste en verplaatste vertices op het grid (15 editor-units raster). Snapping gebeurt in `EditorTopLayer` vóór de update naar `projectStore`.

```typescript
function snapToGrid(value: number): number {
  return Math.round(value / EDITOR_GRID_SIZE) * EDITOR_GRID_SIZE;
}
```

### Alignment guides (uitlijnlijnen)

Tijdens het **slepen van een geselecteerd object** worden automatisch uitlijnlijnen berekend en getekend t.o.v. andere objecten op het canvas.

Implementatie: `src/features/editor/lib/alignmentGuides.ts`

```typescript
type AlignmentGuide = {
  orientation: "horizontal" | "vertical";
  position: number;       // world-coördinaat
  start: number;          // begin van de lijn (andere as)
  end: number;            // einde van de lijn
};
```

**Berekening tijdens drag:**
1. Haal bounding boxes van alle andere objecten op.
2. Vergelijk de 4 zijden + centerlijn van het gesleepte object met alle andere objecten.
3. Als verschil ≤ snap-drempel (bijv. 5 editor-units): snap naar die positie + maak een `AlignmentGuide` aan.
4. Sla op in `selectionDragStore.alignmentGuides` (geïsoleerde store).

**Rendering:**
`AlignmentGuidesSection` in `EditorTopLayer` rendert de lijnen als oranje streepjeslijnen.
Re-rendert alleen bij wijziging van `alignmentGuides` (geïsoleerd van de rest van `EditorTopLayer`).

### Vertex snapping

Bij het verplaatsen van individuele vertices snapt het systeem ook op:
- Vertices van andere objecten (magnetisch, drempel ≈ 8 editor-units).
- Horizontale/verticale assen t.o.v. het vorige punt (45°-snapping bij `Shift`).

---

## 27. Editor — undo / redo

### Command pattern

Alle bewerkingen worden opgeslagen als `Command`-objecten in `projectStore`:

```typescript
type Command = {
  undo: () => void;
  redo: () => void;
};
```

`projectStore.undoStack: Command[]` en `projectStore.redoStack: Command[]`.

### Actions

```typescript
// Uitvoeren + op undo-stack zetten:
pushCommand(cmd: Command)

// Undo:
undo() → undoStack.pop().undo()  → push naar redoStack

// Redo:
redo() → redoStack.pop().redo()  → push naar undoStack
```

Na elke nieuwe actie die `pushCommand` aanroept, wordt `redoStack` geleegd.

### Wat is undoable?

- Object aanmaken (`draw` afsluiten)
- Object verwijderen (`Delete`-toets)
- Object verplaatsen (sleep)
- Vertex verplaatsen
- Edge verplaatsen
- Bulge wijzigen
- Object knippen (cut tool)
- Object dupliceren

### Grenzen

- Geen limiet op undo-diepte (in-memory, verdwijnt bij page refresh).
- Viewport-veranderingen (pan/zoom) zijn **niet** undoable.
- Naam en plantbed-koppelingen zijn **niet** undoable.

---

## 28. Editor — useDrawingLifecycle hook

Bestand: `src/features/editor/hooks/useDrawingLifecycle.ts`

### Verantwoordelijkheid

- Laadt de actieve tekening uit `localStorage` bij mount.
- Slaat wijzigingen op naar `localStorage` (gedebouncet).
- Beheert de lijst van tekeningen (aanmaken, wisselen, verwijderen).
- Beheert `panelMode` (welke wizard-stap in het rechter panel zichtbaar is) per tekening-ID.

### localStorage-sleutels

| Sleutel | Inhoud |
|---|---|
| `hello-editor:drawings:v1` | JSON-array van alle `Drawing`-objecten |
| `hello-editor:drawings:v1::active-drawing` | ID van de actieve tekening (string) |
| `hello-editor:drawings:v1::plant-selection` | `{ [drawingId]: PlantSelectionSnapshot }` |
| `hello-editor:drawings:v1::panel-mode` | `{ [drawingId]: PanelMode }` |

### panelMode fix

`panelMode` wordt **per tekening-ID** opgeslagen. Vroeger werd het globaal opgeslagen,
waardoor het wisselen van tekening de wizard-stap niet resette. De fix (zit in de hook):
lees `panelMode` op uit de tekenactivering, niet globaal.

### Serialisatie

`objects: PolyObject[]` wordt JSON-geserialiseerd. `Map<string, PlantbedLayout>` wordt
omgezet naar een array-van-paren voor JSON-compatibiliteit.

---

## 29. Editor — performance optimalisaties

### Probleem

De editor heeft twee typen hoog-frequente updates:
1. **Muisbewegingsgebeurtenissen** (60fps) — tekenen preview, bulge-drag apex, meetgereedschap.
2. **RAF-frames tijdens drag** — vertex drag, edge resize, treebed resize/rotate.

Als deze updates direct naar `projectStore` zouden gaan, zou de volledige `HelloEditor` component tree re-renderen bij elke frame.

### Oplossing: geïsoleerde sub-stores

Elke hoog-frequente update gaat naar een **geïsoleerde Zustand sub-store**. Alleen de kleine component die die specifieke data nodig heeft, re-rendert:

| Sub-store | Subscriber | Trigger |
|---|---|---|
| `drawPreviewStore` | `EditorTopLayer` (preview dot) | `onMouseMove` tijdens tekenen |
| `selectionDragStore` | `AlignmentGuidesSection` | RAF tijdens object-drag |
| `measureStore` | `MeasureToolOverlay` | `onMouseMove` met meetgereedschap |
| `liveEditStore` | `LiveMeasurementSection` | RAF tijdens vertex/edge-drag |
| `bulgeDragStore` | `BulgeDragSection` | RAF tijdens bulge-drag |
| `boxSelectStore` | `BoxSelectSection` | `onMouseMove` tijdens rubber-band |

### Early-exit guards

Alle store-update-functies hebben een early-exit als de waarde niet veranderd is:

```typescript
export function setDrawPreviewPoint(point: ...) {
  const current = useDrawPreviewStore.getState().previewPoint;
  if (point === null && current === null) return;           // geen update nodig
  if (point !== null && current !== null &&
      current.x === point.x && current.y === point.y) return; // zelfde coördinaat
  useDrawPreviewStore.setState({ previewPoint: point });
}
```

### React.memo

Alle Konva-layer-componenten zijn gewikkeld in `React.memo`:
- `BaseFillLayer` — re-rendert alleen als `objects[]` of `selectedObjectId` wijzigt.
- `BaseStrokeLayer` — zelfde.
- Subsecties in `EditorTopLayer` — elk wikkelt zijn dure delen in `React.memo`.

### RAF throttle

De treebed-resize/rotate drag en vertex-drag gebruiken `requestAnimationFrame` throttling:
reads worden maximaal één keer per frame gedaan, overstapte frames worden genegeerd.

---

## 30. Editor — toetsenbordsnelkoppelingen

| Shortcut | Actie |
|---|---|
| `V` | Select tool |
| `H` | Hand tool (pan) |
| `D` | Draw tool |
| `C` | Cut tool |
| `M` | Measure tool |
| `Delete` / `Backspace` | Geselecteerd object verwijderen |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+D` | Geselecteerd object dupliceren |
| `Escape` | Tekenen annuleren / deselecteren |
| `Shift` tijdens vertex-drag | 45°-snapping (horizontaal/verticaal) |
| `+` / `=` | Inzoomen |
| `-` | Uitzoomen |
| `0` | Viewport resetten (fit-to-screen) |
