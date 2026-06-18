/**
 * accessoryCatalogMeta.ts
 *
 * De Google Shopping-feed levert voor tuinmaterialen alleen naam, afbeelding,
 * prijs en voorraadstatus — geen beschrijving of categorie (zie feedParser.ts).
 * Zonder die context moet de AI in /api/plant-advice/accessories puur op de
 * productnaam gokken welke materialen relevant zijn. Dit bestand vult die
 * ontbrekende context handmatig aan, los van de automatische feed-sync.
 *
 * Elke beschrijving benoemt waar mogelijk: wat het product is, waar het voor
 * gebruikt wordt, en — vooral bij potgrond/bemesting — bij welke grondsoort,
 * standplaats of plantkenmerken het past, zodat de AI dit kan matchen tegen
 * de plantspecificaties uit de plantenlijst (grondsoort, standplaats, etc.).
 *
 * Voeg hier een entry toe zodra er een nieuw tuinmateriaal (bv. een
 * potgrondsoort) in de feed/catalogus verschijnt. Gebruik `getAccessoryCatalogMeta`
 * om veilig een entry op te vragen (valt terug op een neutrale placeholder).
 */

export type AccessoryCatalogMeta = {
    category: string;
    description: string;
};

export const ACCESSORY_CATALOG_META: Record<string, AccessoryCatalogMeta> = {
    // -----------------------------------------------------------------------
    // Potgrond
    // -----------------------------------------------------------------------
    BITUIN40: {
        category: "Potgrond",
        description:
            "Biologische Tuinaarde 30 liter: biologisch gecertificeerde tuinaarde (zonder chemische bestrijdingsmiddelen of kunstmest) om de volle grond te verbeteren bij aanplant. Geschikt als algemene bodemverbeteraar voor de meeste grondsoorten; vooral relevant wanneer de klant bewust biologisch/duurzaam wil tuinieren.",
    },
    BEMESTE: {
        category: "Potgrond",
        description:
            "Culvita bemeste tuinaarde: tuinaarde met meststoffen voorgemengd, direct klaar voor gebruik zonder los te bemesten. Geschikt als basisgrond voor aanplant in de volle grond bij planten met een gemiddelde voedingsbehoefte (stikstofbehoefte rond 10-20g); niet de eerste keuze bij planten die juist arme, voedselarme grond willen (bv. mediterrane planten, sommige sedumsoorten).",
    },
    CUPOT: {
        category: "Potgrond",
        description:
            "Culvita potgrond: algemene potgrond voor het planten in potten en kuipen. Geschikt voor de meeste kuipplanten en vaste planten zonder specifieke grondwens; geen specialistische potgrond voor mediterrane planten of vetplanten (gebruik daarvoor Vulkanisch Substraat of Mediterrane Potgrond).",
    },
    CUTUI: {
        category: "Potgrond",
        description:
            "Culvita tuinaarde: standaard tuinaarde zonder extra bemesting, om de bestaande tuingrond aan te vullen of te verbeteren bij aanplant in de volle grond. Geschikt als basis voor de meeste grondsoorten; combineer met een losse meststof (bv. DCM Mix 6) als de plant een specifieke stikstofbehoefte heeft.",
    },
    INGVPOTG: {
        category: "Potgrond",
        description:
            "Innogreen Green-Start (veenvrije potgrond): duurzame, veenvrije potgrond als milieuvriendelijk alternatief voor traditionele (veenrijke) potgrond. Geschikt als startgrond bij het aanplanten van vaste planten en heesters op neutrale tot humusrijke grond; minder geschikt voor planten die juist zure, veenachtige grond nodig hebben (bv. Rhododendron, Erica/Heide — gebruik daarvoor een potgrond met lage pH).",
    },
    INHSPECI: {
        category: "Potgrond",
        description:
            "Innogreen Hovenierspotgrond speciaal: professionele potgrond met een luchtige structuur en goede waterhuishouding, ontwikkeld voor het planten van heesters en bomen door vakmensen. Brede, algemene toepasbaarheid; geen vervanging voor specialistische grond bij mediterrane planten of vetplanten.",
    },
    MEPOT40: {
        category: "Potgrond",
        description:
            "Mediterrane Potgrond 40 liter: goed doorlatende potgrond met extra zand/grit, speciaal voor mediterrane planten (lavendel, rozemarijn, olijfboom, andere droogteminnende soorten) die droge, kalkrijke, voedselarme grond nodig hebben en gevoelig zijn voor te veel vocht ('natte voeten'). Niet gebruiken bij planten die juist humusrijke of vochthoudende grond willen.",
    },
    ZAAILANT: {
        category: "Potgrond",
        description:
            "Mediterrane Potgrond 40 liter: zelfde product als de andere 'Mediterrane Potgrond'-variant in de catalogus — goed doorlatende, voedselarme potgrond voor mediterrane, droogteminnende planten (lavendel, rozemarijn, olijfboom). Niet gebruiken bij planten die humusrijke of vochthoudende grond nodig hebben.",
    },
    POU70L: {
        category: "Potgrond",
        description:
            "Potgrond Universeel 70 liter: algemene, neutrale potgrond zonder specifieke bodemeisen. De standaardkeuze wanneer een plant geen bijzondere grondsoort vereist (bv. grondsoort 'neutrale grond', 'zandgrond' of 'lichte klei' in de plantspecificaties), en er geen reden is om voor een gespecialiseerde potgrond (mediterraan, veenvrij, zuur) te kiezen.",
    },
    POIBIGBA: {
        category: "Potgrond",
        description:
            "Potgrond in bigbag, 2m³: zelfde universele, neutrale potgrond als 'Potgrond Universeel', maar in grootverpakking. Geschikt bij grotere aanplant-projecten met veel planten of grote plantvakken, in plaats van meerdere kleine zakken.",
    },
    TUINA30: {
        category: "Potgrond",
        description:
            "Tuinaarde 30 liter: standaard tuinaarde om de volle grond aan te vullen of te verbeteren bij aanplant. Algemeen toepasbaar; combineer met een losse meststof als de plant een specifieke stikstofbehoefte heeft.",
    },
    TUINABIG: {
        category: "Potgrond",
        description:
            "Tuinaarde in bigbag, 2 m³: zelfde standaard tuinaarde als 'Tuinaarde 30 liter', maar in grootverpakking voor grotere aanplant-projecten.",
    },
    VEPOTGRO: {
        category: "Potgrond",
        description:
            "Veenvrije Potgrond 40 liter: duurzaam, veenvrij alternatief voor traditionele potgrond. Geschikt voor planten met een neutrale tot humusrijke grondbehoefte; minder geschikt voor planten die juist zure veengrond nodig hebben (bv. Rhododendron, Erica/Heide).",
    },
    VUSUB12K: {
        category: "Potgrond",
        description:
            "Vulkanisch Substraat 4-8 mm 12 kg: poreus, vulkanisch korrelsubstraat (bims/lava) dat de drainage verbetert. Te mengen door potgrond of zware kleigrond bij planten die juist uitstekende waterafvoer nodig hebben en geen 'natte voeten' verdragen — typisch mediterrane planten, vetplanten en sommige coniferen. Niet gebruiken bij planten die vochthoudende, humusrijke grond willen.",
    },
    DCMRMIX: {
        category: "Potgrond",
        description:
            "DCM Robot-Mix: samengestelde NPK-meststof (8-3-18 + calcium, magnesium, ijzer en bacillus-bacteriën) voor structurele bodemverbetering en voeding bij aanplant. Geschikt voor planten met een gemiddelde tot hogere stikstofbehoefte; niet gebruiken bij planten die juist arme grond willen.",
    },
    VIVIUNIV: {
        category: "Potgrond",
        description:
            "Dcm Vivimus universeel: algemene aanplantgrond/potgrond zonder specifieke bodemeisen. Standaardkeuze bij planten met grondsoort 'neutrale grond', 'zandgrond' of 'lichte klei' zonder bijzondere wensen — vergelijkbaar inzetbaar als 'Potgrond Universeel'.",
    },
    VIVIZUUR: {
        category: "Potgrond",
        description:
            "Dcm Vivimus zuurminend: aanplantgrond met een lage pH, speciaal voor zuurminnende planten zoals Rhododendron, Erica/Heide, Hortensia (voor blauwe bloemkleur) en coniferen. Gebruik bij grondsoort 'zure grond' in de plantspecificaties; niet gebruiken bij planten die neutrale of kalkrijke grond nodig hebben.",
    },

    // -----------------------------------------------------------------------
    // Daktuinen
    // -----------------------------------------------------------------------
    GRSZEHUM: {
        category: "Daktuinen",
        description:
            "GreenRoof Subfeed + zeewier en humuszuren: voeding op basis van zeewier en humuszuren, specifiek voor de dunne, voedingsarme substraatlaag van een sedumdak/groendak. Stimuleert bodemleven zonder de plantengroei te overvoeden (sedum verdraagt geen voedselrijke grond). Uitsluitend relevant bij groendaksystemen, niet bij reguliere tuinbeplanting op maaiveld.",
    },
    GRSBACTE: {
        category: "Daktuinen",
        description:
            "Greenroof Sedum-mix + bacteriën: kant-en-klaar mengsel van diverse sedumsoorten met toegevoegde bodembacteriën, voor de aanleg van een sedumdak/groendak. Niet relevant voor reguliere tuinbeplanting op maaiveld.",
    },
    REPSCASS: {
        category: "Daktuinen",
        description:
            "Readyroof Premium Sedum cassette: voorgekweekte sedum-cassette (modulair legsysteem) voor snelle, complete aanleg van een sedumdak, met een dichtere/meer volgroeide beplanting dan de standaard cassette. Uitsluitend relevant bij groendaksystemen.",
    },
    RESCASSE: {
        category: "Daktuinen",
        description:
            "Readyroof Sedum cassette: voorgekweekte sedum-cassette (modulair legsysteem) voor snelle aanleg van een sedumdak, standaard kwaliteit. Uitsluitend relevant bij groendaksystemen.",
    },
    SEDUMGMD: {
        category: "Daktuinen",
        description:
            "Sedum Gemengd: losse sedumplanten in gemengde soorten en kleuren. Te gebruiken als droogteresistente bodembedekker op platte daken, of op volle grond met arme, goed doorlatende, zonnige standplaats (vergelijkbaar met de standplaats- en grondsoorteisen van sedumsoorten in de plantencatalogus).",
    },
    SEKVKOKO: {
        category: "Daktuinen",
        description:
            "Sedum kruiden vegetatiemat kokos: voorgekweekte vegetatiemat op kokosbasis met sedum en kruiden, voor snelle, directe bodembedekking. Geschikt op daken of op vlakke, magere, goed doorlatende grond.",
    },
    SERRUPES: {
        category: "Daktuinen",
        description:
            "Sedum reflexum Rupestre (Tripmadam): winterharde, droogteresistente sedumsoort die dient als laagblijvende bodembedekker. Heeft een zonnige standplaats en arme, goed doorlatende grond nodig (rotstuin, daktuin, of droge border) — niet geschikt voor schaduw of vochtige, voedselrijke grond.",
    },
    SETELEPH: {
        category: "Daktuinen",
        description:
            "Sedum telephium (Vetkruid): hogere sedumsoort (circa 40-60 cm) met bloeischermen, te gebruiken als vaste plant in een border of op een extensieve daktuin. Houdt van een zonnige standplaats en schrale, goed doorlatende grond; niet geschikt voor schaduw of natte grond.",
    },
    SEDMMYCO: {
        category: "Daktuinen",
        description:
            "SedumStart Daktuinsubstraat met mycorrhizae: lichtgewicht groeimedium specifiek voor de aanleg van sedumdaken, verrijkt met mycorrhizaschimmels die de wortelgroei in het van nature arme daksubstraat stimuleren. Uitsluitend relevant bij groendaksystemen.",
    },
    SEDUMMAT: {
        category: "Daktuinen",
        description:
            "Sedummat: voorgekweekte mat met sedumplanten voor directe, complete bodembedekking. Vooral gebruikt op platte daken, maar ook inzetbaar als snelle bodembedekker op vlakke, open, goed doorlatende grond met een zonnige standplaats.",
    },

    // -----------------------------------------------------------------------
    // Gazon
    // -----------------------------------------------------------------------
    BEZORGGR: {
        category: "Gazon",
        description:
            "Bezorgkosten Graszoden: transportkosten voor de levering van graszoden. Geen fysiek tuinproduct — alleen relevant als er al graszoden in het voorstel/de bestelling zitten, niet als losstaand voorstel.",
    },
    VIVGAZON: {
        category: "Gazon",
        description:
            "DCM Viviimus Gazon: organische gazonmeststof uit de Vivimus-lijn, voor het voeden en versterken van een bestaand gazon. Verbetert wortelgroei en grasconditie zonder verbrandingsrisico. Alleen relevant als er een gazon in het plan voorkomt, niet bij beplantingsvakken.",
    },
    GAMDUNGK: {
        category: "Gazon",
        description:
            "Gazonmest Dungking: korrelmeststof specifiek voor gazononderhoud, voor reguliere bemesting van bestaand gras. Alleen relevant bij een gazon in het plan, niet bij plant- of haagvakken.",
    },
    GAZONMES: {
        category: "Gazon",
        description:
            "Gazonmest emmer Dungking: zelfde gazonmeststof als 'Gazonmest Dungking', in emmerverpakking voor grotere oppervlaktes of gemakkelijker strooien. Alleen relevant bij een gazon in het plan.",
    },
    GRASZBE: {
        category: "Gazon",
        description:
            "Graszoden BEZORGEN: logistieke variant van graszoden-levering (bezorgd op het adres van de klant in plaats van afgehaald). Zelfde productdoel als 'Graszoden afgehaald' — alleen relevant als er een nieuw gazon wordt aangelegd.",
    },
    GRASZAFH: {
        category: "Gazon",
        description:
            "Graszoden afgehaald: kant-en-klare graszoden om zelf af te halen, voor de directe aanleg van een nieuw gazon. Alleen relevant als er een gazon (geen beplantingsvak) in het plan voorkomt.",
    },
    KLGBLEVE: {
        category: "Gazon",
        description:
            "Klavervrij-Bio gazon (beperkt leverbaar): biologisch gazonproduct dat klavergroei in een bestaand gazon tegengaat, voor een uniform grasbeeld zonder chemische klaverbestrijding. Alleen relevant bij gazononderhoud, niet bij beplantingsvakken.",
    },
    MOGAZONM: {
        category: "Gazon",
        description:
            "Mosvrij Gazon-mix: gazonproduct gericht op het voorkomen en bestrijden van mos in een bestaand gazon. Vooral relevant bij vochtige of schaduwrijke gazons waar mos snel woekert. Alleen relevant bij gazononderhoud.",
    },
    MOGAZON: {
        category: "Gazon",
        description:
            "Mosvrij-Bio gazon: biologische variant van mosbestrijding voor een bestaand gazon, zonder chemische middelen. Alleen relevant bij gazononderhoud, niet bij beplantingsvakken.",
    },
    GZBEZORG: {
        category: "Gazon",
        description:
            "graszoden bezorgen op adres: logistieke bezorgvariant van graszoden. Zelfde productdoel als 'Graszoden afgehaald' — alleen relevant bij de aanleg van een nieuw gazon.",
    },
    GRASZSCH: {
        category: "Gazon",
        description:
            "graszoden gazon afhalen raalte (don vrijd): afhaalvariant van graszoden, specifiek op te halen op locatie Raalte (donderdag/vrijdag). Logistiek afhaalproduct voor gazonaanleg, geen losstaand aanplantbenodigdheid voor beplantingsvakken.",
    },

    // -----------------------------------------------------------------------
    // Meststoffen
    // -----------------------------------------------------------------------
    KOBVSCHI: {
        category: "Meststoffen",
        description:
            "Korect, bladmeststof, voorkomt schimmels: vloeibare meststof die via de bladeren wordt opgenomen, met een preventieve werking tegen schimmelziekten zoals meeldauw en roest. Vooral nuttig bij vochtgevoelige planten, dichte beplanting met weinig luchtcirculatie, of planten met een hogere stikstofbehoefte die snel zichtbaar effect nodig hebben.",
    },
    STEPMMLU: {
        category: "Meststoffen",
        description:
            "Strooiwagen EarthWay 2050P meststoffen met luchtbanden: handstrooiwagen om meststoffen of graszaad gelijkmatig over een groter oppervlak (gazon of grote border) uit te strooien. Dit is gereedschap, geen meststof zelf — alleen voorstellen in combinatie met een daadwerkelijke meststof en bij een grotere oppervlakte.",
    },
    DUNGKING: {
        category: "Meststoffen",
        description:
            "Border najaarmest Dungking: najaarsmeststof voor borders/plantvakken, bedoeld om de bodem in het najaar voor te bereiden op de winter. Relevant bij aanplant in het najaarsseizoen, niet bij planten met een lage stikstofbehoefte.",
    },
    TUINMEST: {
        category: "Meststoffen",
        description:
            "Bordermest Dungking: algemene meststof voor borders en plantvakken bij aanplant in de volle grond. Geschikt voor planten met een gemiddelde tot hogere stikstofbehoefte; niet nodig bij planten die juist arme grond willen.",
    },
    SIERTUME: {
        category: "Meststoffen",
        description:
            "Prof Siertuinmest: professionele meststof specifiek voor siertuinen (vaste planten, heesters, sierborders). Geschikt voor planten met een gemiddelde tot hogere stikstofbehoefte.",
    },
    TUMEDUNG: {
        category: "Meststoffen",
        description:
            "Tuinmest emmer Dungking: zelfde algemene tuinmeststof als 'Bordermest Dungking', in emmerverpakking voor grotere oppervlaktes of gemakkelijker doseren.",
    },
    VANAJAAR: {
        category: "Meststoffen",
        description:
            "VaBomix 2 (najaarsmest): najaarsmeststof om de bodem rond planten voor te bereiden op de winter, ondersteunt wortelgroei in het najaar. Relevant bij aanplant in het najaarsseizoen.",
    },
    STARTMES: {
        category: "Meststoffen",
        description:
            "Startersmest Dungking: meststof specifiek bedoeld om net aangeplante planten te helpen snel wortel te schieten in de eerste periode na aanplant. Relevant bij vrijwel elke nieuwe aanplant, ongeacht grondsoort.",
    },

    // -----------------------------------------------------------------------
    // Overig
    // -----------------------------------------------------------------------
    BOOMPALE: {
        category: "Overig",
        description:
            "Boompalen/Boompaal: houten paal om een jong geplante boom de eerste jaren rechtop te ondersteunen tegen wind. Aantal komt overeen met het aantal geplante bomen (meestal 1 tot 3 palen per boom, afhankelijk van stamdikte en boomhoogte).",
    },
    BOOOMBAN: {
        category: "Overig",
        description:
            "Boomband: band waarmee de stam van een boom aan de boompaal wordt bevestigd, voorkomt schuren en scheefgroei. Altijd samen met boompalen gebruiken, ongeveer 1 set per boom.",
    },
    DCMMIX6: {
        category: "Overig",
        description:
            "DCM Mix 6 (minigranulaat): organische allround-meststof voor de bodem rondom heesters en vaste planten bij aanplant, geschikt voor de meeste grondsoorten en een gemiddelde stikstofbehoefte. Dosering schaalt met de oppervlakte van het plantvak in m², niet met het aantal planten. Bij planten met een lage stikstofbehoefte (bv. veel sedumsoorten, mediterrane planten) is bemesting vaak niet nodig of zelfs ongewenst.",
    },
    GRMSELEM: {
        category: "Overig",
        description:
            "Greenfields met sporenelementen: bodemverbeteraar/meststof verrijkt met sporenelementen (micronutriënten zoals ijzer, mangaan en zink). Relevant bij planten die gevoelig zijn voor sporenelementtekorten (vaak zichtbaar als bladvergeling/chlorose, bijvoorbeeld bij planten op kalkrijke grond), niet als algemene basisbemesting.",
    },
    KLHJUN: {
        category: "Overig",
        description:
            "Kluitheffer Junior 250 kg: gereedschap om plantkluiten te tillen en verplaatsen tijdens de aanleg. Dit is hulpapparatuur voor de hovenier, geen materiaal dat in de tuin blijft — stel dit niet voor als aanplantproduct voor de klant.",
    },
    KLH500: {
        category: "Overig",
        description:
            "Kluitheffer 500 kg: zelfde als Kluitheffer Junior, voor zwaardere kluiten. Hulpapparatuur voor de hovenier, geen aanplantmateriaal voor de klant.",
    },
    KLH750: {
        category: "Overig",
        description:
            "Kluitheffer 750 kg: voor de zwaarste kluiten. Hulpapparatuur voor de hovenier, geen aanplantmateriaal voor de klant.",
    },
    BASALTME: {
        category: "Overig",
        description:
            "Basaltmeel 0-1 mm: gemalen vulkanisch gesteente, een mineraal bodemverbeteraar die op lange termijn sporenelementen afgeeft en de bodemstructuur verbetert. Geen snelwerkende meststof; relevant als algemene bodemverbeteraar bij aanplant, niet als vervanging voor reguliere bemesting.",
    },
    BEMM: {
        category: "Overig",
        description:
            "Bentoniet 1-3 mm: kleimineraal-granulaat dat het vochthoudend vermogen van zandgrond verbetert. Relevant bij aanplant op droogtegevoelige zandgrond; niet nodig bij grondsoorten die al vocht goed vasthouden (klei, humusrijke grond).",
    },
    BIMTPBZE: {
        category: "Overig",
        description:
            "BioBodem + Mycorrhizae, Trichoderma, protozoa, bacteriën, zeewier: biologisch bodemactivatorproduct met mycorrhizaschimmels en bodemleven, stimuleert wortelontwikkeling en bodemgezondheid bij aanplant. Algemeen inzetbaar bij vrijwel elke aanplant in de volle grond.",
    },
    BIMEZEEW: {
        category: "Overig",
        description:
            "BioHaag + Mycorrhizae en zeewier: biologisch product specifiek voor de aanplant van hagen, met mycorrhizaschimmels en zeewierextract om de wortelaanslag van haagplanten te stimuleren. Alleen relevant bij haagvakken.",
    },
    BIPFBSBO: {
        category: "Overig",
        description:
            "BioSoil Power F: bodemverbeteraar die de groei van nuttige bodemschimmels stimuleert, ondersteunt een gezonde bodem en wortelontwikkeling bij aanplant.",
    },
    CADOP70: {
        category: "Overig",
        description:
            "Cacaodoppen 70 liter: organisch mulchmateriaal van cacaodoppen, voor op de bodem rondom planten. Onderdrukt onkruid en houdt vocht vast; werkt licht verzurend, dus vooral geschikt bij planten die neutrale tot licht zure grond verdragen.",
    },
    ECON: {
        category: "Overig",
        description:
            "ECO Organic N: organische stikstofmeststof. Geschikt bij planten met een gemiddelde tot hogere stikstofbehoefte; niet gebruiken bij planten die juist arme, voedselarme grond willen.",
    },
    FL240WS: {
        category: "Overig",
        description:
            "FL240WS: verbindings-/montageonderdeel (240 cm) voor het Straightcurve stalen borderrandsysteem (zie POST-1100). Alleen relevant in combinatie met borderrand-aanleg, geen losstaand product.",
    },
    FL400WS: {
        category: "Overig",
        description:
            "FL400WS: verbindings-/montageonderdeel (400 cm) voor het Straightcurve stalen borderrandsysteem (zie POST-1100). Alleen relevant in combinatie met borderrand-aanleg, geen losstaand product.",
    },
    FL240WSC: {
        category: "Overig",
        description:
            "FL240WS-CRNR-SET: hoekverbindingsset voor het Straightcurve stalen borderrandsysteem (zie POST-1100), voor het maken van hoeken in de borderrand. Alleen relevant in combinatie met borderrand-aanleg.",
    },
    FRBOO40: {
        category: "Overig",
        description:
            "Franse Boomschors 30-40 mm, 40 liter: grove sierschors voor het mulchen rondom bomen, heesters en borders. Onderdrukt onkruid, houdt vocht vast en geeft een verzorgde, decoratieve afwerking. Hoeveelheid schaalt met de oppervlakte van het vak in m².",
    },
    FRBOOBIG: {
        category: "Overig",
        description:
            "Franse Boomschors 30-40 mm, bigbag 2m³: zelfde sierschors als de 40-liter-verpakking, in grootverpakking voor grotere mulch-oppervlaktes.",
    },
    GAKVERBL: {
        category: "Overig",
        description:
            "Gaasvlieg kwartier/verblijf: schuilplaats voor gaasvliegen, een natuurlijke vijand van bladluis. Biologisch hulpmiddel voor natuurlijke plaagbestrijding, geen plantmateriaal — alleen relevant als de klant interesse heeft in biologische tuinverzorging.",
    },
    GIKORREL: {
        category: "Overig",
        description:
            "Gips korrelkalk: bodemverbeteraar die de structuur van zware kleigrond verbetert zonder de pH te verhogen (in tegenstelling tot reguliere kalk). Relevant bij aanplant op kleigrond; niet nodig op zandgrond.",
    },
    GRMEHUMI: {
        category: "Overig",
        description:
            "GrasZo + Mycorrhizae en humifirst: bodemproduct met mycorrhizae en humuszuren voor de aanleg van een nieuw gazon. Alleen relevant bij gazonaanleg, niet bij beplantingsvakken.",
    },
    HYDROK40: {
        category: "Overig",
        description:
            "Hydrokorrels Grof 8-16 mm, 40 liter: lichtgewicht, poreuze kleikorrels die de drainage verbeteren. Te gebruiken onderin een plantbak/pot zonder afvoergat, of gemengd door zware grond bij planten die geen 'natte voeten' verdragen.",
    },
    INPROXL: {
        category: "Overig",
        description:
            "Insectenverblijf Pro XL: groot insectenhotel dat nuttige insecten (zoals bestuivers en natuurlijke plaagbestrijders) een schuilplaats biedt. Biodiversiteits-/sierproduct, geen plantbenodigdheid — alleen relevant bij interesse in een natuurvriendelijke tuin.",
    },
    NEVAALTJ: {
        category: "Overig",
        description:
            "Nemasprayer voor aaltjes: toedieningsapparaat om nematoden (aaltjes) te verspreiden voor biologische bestrijding van larven/engerlingen in gazon of grond. Dit is gereedschap voor toepassing, geen plantmateriaal.",
    },
    OPSMIX: {
        category: "Overig",
        description:
            "Optie-spore (sporen mix): sporenmengsel, vermoedelijk een mycorrhiza-/schimmelinoculant om wortelontwikkeling bij aanplant te stimuleren.",
    },
    PAIPXL: {
        category: "Overig",
        description:
            "Palenset Insectenverblijf Pro XL: montagepalen om het Insectenverblijf Pro XL op te zetten. Alleen relevant in combinatie met dat insectenhotel, geen losstaand product.",
    },
    ROGRO40: {
        category: "Overig",
        description:
            "Rozengrond 40 liter: aanplantgrond specifiek samengesteld voor de voedingsbehoefte van rozen. Gebruiken bij het aanplanten van rozen; voor andere plantsoorten is een universele potgrond of tuinaarde geschikter.",
    },
    STRAMEVO: {
        category: "Overig",
        description:
            "Structuur-Actief Rhodo aanplantgrond + Mycorrhizae en voeding: specialistische aanplantgrond voor Rhododendron en andere zuurminnende planten (Erica/Heide, Azalea), met mycorrhizae en voeding voor goede wortelaanslag. Gebruik bij grondsoort 'zure grond' in de plantspecificaties.",
    },
    STAMEVOE: {
        category: "Overig",
        description:
            "Structuur-Actief aanplantgrond + Mycorrhizae en voeding: algemene aanplantgrond met mycorrhizae en voeding voor een goede wortelaanslag bij heesters en bomen. Breed inzetbaar, geen specifieke grondsoort vereist.",
    },
    TUINTURF: {
        category: "Overig",
        description:
            "Tuinturf: tuinturf (veen) als bodemverbeteraar, verbetert vochthoudend vermogen en verzuurt de grond licht. Geschikt bij planten die humusrijke tot licht zure grond willen; minder duurzaam alternatief voor veenvrije potgrond.",
    },
    TUTURF40: {
        category: "Overig",
        description:
            "Tuinturf 40 liter: zelfde product als 'Tuinturf', in een 40-literverpakking.",
    },
    TUSTR70: {
        category: "Overig",
        description:
            "Turfstrooisel 70 liter: los strooiturfmateriaal, te gebruiken als bodemverbeteraar of mulchlaag die vocht vasthoudt en de grond licht verzuurt.",
    },
    VIJVAA25: {
        category: "Overig",
        description:
            "Vijveraarde 25 liter: specifiek substraat voor het planten van vijver- en moerasplanten in of rond een vijver. Alleen relevant bij vijverbeplanting, niet bij reguliere tuinbeplanting.",
    },
    POST1100: {
        category: "Overig",
        description:
            "POST-1100 Straightcurve: borderrand van staal. Zorgt voor een strakke, duurzame afbakening en duidelijke scheiding van een plantvak of border. Hoeveelheid schaalt met de lengte/omtrek van de border, niet met het aantal planten.",
    },
    RONDSTRO: {
        category: "Overig",
        description:
            "Een rondstrop is een flexibel hijsmiddel, vervaardigd uit sterke synthetische vezels en voorzien van een beschermende hoes. Door de gesloten lusvorm is de rondstrop geschikt voor het veilig hijsen, verplaatsen en positioneren van zware lasten. Dankzij het zachte en flexibele materiaal wordt beschadiging aan de last beperkt, waardoor rondstroppen veel worden toegepast bij het hijsen van onder andere bomen, plantenbakken, bouwmaterialen en andere zware objecten. Rondstroppen zijn verkrijgbaar in verschillende draagvermogens, die doorgaans herkenbaar zijn aan een kleurcodering en een duidelijk belastingslabel. Dit is hulpmateriaal voor het verplaatsen van zware bomen/kluiten tijdens de aanleg, geen blijvend aanplantproduct voor de klant.",
    },
    SLLEUFET: {
        category: "Overig",
        description:
            "Sleufetiket: etiket om in de grond te plaatsen bij een plantvak, voor latere identificatie van de plant. Maximaal 1 per unieke plantsoort, niet per stuk plant.",
    },
};

export function getAccessoryCatalogMeta(materialId: string): AccessoryCatalogMeta {
    return (
        ACCESSORY_CATALOG_META[materialId] ?? {
            category: "Overig",
            description: "",
        }
    );
}
