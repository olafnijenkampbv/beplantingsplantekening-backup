# Beplantingsplantekening - projectdocumentatie

Technische projectdocumentatie voor de huidige versie van de applicatie.
Bijgewerkt op 19 juni 2026.

Deze applicatie is een teken- en adviesflow voor beplantingsplannen. De kern is
een canvas-editor waarin gebruikers tuinobjecten tekenen, bewerken, knippen,
kleuren, samenvoegen en koppelen aan plantadvies. Dezelfde geometrie moet
consistent terugkomen in de editor, de tekeningenpreview en de finalisatiepagina.

---

## Inhoud

1. Doel van de applicatie
2. Technische stack
3. Belangrijke routes
4. Projectstructuur
5. Data en persistentie
6. Database en feed sync
7. Workflow
8. Editor architectuur
9. Objectmodel
10. Geometrie: bulges, corners en holes
11. Clipping en samenvoegen
12. Boundary objecten
13. Selectie, handles en panels
14. Metingen, labels en alignment guides
15. Undo en redo
16. Preview en finalisatie rendering
17. Plantenlijst en staffels
18. Tuinmaterialen catalogus
19. AI-advies: Aanplantmateriaal (stap 7)
20. AI Plantvoorstel voor lege vakken (AutoFillModal)
21. Bekende aandachtspunten

---

## 1. Doel van de applicatie

De applicatie helpt een gebruiker om een beplantingsplan te maken:

1. Objecten tekenen in een tuinplattegrond.
2. Randvoorwaarden invullen via de rechter wizard.
3. Plantvakken/haagvakken koppelen aan plantadvies.
4. Planten en varianten kiezen in de plantenlijst.
5. Een finale technische tekening en plantenlijst opleveren.

De editor ondersteunt onder andere plantvakken, hagen, boomvakken, gras,
bestrating, grind, gebouwen, woningen, schuren, carports, schuttingen en hekken.

---

## 2. Technische stack

| Onderdeel | Technologie |
|---|---|
| Framework | Next.js 16 App Router |
| Taal | TypeScript |
| UI | React 19 |
| Canvas | Konva / react-konva |
| State | Zustand |
| Database | SQLite via better-sqlite3 |
| XML parsing | fast-xml-parser |
| Polygon boolean operations | clipper-lib |
| Styling | Tailwind CSS en component-local CSS/inline styles |

Belangrijke scripts:

```powershell
npm run dev
npm run build
npm run lint
```

---

## 3. Belangrijke routes

| Route | Doel |
|---|---|
| `/` | Hoofdeditor met canvas en wizard |
| `/plantenlijst` | Stap 5: planten en maten kiezen |
| `/beplantingsplan-afronden` | Finalisatiepagina met technische tekening |
| `/api/plants` | Gefilterde plantencatalogus |
| `/api/plants/[id]/variants` | Beschikbare maten/varianten van een plant |
| `/api/garden-materials` | Tuinmaterialen (ondersteunt `subcategory`-filter) |
| `/api/plant-advice/accessories` | AI-advies voor aanplantmaterialen (POST) |
| `/api/admin/sync` | Feed sync starten |
| `/api/admin/sync-status` | Laatste syncstatus |

---

## 4. Projectstructuur

```text
src/
  app/
    page.tsx
    plantenlijst/page.tsx
    beplantingsplan-afronden/page.tsx
    api/
      garden-materials/route.ts
      plant-advice/
        accessories/route.ts   ← AI-advies voor aanplantmaterialen
      admin/
        sync/route.ts
        sync-status/route.ts
  features/editor/
    HelloEditor.tsx
    editorDrawingsPersistence.ts
    components/
      editor/
      finalisatie/
        FinalisatiePlantList.tsx        ← exporteert buildPlantAdviceInfoForList
        FinalisatieAccessoryAdvice.tsx  ← "Aanplantmateriaal" AI-blok
      plantSelection/
        GardenMaterialGrid.tsx         ← GardenMaterialGridCard hergebruikt in slider
      rightStepMenu/
    config/
      editorWorkflowConfig.ts
    hooks/
      useDrawingLifecycle.ts
    lib/
      alignmentGuides.ts
      arcBooleanGeometry.ts
      boundarySystem.ts
      bulgeMath.ts
      editorCanvasPrimitives.tsx
      editorSelectionMath.ts
      objectPatterns.tsx
      plantScoring.ts
      svgObjectPath.ts
      treebedGeometry.tsx
    state/
      boxSelectStore.ts
      bulgeDragStore.ts
      cornerDragStore.ts
      drawPreviewStore.ts
      liveEditStore.ts
      measureStore.ts
      plantCatalogStore.ts
      plantSelectionStore.ts
      plantVariantStore.ts
      rightStepMenuStore.ts
      selectionDragStore.ts
  lib/
    accessoryCatalogMeta.ts   ← handmatige beschrijvingen van alle 83 tuinmaterialen
    db/
      feedParser.ts
      feedSync.ts
      gardenMaterialTypes.ts
      plantDatabase.ts
      plantQueries.ts
      plantTypes.ts
  state/
    areaMetrics.ts
    projectStore.ts
```

Belangrijkste bestanden:

| Bestand | Verantwoordelijkheid |
|---|---|
| `src/state/projectStore.ts` | Hoofdstate voor objecten, clipping, merge, undo/redo en mutaties |
| `src/features/editor/HelloEditor.tsx` | Editor shell, canvas events, panels, drag state |
| `src/features/editor/components/editor/EditorTopLayer.tsx` | Selectie, handles, labels, interactielaag |
| `src/features/editor/components/editor/BaseFillLayer.tsx` | Vulling van objecten |
| `src/features/editor/components/editor/BaseStrokeLayer.tsx` | Contouren en boundary rendering |
| `src/features/editor/lib/bulgeMath.ts` | Boog/corner wiskunde |
| `src/features/editor/lib/arcBooleanGeometry.ts` | Arc-aware boolean helperlogica |
| `src/features/editor/lib/svgObjectPath.ts` | SVG path generatie voor previews/finalisatie |
| `src/features/editor/lib/alignmentGuides.ts` | Alignment guides tijdens draggen |
| `src/features/editor/lib/boundarySystem.ts` | Schutting/hek/boundary band geometrie |
| `src/lib/accessoryCatalogMeta.ts` | Handmatige beschrijvingen per materiaal-ID voor AI-prompt |
| `src/app/api/plant-advice/accessories/route.ts` | OpenAI-integratie voor aanplantmateriaaladvies |
| `src/features/editor/components/finalisatie/FinalisatieAccessoryAdvice.tsx` | UI voor AI-adviesblok stap 7 |

---

## 5. Data en persistentie

Tekeningdata wordt client-side opgeslagen in `localStorage`.

| Key | Inhoud |
|---|---|
| `hello-editor:drawings:v1` | Alle opgeslagen tekeningen |
| `hello-editor:drawings:v1::active-drawing` | Actieve tekening-ID |
| `hello-editor:drawings:v1::plant-selection` | Plantselectie snapshots per tekening |
| `hello-editor:drawings:v1::panel-mode` | Open wizard/panel state per tekening |
| `finalisatie:accessory-advice:v5` | Gecachte AI-materiaalsuggesties (cache-key = hash van plantenlijst + vakken) |

`editorDrawingsPersistence.ts` bevat cloning en serialisatie voor tekeningen.
Belangrijk: `bulges`, `corners`, `holes` en `boundarySegments` worden diep gekloond,
zodat undo/redo en opslag geen gedeelde referenties houden.

---

## 6. Database en feed sync

De planten- en materialenfeed komt uit de Google Shopping/XML feed van
`olaf-nijenkamp.nl` en wordt lokaal opgeslagen in SQLite.

Belangrijke tabellen:

| Tabel | Doel |
|---|---|
| `plants` | Unieke planten/cultivars |
| `plant_variants` | Verkoopbare maten/varianten per plant |
| `garden_materials` | Tuinmaterialen (incl. `subcategory`-kolom) |
| `garden_material_variants` | Varianten van tuinmaterialen |
| `sync_log` | Resultaat en duur van imports |

De `garden_materials`-tabel heeft een `subcategory TEXT NOT NULL DEFAULT 'Overig'` kolom.
Mogelijke waarden: `Potgrond`, `Daktuinen`, `Gazon`, `Meststoffen`, `Overig`.
De kolom wordt toegevoegd via een migratiecheck bij opstart in `plantDatabase.ts`.

### Feed-detectie tuinmaterialen

`feedParser.ts` detecteert tuinmaterialen via drie signalen (in volgorde van betrouwbaarheid):

1. `plant_groepen` bevat "Tuinmaterialen"
2. `dealer_groepen` bevat een bekende merknaam (culvita, innogreen, potgronden, dungking, straightcurve, daktuinen, meststoffen, graszoden)
3. Titelwoorden: daktuin, sedum, potgrond, tuinaarde, substraat, gazon, graszaad, mest, strooiwagen

De subcategorie wordt bepaald via `dealer_groepen` (betrouwbaarst) met titelwoorden als fallback.

### BTW-berekening

Prijzen in de feed zijn inclusief BTW. De app toont prijzen exclusief BTW.

- Standaard divisor: `1.09` (9% BTW, voor planten en vrijwel alle materialen)
- Per-trefnaam uitzondering: `VIVIUNIV` (DCM Vivimus Universeel) gebruikt `1.21` (21% BTW)
  omdat dit product in de feed per ongeluk met 21%-inkoopprijs staat (geverifieerd: €12,44 ÷ 1,21 = €10,28)

De `PRICE_DIVISOR_OVERRIDE`-map in `feedParser.ts` regelt deze uitzonderingen.

### Plants API filters

De `/api/plants`-route ondersteunt filters op:

- zoekterm
- app group
- standplaats
- grondsoort
- bloeiperiode
- kleur
- categorie
- inheems
- voorraad
- hoogte
- keurmerk
- sortering en paginering

De `/api/garden-materials`-route ondersteunt een `subcategory`-queryparameter voor het filteren per subcategorie.

---

## 7. Workflow

| Stap | Route | Doel |
|---|---|---|
| 1 | `/` | Locatie bepalen |
| 2 | `/` | Situatie en randvoorwaarden |
| 3 | `/` | Structuur en opbouw |
| 4 | `/` | Beleving en ruimte |
| 5 | `/plantenlijst` | Plantenvoorstel en maten kiezen |
| 6 | `/` | Planten koppelen in de tekening |
| 7 | `/beplantingsplan-afronden` | Finaliseren en controleren |

De wizardwaarden uit stap 2-4 worden vertaald naar plantfilters en scoring.
De plantenlijst gebruikt deze filters voor adviesgroepen, maar de zoek-zelf-flow
kan los van de wizard zoeken.

---

## 8. Editor architectuur

De editor bestaat uit drie hoofdlagen:

1. `BaseFillLayer`: tekent objectvullingen, patronen en gaten.
2. `BaseStrokeLayer`: tekent contouren, dashed lijnen en boundary stukken.
3. `EditorTopLayer`: tekent interactieve UI zoals handles, labels, meetlijnen en menus.

Hoogfrequente interacties gebruiken kleine Zustand substores, zodat niet de hele
editor opnieuw rendert bij elke muisbeweging.

| Store | Doel |
|---|---|
| `drawPreviewStore` | Preview tijdens tekenen |
| `selectionDragStore` | Drag preview en alignment guides |
| `measureStore` | Meettool preview |
| `liveEditStore` | Live labels/meting tijdens vertex/edge/bulge/corner edits |
| `bulgeDragStore` | Bulge tooltip en drag state |
| `cornerDragStore` | Corner radius tooltip en drag state |
| `boxSelectStore` | Selectierechthoek |

---

## 9. Objectmodel

De meeste editorobjecten zijn `PolyObject`-achtige objecten.

Belangrijke velden:

```ts
type PolyObject = {
  id: string;
  type: string;
  points: number[];
  holes?: number[][];
  bulges?: number[];
  corners?: number[];
  boundarySegments?: number[][];
  renderSide?: 1 | -1;
  renderPieces?: number[][];
  customStyle?: {
    fill?: string;
    stroke?: string;
  };
  plantbedNo?: number;
};
```

### Points

`points` is een platte array:

```ts
[x1, y1, x2, y2, x3, y3, ...]
```

### Holes

`holes` bevat uitgesneden binnenringen. Deze worden gebruikt voor gaten in
objecten, bijvoorbeeld wanneer een hoger object een lager object wegknipt.

### Bulges

`bulges` bevat per segment een boogwaarde. Segment `i` loopt van vertex `i` naar
vertex `i + 1`. Een positieve of negatieve waarde bepaalt de boogrichting.

### Corners

`corners` bevat per vertex een radius voor hoekafronding.

---

## 10. Geometrie: bulges, corners en holes

De editor ondersteunt drie belangrijke niet-rechthoekige vormen:

| Feature | Betekenis |
|---|---|
| Bulge | Een segment wordt een cirkelboog |
| Corner | Een vertex krijgt een afgeronde hoek |
| Hole | Een uitgesneden binnenvorm in een object |

Bulges en corners worden niet alleen visueel getekend. Ze worden ook meegenomen in:

- clipping
- same-type merge
- object bounds
- labels en m2-positionering
- oranje maatlijnen
- alignment guides
- previews in `DrawingsDashboardModal`
- finale technische tekening in `FinalisatieDrawingBlock`
- undo/redo
- localStorage persistentie

`bulgeMath.ts` bevat de wiskundige basis voor het tracen van bogen en afgeronde
hoeken. `arcBooleanGeometry.ts` bevat helperlogica om boogsegmenten te densifyen
voor boolean operations en daarna waar mogelijk terug te reduceren naar compacte
bulge-segmenten.

---

## 11. Clipping en samenvoegen

### Clipping tussen objecten

Wanneer een object boven een ander object ligt, kan het onderste object worden
uitgesneden. De clipper houdt rekening met:

- rechte segmenten
- bulges
- meerdere bulges
- afgeronde hoeken
- holes
- plantvakken op plantvakken
- haagvakken op haagvakken
- gewone objecten zoals gras, woning, schuur, bestrating

Het object dat wordt weggesneden krijgt een aangepaste vorm die aansluit op de
vorm van het object dat knipt. Daarbij probeert de editor zo weinig mogelijk
handles te behouden door boogdelen terug te mappen naar `bulges` waar dat kan.

### Same-type merge

Objecten van hetzelfde type kunnen samenvoegen. Bij merge moet geometrie behouden
blijven:

- bestaande bulges blijven bulges
- afgeronde hoeken blijven afgeronde hoeken of worden zo compact mogelijk
  gereconstrueerd
- cell-based merge wordt overgeslagen wanneer objecten bogen/corners bevatten
- arc-aware union probeert boogreeksen te herkennen en terug te zetten naar
  compacte segmenten

Belangrijke functies in `projectStore.ts`:

- `moveObjectAndMerge`
- `unionSameTypePolygons`
- `normalizeMergePieces`
- `getMergedPieceBulges`
- `shouldUseCellMerge`

### Pure translation

Bij het simpel verplaatsen van een object zonder echte merge/clip wordt alleen
een pure delta toegepast. Daardoor verandert een object met bulges of corners
niet van vorm tijdens draggen.

---

## 12. Boundary objecten

Schuttingen, hekken en vergelijkbare afbakeningen worden opgeslagen als
boundary/polyline objecten. Ze gebruiken:

- `points`
- `boundarySegments`
- `renderSide`
- `renderPieces`

`renderPieces` is afgeleide data en wordt opnieuw berekend uit de bronpunten.
Bij verplaatsen, multiselect en undo/redo blijven `boundarySegments` behouden.

Wanneer een schutting of hek rondom gekleurde plantvakken wordt gezet, mogen de
custom kleuren van de plantvakken niet verdwijnen. `customStyle` wordt daarom
behouden bij clipping- en updateflows.

---

## 13. Selectie, handles en panels

### Handles

Objecten tonen handles voor:

- vertices
- edges
- bulges
- corners
- treebed resize/rotate

Boomvak-handles gebruiken dezelfde inverse-scale aanpak als de andere handles,
zodat ze correct meeschalen bij zoom.

Bij multiselect worden individuele objecthandles niet getoond. Dit voorkomt
visuele ruis en foutieve interacties tijdens groepsverplaatsingen.

### Panels

Objectmenu's kunnen panels openen, zoals:

- `ObjectColorPanel`
- object wijzigen panel

Wanneer zo'n panel open staat, worden de volgende UI-blokken verborgen:

- `RightStepMenu`
- `PlantSidebar`
- `EstimatedPlantingPriceBadge`

Bij sluiten worden ze weer zichtbaar.

---

## 14. Metingen, labels en alignment guides

Maatlijnen, labels en hulplijnen gebruiken niet alleen de ruwe vertex-box. Ze
moeten de werkelijke contour gebruiken, inclusief:

- bulges
- meerdere bulges
- afgeronde hoeken
- holes waar relevant

Daarom worden objectbounds bepaald op basis van de getraceerde contour. Dit geldt
voor:

- vaknummer en m2-label in de editor
- oranje horizontale en verticale maatlabels
- alignment guides tijdens draggen
- selected object measurement overlays

De labelpositie gebruikt een binnenpunt dat binnen de uiteindelijke vorm ligt,
zodat tekst niet half buiten of achter een clipping/hole terechtkomt.

---

## 15. Undo en redo

Undo/redo werkt via command snapshots in `projectStore.ts`.

Undoable acties:

- object aanmaken
- object verwijderen
- object verplaatsen
- multiselect verplaatsen
- vertex verplaatsen
- edge resize
- bulge aanpassen
- corner radius aanpassen
- object knippen
- clipping/merge resultaten
- dupliceren
- kleurwijzigingen waar via history toegepast

Belangrijk: snapshots moeten deep clones bevatten van:

- `points`
- `holes`
- `bulges`
- `corners`
- `boundarySegments`
- `customStyle`

Als een van deze velden ondiep gekloond wordt, kunnen oude borders, bogen of
afgeronde hoeken blijven hangen na undo/redo.

---

## 16. Preview en finalisatie rendering

De editor gebruikt dezelfde geometrische vorm ook buiten het canvas.

### DrawingsDashboardModal

De preview in `DrawingsDashboardModal` toont:

- objectvullingen
- contouren
- holes
- bulges
- afgeronde hoeken
- custom kleuren

### FinalisatieDrawingBlock

De finale technische tekening toont dezelfde geometrie als de editor:

- holes worden uitgesneden
- bulges worden als bogen weergegeven
- afgeronde hoeken blijven afgerond
- labels staan binnen het object
- plantvaklabels gebruiken de contrastkleur die past bij de ingestelde vulling

De gedeelde helper hiervoor is:

```text
src/features/editor/lib/svgObjectPath.ts
```

Deze helper bouwt SVG path-data uit objecten met points, holes, bulges en corners.
Gebruik deze helper wanneer een nieuwe preview/export dezelfde geometrie moet
tonen als de editor.

---

## 17. Plantenlijst en staffels

De plantenlijst gebruikt de plantcatalogus en de wizardfilters om planten voor te
stellen. In de modal voor beschikbare maten kunnen varianten staffelprijzen
hebben.

Interacties:

- klikken op een maat selecteert de variant
- klikken op de titel van een variant met staffels klapt staffelprijzen open
- "Meer maten bekijken" klapt extra maten open met dezelfde animatie als de
  staffeltabel

Relevante component:

```text
src/features/editor/components/plantSelection/ProductVariantSelectionModal.tsx
```

---

## 18. Tuinmaterialen catalogus

De tuinmaterialen-catalogus bestaat uit ~83 producten die uit de feed worden geïmporteerd
via `feedSync.ts`. De subcategorie-indeling wordt gebruikt voor de filterbalk op de
Tuinmaterialen-pagina (stap 5) en voor de AI-adviesroute.

### SubcategoryTabBar (stap 5 plantenlijst)

Op de Tuinmaterialen-tab in `GardenMaterialGrid.tsx` staat een `SubcategoryTabBar` met
de filteropties: Alle / Potgrond / Daktuinen / Gazon / Meststoffen / Overig.
De volgorde is vastgelegd in `SUBCATEGORY_ORDER`.

### accessoryCatalogMeta.ts

`src/lib/accessoryCatalogMeta.ts` bevat handmatige beschrijvingen voor alle 83 materiaal-IDs.
De functie `getAccessoryCatalogMeta(id)` geeft `{ category, description }` terug.
Deze beschrijvingen worden meegegeven in de AI-prompt zodat het model goed kan beoordelen
welk product bij welke plant past. Producten zonder beschrijving worden door de AI overgeslagen.

### GardenMaterialGridCard

`GardenMaterialGridCard` (geëxporteerd uit `GardenMaterialGrid.tsx`) wordt hergebruikt in
zowel de tuinmaterialen-grid (stap 5) als de AI-adviesslider (stap 7).

Props:
- `material: ApiGardenMaterial`
- `reason?: string` — optionele AI-adviesreden, getoond tussen maatlink en prijs
- `onAddToPlantList?: (material, variant) => void`

Kaartopbouw voor gelijke hoogte: outer div met `flex h-full flex-col`, afbeelding met `shrink-0`,
tekst-blok met `flex flex-1 flex-col`, prijsrij met `mt-auto`.

---

## 19. AI-advies: Aanplantmateriaal (stap 7)

Op de finalisatiepagina (`/beplantingsplan-afronden`) staat het **"Aanplantmateriaal"**-blok.
Dit blok haalt AI-suggesties op voor tuinmaterialen die passen bij de definitieve plantenlijst.

### Route: `POST /api/plant-advice/accessories`

Bestand: `src/app/api/plant-advice/accessories/route.ts`

**Request body:**
```ts
{ items: AccessoryAdviceInputItem[] }
```

`AccessoryAdviceInputItem` bevat per plant:
- `botanicalName`, `dutchName`, `category`, `appGroup`, `size`, `quantity`
- plantspecificaties: `volwassenHoogte`, `kleuren`, `kleurBlad`, `bloeiperiode`, `inheems`, `stikstofbehoefte`, `standplaatsen`, `grondsoorten`, `toelichting`
- `vakken: AccessoryAdviceVakInfo[]` — per gekoppeld vak: vakType (plantbed/hedge/treebed), areaM2, adviceCount
- `treebedCount` — aantal gekoppelde boomvakken (bepaalt hoeveelheid boompalen/boomband, nooit het stuksaantal planten)

**Verwerking:**

1. Daktuinen-producten worden uitgefilterd vóór de prompt (niet relevant als aanplantmateriaal, scheelt ook promptgrootte).
2. OpenAI `gpt-4o-mini` genereert suggesties via structured output (`json_schema`, `strict: true`).
3. `uniqueSuggestionsByMaterial()` dedupliceert: als de AI hetzelfde `materialId` meerdere keren teruggeeft (voor verschillende planten), worden de redenen samengevoegd en het hoogste aanbevolen aantal gehanteerd.
4. `applyStandardAccessoryRules()` voegt vaste regels toe boven op de AI-output:
   - **BOOMPALE / BOOOMBAN** — bij bomen (meerstammig, dakbomen, leibomen, vormbomen, bomen): hoeveelheid = totaal aantal boomvakken (`treebedCount`-som)
   - **VIVIZUUR** — bij heesters, vaste planten, rhododendrons, rozen, bomen: hoeveelheid = 1
   - **TUTURF40** — bij heesters, vaste planten, rozen e.d.: hoeveelheid = 1
   Standaardsuggesties worden altijd bovenaan de lijst geplaatst.

**OpenAI-instellingen:**
- Model: `gpt-4o-mini`
- `temperature: 0`, `max_tokens: 2048`
- `timeout: 25_000`, `maxRetries: 1` (voorkomt 10-minuten hangup bij trage API)

**Typisch gedrag:** ~5-10 seconden responstijd, 5-10 suggesties voor een gemiddelde plantenlijst.

### UI-component: `FinalisatieAccessoryAdvice.tsx`

- Haalt automatisch advies op bij het openen van stap 7.
- Resultaat wordt gecacht in `localStorage` onder `finalisatie:accessory-advice:v5`.
  Cache-key = hash van plantenlijst-items + vakken (zodat bij wijziging nieuwe fetch plaatsvindt).
- **Weergave:**
  - ≤ 3 suggesties → normaal grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)
  - > 3 suggesties → horizontale slider met pijlknoppen (links/rechts chevron)
- Slider: `overflow-x-auto` met `.app-hidden-scrollbar` (scrollbar volledig verborgen, alleen pijlknoppen zichtbaar). Kaartbreedte = 300px, scroll = 300px per klik.
- Bij toevoegen van een suggestie aan de plantenlijst wordt een `PlantListItem` aangemaakt met:
  - `addedFrom: "accessory-advice"`
  - `adviceQuantity` en `adviceReason`
- Toegevoegde materialen zijn zichtbaar in de plantenlijst (stap 5 en stap 7) en kunnen worden verwijderd via een confirmmodal.

### PlantListItem-uitbreidingen

```ts
type PlantListItem = {
    // ... bestaande velden
    addedFrom?: "accessory-advice";
    adviceQuantity?: number;
    adviceReason?: string;
};
```

In `FinalisatiePlantList.tsx` worden items met `addedFrom === "accessory-advice"` anders weergegeven:
- Adviesaantal getoond als `{adviceCount} stuk/stuks`
- Aparte popup (`AccessoryAdvicePopup`) met de adviesreden
- Verwijderknop die een confirmmodal toont (dezelfde modal als stap 5)

### CSS-utilities (globals.css)

```css
.app-thin-scrollbar   /* dunne scrollbar, 6px, grijs */
.app-hidden-scrollbar /* scrollbar volledig verborgen (gebruikt in slider) */
```

### buildPlantAdviceInfoForList

Geëxporteerde helperfunctie uit `FinalisatiePlantList.tsx`.
Berekent per plantenlijst-item de gekoppelde vakken (vakType, areaM2, adviceCount).
Wordt hergebruikt door `FinalisatieAccessoryAdvice.tsx` om de `AccessoryAdviceVakInfo[]`
en `treebedCount` te berekenen voor de API-payload.

---

## 20. AI Plantvoorstel voor lege vakken (AutoFillModal)

Wanneer een gebruiker na het koppelen van planten nog lege vakken overhoudt en op
**"Zoek planten voor lege vakken"** klikt, opent `AutoFillModal.tsx`. Het laadscherm
(view 2) stuurt een echte SSE-streaming aanvraag naar de server, die vervolgens
OpenAI gpt-4o aanroept om botanisch verantwoorde plantcombinaties voor te stellen.

Zie **[AI_PROPOSAL_DOCUMENTATION.md](AI_PROPOSAL_DOCUMENTATION.md)** voor de volledige
technische documentatie (dataflow, SSE-events, promptstructuur, bed-type mapping,
fallback-logica en testhandleiding).

### Route: `POST /api/plants/ai-proposal`

Bestand: `src/app/api/plants/ai-proposal/route.ts`

Verwerkt in vier stappen via SSE:

| Stap | SSE `step` | Progress |
|---|---|---|
| 1 | `querying_db` → `scoring_candidates` | 10 → 25% |
| 2 | `building_prompt` | 40% |
| 3 | `asking_openai` → `generating` | 50 → 85% |
| 4 | `parsing_result` → resultaat | 90 → 98% |

### Vaktype-naar-appgroup mapping

| Vaktype | PlantAppGroups in kandidatenpool |
|---|---|
| `plantbed` | `vaste-planten`, `heesters-struiken`, `bodembedekkers` |
| `hedge` | `hagen` |
| `treebed` | `bomen` |

`overig` is bewust uitgesloten (bevat groenten, materialen, bolmengsels).
`bodembedekkers` staat in de mapping maar heeft nog geen DB-inhoud — wordt later gevuld.

### Fallback

Als OpenAI niet beschikbaar is of ongeldige JSON teruggeeft, valt de route terug
op een score-sort van de kandidatenpool (geen AI). De client ontvangt dan hetzelfde
`result`-event, met `fallback: true`.

---

## 21. Bekende aandachtspunten

- De editorgeometrie is bewust centraal gehouden in `projectStore.ts` en
  `features/editor/lib/*`. Nieuwe features die objectvormen veranderen moeten
  `points`, `holes`, `bulges`, `corners` en `boundarySegments` samen behandelen.
- Boolean operations met bogen werken via densifyen en daarna compact maken. Voeg
  geen nieuwe flow toe die alleen rechte segmenten gebruikt als die flow ook met
  bulges/corners kan werken.
- Preview/export/finalisatie moeten `svgObjectPath.ts` blijven gebruiken om
  afwijkingen tussen editor en output te voorkomen.
- Bij nieuwe mutaties altijd controleren of undo/redo een volledige deep clone
  maakt.
- Bij nieuwe panel overlays controleren of `RightStepMenu`, `PlantSidebar` en
  `EstimatedPlantingPriceBadge` correct verborgen worden wanneer het panel focus
  moet krijgen.
- De feed kan voor hetzelfde product meerdere items hebben met dezelfde `trefnaam`
  en `maatomschrijving` (duplicate SKU-varianten). Dit resulteert in dubbele
  size_label-rijen in `garden_material_variants`. Nog niet gefixed.
- Bij het uitbreiden van `garden_materials` met nieuwe kolommen altijd een
  migratiecheck toevoegen in `plantDatabase.ts` (patroon: `ALTER TABLE ... ADD COLUMN`
  alleen als de kolom nog niet bestaat).
- De AI-adviesroute stuurt alle tuinmaterialen (minus Daktuinen) mee in de prompt.
  Bij groei van de catalogus de promptgrootte in de gaten houden; overweeg om
  ook andere grote subcategorieën uit te filteren als de responstijd oploopt.
- `accessoryCatalogMeta.ts` moet handmatig bijgehouden worden bij nieuwe producten
  in de feed — de AI gebruikt de beschrijvingen als enige kennisbron.

