export type RightStepId = 1 | 2 | 3 | 4;

export type RightStepMenuStep = {
    id: RightStepId;
    label: string;
    title: string;
};

export type WizardChoiceCardOption = {
    value: string;
    label: string;
    imageSrc?: string;
};

export type WizardOptionRowOption = {
    value: string;
    label: string;
};

export type RightStepStep1FollowUpConfig = {
    question: string;
    options: WizardOptionRowOption[];
};

export type RightStepStep2SoilOption = {
    value: string;
    label: string;
    description: string;
    imageSrc: string;
};

export type RightStepStep2MaintenanceOption = {
    value: string;
    label: string;
    features: string[];
};

export type Step3StructureDistribution = {
    bodembedekkers: number | null;
    vastePlanten: number | null;
    heestersEnStruiken: number | null;
    bomen: number | null;
};

export type Step3StructureOption = {
    value: string;
    label: string;
    description: string;
    imageSrc: string;
    distribution: Step3StructureDistribution;
    explanationTitle?: string;
    explanationBullets?: string[];
    explanationTip?: string;
};

export const RIGHT_STEP_MENU_STEPS: RightStepMenuStep[] = [
    {
        id: 1,
        label: "Locatie bepalen",
        title: "Stap 1 van 4: Locatie bepalen",
    },
    {
        id: 2,
        label: "Situatie en randvoorwaarden",
        title: "Stap 2 van 4: Situatie en randvoorwaarden",
    },
    {
        id: 3,
        label: "Structuur en opbouw",
        title: "Stap 3 van 4: Structuur en opbouw",
    },
    {
        id: 4,
        label: "Beleving en ruimte",
        title: "Stap 4 van 4: Beleving en ruimte",
    },
];

export const RIGHT_STEP_STEP1_LOCATION_OPTIONS: WizardChoiceCardOption[] = [
    {
        value: "tuin",
        label: "Tuin",
        imageSrc: "/images/tuin.jpeg",
    },
    {
        value: "border-plantvak",
        label: "Border / plantvak",
        imageSrc: "/images/border-plantvak.jpg",
    },
    {
        value: "bedrijfsterrein",
        label: "Bedrijfsterrein",
        imageSrc: "/images/bedrijfsterrein.jpg",
    },
    {
        value: "openbare-ruimte",
        label: "Openbare ruimte",
        imageSrc: "/images/openbare-ruimte.jpg",
    },
    {
        value: "park-groenvoorziening",
        label: "Park / groenvoorziening",
        imageSrc: "/images/park-groenvoorziening.jpg",
    },
    {
        value: "erf-landschap",
        label: "Erf / landschap",
        imageSrc: "/images/erf-landschap.jpg",
    },
];

export const RIGHT_STEP_STEP1_FOLLOW_UP_BY_LOCATION: Record<string, RightStepStep1FollowUpConfig> = {
    tuin: {
        question: "Waar in de tuin komt de beplanting?",
        options: [
            { value: "voortuin", label: "Voortuin" },
            { value: "achtertuin", label: "Achtertuin" },
            { value: "zijtuin", label: "Zijtuin" },
            { value: "patio-binnentuin", label: "Patio / binnentuin" },
            { value: "rond-terras-of-zitplek", label: "Rond terras of zitplek" },
            { value: "meerdere-zones", label: "Meerdere zones" },
        ],
    },
    "border-plantvak": {
        question: "Waar ligt het plantvak of de border?",
        options: [
            { value: "voorborder", label: "Voorborder (langs gevel/ schutting)" },
            { value: "sierborder", label: "Sierborder" },
            { value: "gemengde-border", label: "Gemengde border (vaste planten + heesters)" },
            { value: "schaduwborder", label: "Schaduwborder" },
            { value: "langs-pad-oprit", label: "Langs pad / oprit" },
            { value: "meerdere-plantvakken", label: "Meerdere plantvakken" },
        ],
    },
    bedrijfsterrein: {
        question: "Waar op het bedrijfsterrein komt de beplanting?",
        options: [
            { value: "entree-ontvangstzone", label: "Entree / ontvangszone" },
            { value: "parkeerterrein", label: "Parkeerterrein" },
            { value: "rondom-het-pand", label: "Rondom het pand" },
            { value: "binnenplaats", label: "Binnenplaats" },
            { value: "representatieve-zone", label: "Representatieve zone" },
            { value: "groenzone-bufferstrook", label: "Groenzone / bufferstrook" },
        ],
    },
    "openbare-ruimte": {
        question: "In welk type openbare ruimte komt de beplanting?",
        options: [
            { value: "langs-straat-of-weg", label: "Langs straat of weg" },
            { value: "langs-fiets-of-wandelroute", label: "Langs fiets- of wandelroute" },
            { value: "plein-of-verhard-gebied", label: "Plein of verhard gebied" },
            { value: "berm-of-tussenstrook", label: "Berm of tussenstrook" },
            { value: "parkeerzone-of-randbeplanting", label: "Parkeerzone of randbeplanting" },
            { value: "meerdere-zones", label: "Meerdere zones" },
        ],
    },
    "park-groenvoorziening": {
        question: "Wat voor type park / groenzone wil je inrichten?",
        options: [
            { value: "stadspark", label: "Stadspark" },
            { value: "plantsoen", label: "Plantsoen" },
            { value: "groenzone-langs-water", label: "Groenzone langs water" },
            { value: "recreatief-groen", label: "Recreatief groen" },
            { value: "speelplek-of-speelpark", label: "Speelplek of speelpark" },
            { value: "meerdere-zones", label: "Meerdere zones" },
        ],
    },
    "erf-landschap": {
        question: "Waar op het erf of in het landschap komt de beplanting?",
        options: [
            { value: "weide-landschappelijke-zone", label: "Weide / landschappelijke zone" },
            { value: "erfscheiding-houtwal", label: "Erfscheiding / houtwal" },
            { value: "oprit-toegangsweg", label: "Oprit / toegangsweg" },
            { value: "boomgaard-fruitweide", label: "Boomgaard / fruitweide" },
            { value: "natuurzone-ruigte", label: "Natuurzone / ruigte" },
            { value: "meerdere-zones", label: "Meerdere zones" },
        ],
    },
};

export const RIGHT_STEP_STEP2_STANDPLAATS_OPTIONS: WizardOptionRowOption[] = [
    { value: "zon", label: "Zon" },
    { value: "halfschaduw", label: "Halfschaduw" },
    { value: "schaduw", label: "Schaduw" },
    { value: "wisselend-onbekend", label: "Wisselend/onbekend" },
];

export const RIGHT_STEP_STEP2_SOIL_OPTIONS: RightStepStep2SoilOption[] = [
    {
        value: "zandgrond",
        label: "Zandgrond",
        description: "Licht, voedselarm, snel droog",
        imageSrc: "/images/zandgrond.png",
    },
    {
        value: "klei",
        label: "Klei",
        description: "Zwaar, voedselrijk, vasthoudend",
        imageSrc: "/images/klei.jpg",
    },
    {
        value: "lichte-klei-zandleem",
        label: "Lichte klei / zandleem",
        description: "Licht bij zware grond",
        imageSrc: "/images/lichte-klei-zandleem.jpg",
    },
    {
        value: "humusrijk-bosgrond",
        label: "Humusrijk / bosgrond",
        description: "Schaduwrijk, humusrijk",
        imageSrc: "/images/humusrijk-bosgrond.jpg",
    },
    {
        value: "veengrond-nat",
        label: "Veengrond / nat",
        description: "Vochtig, zuur, zacht",
        imageSrc: "/images/veengrond-nat.jpg",
    },
];

export const RIGHT_STEP_STEP2_MAINTENANCE_OPTIONS: RightStepStep2MaintenanceOption[] = [
    {
        value: "laag",
        label: "Laag onderhoud",
        features: [
            "Weinig onderhoud nodig",
            "Meer groenblijvend en sterke soorten",
            "Minder seizoenswissel",
        ],
    },
    {
        value: "gemiddeld",
        label: "Gemiddeld onderhoud",
        features: [
            "Af en toe snoeien en bijhouden",
            "Mooie bloei en afwissel",
            "Praktisch en realistisch voor de meeste tuinen",
        ],
    },
    {
        value: "hoog",
        label: "Hoog onderhoud",
        features: [
            "Regelmatig snoeien en bijhouden",
            "Meer bloeiende en gevoelige soorten",
            "Strakker en luxer resultaat",
        ],
    },
];

export const RIGHT_STEP_STEP2_CERTIFICATION_OPTIONS: WizardOptionRowOption[] = [
    { value: "maakt-niet-uit", label: "Maakt niet uit" },
    { value: "alleen-met-keurmerk", label: "Alleen planten mét keurmerk" },
    { value: "alleen-zonder-keurmerk", label: "Alleen planten zónder keurmerk" },
];

export const RIGHT_STEP_STEP3_STRUCTURE_OPTIONS: Step3StructureOption[] = [
    {
        value: "gebalanceerd",
        label: "Gebalanceerd",
        description: "Goede balans tussen bloei, structuur en rust.",
        imageSrc: "/images/gebalanceerd.png",
        distribution: {
            bodembedekkers: 30,
            vastePlanten: 40,
            heestersEnStruiken: 20,
            bomen: 10,
        },
        explanationTitle: "Wat betekend ‘Gebalanceerd’?",
        explanationBullets: [
            "Goede mix van bloei en groenstructuur",
            "Geschikt voor de meeste tuinen en borders",
            "Rustig beeld met genoeg seizoenswissel",
            "Makkelijk later aan te passen in de plantenkeuze",
        ],
        explanationTip:
            "Tip: Perfect als veilige basis voor de meeste tuinprojecten",
    },
    {
        value: "bloei-en-kleur",
        label: "Bloei & kleur",
        description: "Focus op bloemen en seizoenskleur voor een levendig geheel.",
        imageSrc: "/images/bloei-en-kleur.png",
        distribution: {
            bodembedekkers: 20,
            vastePlanten: 55,
            heestersEnStruiken: 20,
            bomen: 5,
        },
        explanationTitle: "Wat betekend ‘Bloei & kleur’?",
        explanationBullets: [
            "Focus op bloemen en seizoenskleur",
            "Veel variatie in bloei door het jaar heen",
            "Minder nadruk op vaste structuur, meer op beleving",
            "Ideaal voor kleurrijke borders en zichtlocaties",
        ],
        explanationTip:
            "Tip: Ideaal als je klant vooral veel kleur en seizoensbeleving wil zien.",
    },
    {
        value: "structuur-en-rust",
        label: "Structuur & rust",
        description: "Meer groen en vorm, met een rustig en tijdloos beeld.",
        imageSrc: "/images/structuur-en-rust.png",
        distribution: {
            bodembedekkers: 25,
            vastePlanten: 25,
            heestersEnStruiken: 40,
            bomen: 10,
        },
        explanationTitle: "Wat betekend ‘Structuur & rust’?",
        explanationBullets: [
            "Meer groen en vorm, minder nadruk op bloei",
            "Rustig en tijdloos totaalbeeld",
            "Sterke basis met heesters en groenblijvers",
            "Geschikt voor onderhoudsarme en strakke tuinen",
        ],
        explanationTip:
            "Tip: Geschikt voor tuinen waar rust, vorm en onderhoudsgemak belangrijk zijn.",
    },
    {
        value: "met-bomen",
        label: "Met bomen",
        description: "Ideaal als je extra hoogte, diepte en karakter aan het plan wilt toevoegen.",
        imageSrc: "/images/met-bomen.png",
        distribution: {
            bodembedekkers: 20,
            vastePlanten: 30,
            heestersEnStruiken: 30,
            bomen: 20,
        },
        explanationTitle: "Wat betekend ‘Met bomen’?",
        explanationBullets: [
            "Extra hoogte en diepte in het ontwerp",
            "Meer gelaagdheid en ruimtelijk effect",
            "Bomen als blikvanger of structuurdrager",
            "Geschikt voor grotere tuinen en erven",
        ],
        explanationTip:
            "Tip: Aanrader voor grotere tuinen of projecten waar je echt diepte en hoogte wilt creëren.",
    },
    {
        value: "vrij-samenstellen",
        label: "Vrij samenstellen",
        description: "Bepaal zelf de verhoudingen en stel het plan volledig naar wens samen.",
        imageSrc: "/images/vrij-samenstellen.png",
        distribution: {
            bodembedekkers: null,
            vastePlanten: null,
            heestersEnStruiken: null,
            bomen: null,
        },
    },
];