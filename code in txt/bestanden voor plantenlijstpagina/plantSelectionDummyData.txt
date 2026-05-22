export type PlantGroupKey =
    | "bodembedekkers"
    | "vaste-planten"
    | "heesters-struiken"
    | "bomen"
    | "zoek-zelf";

export type ViewMode = "grid" | "list";

export type DummyPlant = {
    id: string;
    group: Exclude<PlantGroupKey, "zoek-zelf">;
    name: string;
    latinName: string;
    badge?: string;
    stockLabel: string;
    pricePerPiece: number;
    imageSrc: string;
};

export type DummyPlantSpecificationRow = {
    label: string;
    value: string;
    iconSrc: string;
};

export type DummyPlantSpecifications = {
    leftColumn: DummyPlantSpecificationRow[];
    rightColumn: DummyPlantSpecificationRow[];
};

export type PlantSelectionAdvancedArrayFilterKey =
    | "plantgroepen"
    | "kleuren"
    | "standplaatsen"
    | "grondsoorten"
    | "bloeiperiodes";

export type PlantSelectionAdvancedFilters = Record<
    PlantSelectionAdvancedArrayFilterKey,
    string[]
>;

export type DummyPlantSearchCardData = {
    botanicalName: string;
    dutchName: string;
    sizeLabel: string;
    stockLabel: string;
    plantGroupBadges: string[];
    isInheems: boolean;
    kleuren: string[];
    standplaatsen: string[];
    grondsoorten: string[];
    bloeiperiodes: string[];
};

export const EMPTY_ADVANCED_PLANT_SELECTION_FILTERS: PlantSelectionAdvancedFilters = {
    plantgroepen: [],
    kleuren: [],
    standplaatsen: [],
    grondsoorten: [],
    bloeiperiodes: [],
};

export const DUMMY_PLANT_SIZE_OPTIONS = [
    "Geen maat geselecteerd",
    "GM P9",
    "15-20 cm P9",
    "20-30 cm C1",
    "30-40 cm C2",
    "40-60 cm C3",
    "60-80 cm C5",
    "80-100 cm C7,5",
    "100-125 cm C10",
    "60-80 cm 5L",
    "80-100 cm 7,5L",
    "100-125 cm 10L",
    "125-150 cm cont.",
    "150-175 cm cont",
    "175-200 cm container",
    "125-150 cm C10",
    "10-12HO DR",
    "10-12HO drkl",
    "10-12HO drkluit",
    "10-12HO draadkluit",
    "10-12HO draadkluit leivorm",
] as const;

export const DUMMY_PLANT_SPECIFICATIONS: DummyPlantSpecifications = {
    leftColumn: [
        {
            label: "Nederlandse naam",
            value: "Dwergmispel",
            iconSrc: "/icons/nederlandse-naam.svg",
        },
        {
            label: "Planthoeveelheid per m²",
            value: "6",
            iconSrc: "/icons/planthoeveelheid-per-m2.svg",
        },
        {
            label: "Volwassen hoogte",
            value: "30 cm",
            iconSrc: "/icons/volwassen-hoogte.svg",
        },
        {
            label: "Kleur bloem",
            value: "wit",
            iconSrc: "/icons/kleur-bloem.svg",
        },
        {
            label: "Kleur blad",
            value: "groen",
            iconSrc: "/icons/kleur-blad.svg",
        },
        {
            label: "Bloeiperiode",
            value: "mei - juni",
            iconSrc: "/icons/bloeiperiode.svg",
        },
        {
            label: "Bodembedekker",
            value: "ja",
            iconSrc: "/icons/bodembedekker.svg",
        },
    ],
    rightColumn: [
        {
            label: "Inheems",
            value: "nee",
            iconSrc: "/icons/inheems.svg",
        },
        {
            label: "Stikstofbehoefte",
            value: "10 - 20 g",
            iconSrc: "/icons/stikstofbehoefte.svg",
        },
        {
            label: "Standplaats",
            value: "zon, halfschaduw",
            iconSrc: "/icons/standplaats.svg",
        },
        {
            label: "Grondsoort",
            value: "zandgrond, lichte klei, neutrale grond",
            iconSrc: "/icons/grondsoort.svg",
        },
        {
            label: "Toelichting",
            value:
                "De Cotoneaster dammeri, ook wel bekend als de Dwergmispel, is een laagblijvende struik met witte bloemen in mei-juni. Het groene blad en de compacte groei maken het een ideale bodembedekker voor zonnige tot halfschaduwrijke plekken op zandgrond, lichte klei of neutrale grond.",
            iconSrc: "/icons/toelichting.svg",
        },
    ],
};

export const PLANT_SELECTION_COLOR_OPTIONS = [
    "Blauw",
    "Rood",
    "Geel",
    "Wit",
    "Roze",
    "Paars",
];

export const PLANT_SELECTION_BLOEIPERIODE_OPTIONS = [
    "jan - mrt",
    "mrt - mei",
    "juni - aug",
    "sept - nov",
];

export const PLANT_SELECTION_PLANTGROUP_OPTIONS = [
    "Vaste planten",
    "Heesters",
    "Coniferen",
    "Klimplanten",
    "Fruit",
    "Mediterraan",
    "Rhododendrons",
    "Rhododendrons boskwaliteit",
    "Ericaceae",
    "Rozen",
    "Bomen",
    "Dak, lei- & vormbomen",
    "Meerstammig",
    "Bosplantsoen",
    "Bloembollen",
    "Vijverplanten",
    "Perkgoed",
    "Bonsai",
    "Kant en klaar haag",
    "Tuinmaterialen",
];

export const PLANT_SELECTION_STANDPLAATS_OPTIONS = [
    "Zon",
    "Halfschaduw",
    "Schaduw",
];

export const PLANT_SELECTION_GRONDSOORT_OPTIONS = [
    "Zandgrond",
    "Klei",
    "Lemige grond",
    "Lichte klei",
    "Zware klei",
    "Zure grond",
    "Kalkrijke grond",
    "Neutrale grond",
    "Voedselarme grond",
    "Voedselrijke grond",
    "Goede tuingrond",
    "Humusrijke grond",
    "Bosgrond",
    "Veengrond",
    "Moerassige grond",
    "Droge zandgrond",
    "Natte klei",
    "Leemgrond",
    "Alluviale grond",
    "Lössgrond",
];

export type PlantSelectionBaseFilterKey = "opVoorraad" | "inheems";

export type PlantSelectionVisibleFilterKey =
    | PlantSelectionBaseFilterKey
    | PlantSelectionAdvancedArrayFilterKey;

export type PlantSelectionVisibleFilterSection = {
    key: PlantSelectionVisibleFilterKey;
    label: string;
    kind: "toggle" | "expandable";
};

const DEFAULT_VISIBLE_FILTER_SECTIONS: PlantSelectionVisibleFilterSection[] = [
    { key: "opVoorraad", label: "Op voorraad", kind: "toggle" },
    { key: "inheems", label: "Inheems", kind: "toggle" },
    { key: "kleuren", label: "Kleur", kind: "expandable" },
    { key: "bloeiperiodes", label: "Bloeiperiode", kind: "expandable" },
];

const SEARCH_VISIBLE_FILTER_SECTIONS: PlantSelectionVisibleFilterSection[] = [
    { key: "opVoorraad", label: "Op voorraad", kind: "toggle" },
    { key: "inheems", label: "Inheems", kind: "toggle" },
    { key: "plantgroepen", label: "Plantgroep", kind: "expandable" },
    { key: "kleuren", label: "Kleur", kind: "expandable" },
    { key: "standplaatsen", label: "Standplaats", kind: "expandable" },
    { key: "grondsoorten", label: "Grondsoort", kind: "expandable" },
    { key: "bloeiperiodes", label: "Bloeiperiode", kind: "expandable" },
];

export function getVisiblePlantSelectionFilterSections(
    isSearchMode: boolean
): PlantSelectionVisibleFilterSection[] {
    return isSearchMode
        ? SEARCH_VISIBLE_FILTER_SECTIONS
        : DEFAULT_VISIBLE_FILTER_SECTIONS;
}

const INHEEMS_PLANT_IDS = new Set([
    "plant-3",
    "plant-4",
    "plant-7",
    "plant-8",
    "plant-9",
    "plant-12",
    "plant-13",
    "plant-17",
    "plant-23",
    "plant-27",
    "plant-29",
]);

const SIZE_LABEL_BY_PLANT_ID: Record<string, string> = {
    "plant-1": "GM P9",
    "plant-2": "20-30 cm C1",
    "plant-3": "60-80 cm 5L",
    "plant-4": "40-60 cm C3",
    "plant-5": "60-80 cm C5",
    "plant-6": "125-150 cm cont.",
    "plant-7": "30-40 cm C2",
    "plant-8": "15-20 cm P9",
    "plant-9": "20-30 cm C1",
    "plant-10": "80-100 cm 7,5L",
    "plant-11": "150-175 cm cont",
    "plant-12": "80-100 cm C7,5",
    "plant-13": "GM P9",
    "plant-14": "40-60 cm C3",
    "plant-15": "60-80 cm 5L",
    "plant-16": "30-40 cm C2",
    "plant-17": "15-20 cm P9",
    "plant-18": "60-80 cm C5",
    "plant-19": "100-125 cm C10",
    "plant-20": "80-100 cm 7,5L",
    "plant-21": "175-200 cm container",
    "plant-22": "20-30 cm C1",
    "plant-23": "20-30 cm C1",
    "plant-24": "60-80 cm 5L",
    "plant-25": "125-150 cm C10",
    "plant-26": "150-175 cm cont.",
    "plant-27": "10-12HO DR",
    "plant-28": "10-12HO drkl",
    "plant-29": "10-12HO drkluit",
    "plant-30": "10-12HO draadkluit",
    "plant-31": "10-12HO draadkluit leivorm",
};

const CARD_GROUP_BADGES_BY_GROUP: Record<
    Exclude<PlantGroupKey, "zoek-zelf">,
    string[]
> = {
    "bodembedekkers": ["Vaste plant", "Bodembedekker"],
    "vaste-planten": ["Vaste plant"],
    "heesters-struiken": ["Heesters & struiken"],
    "bomen": ["Bomen"],
};

const SEARCH_META_BY_GROUP: Record<
    Exclude<PlantGroupKey, "zoek-zelf">,
    Pick<DummyPlantSearchCardData, "kleuren" | "standplaatsen" | "grondsoorten" | "bloeiperiodes">
> = {
    "bodembedekkers": {
        kleuren: ["Wit", "Groen"],
        standplaatsen: ["Zon", "Halfschaduw"],
        grondsoorten: ["Zandgrond", "Lichte klei", "Neutrale grond"],
        bloeiperiodes: ["mrt - mei", "juni - aug"],
    },
    "vaste-planten": {
        kleuren: ["Paars", "Roze", "Wit"],
        standplaatsen: ["Zon", "Halfschaduw"],
        grondsoorten: ["Goede tuingrond", "Humusrijke grond", "Neutrale grond"],
        bloeiperiodes: ["juni - aug", "sept - nov"],
    },
    "heesters-struiken": {
        kleuren: ["Wit", "Roze"],
        standplaatsen: ["Zon", "Halfschaduw"],
        grondsoorten: ["Goede tuingrond", "Humusrijke grond", "Klei"],
        bloeiperiodes: ["mrt - mei", "juni - aug"],
    },
    "bomen": {
        kleuren: ["Wit", "Geel"],
        standplaatsen: ["Zon"],
        grondsoorten: ["Zandgrond", "Klei", "Leemgrond"],
        bloeiperiodes: ["mrt - mei"],
    },
};

export function getDummyPlantSizeOptionsForPlant(_plant: DummyPlant) {
    return DUMMY_PLANT_SIZE_OPTIONS;
}

export function getDummyPlantSpecificationsForPlant(_plant: DummyPlant) {
    return DUMMY_PLANT_SPECIFICATIONS;
}

export function getDummyPlantSearchCardDataForPlant(
    plant: DummyPlant
): DummyPlantSearchCardData {
    const metaByGroup = SEARCH_META_BY_GROUP[plant.group];

    return {
        botanicalName: plant.name,
        dutchName: plant.latinName,
        sizeLabel: SIZE_LABEL_BY_PLANT_ID[plant.id] ?? "15-20 cm C1",
        stockLabel: plant.stockLabel,
        plantGroupBadges: CARD_GROUP_BADGES_BY_GROUP[plant.group],
        isInheems: INHEEMS_PLANT_IDS.has(plant.id),
        kleuren: metaByGroup.kleuren,
        standplaatsen: metaByGroup.standplaatsen,
        grondsoorten: metaByGroup.grondsoorten,
        bloeiperiodes: metaByGroup.bloeiperiodes,
    };
}

export const GROUP_OPTIONS: Array<{
    key: PlantGroupKey;
    label: string;
    variant?: "primary" | "secondary" | "search";
}> = [
        { key: "bodembedekkers", label: "Bodembedekkers", variant: "primary" },
        { key: "vaste-planten", label: "Vaste planten", variant: "secondary" },
        { key: "heesters-struiken", label: "Heesters & struiken", variant: "secondary" },
        { key: "bomen", label: "Bomen", variant: "secondary" },
        { key: "zoek-zelf", label: "Zoek zelf een plant", variant: "search" },
    ];

export const GROUP_LABELS: Record<PlantGroupKey, string> = {
    "bodembedekkers": "Bodembedekkers",
    "vaste-planten": "Vaste planten",
    "heesters-struiken": "Heesters & struiken",
    bomen: "Bomen",
    "zoek-zelf": "Zoek zelf een plant",
};

export const DUMMY_PLANTS: DummyPlant[] = [
    {
        id: "plant-1",
        group: "bodembedekkers",
        name: "Vinca minor 'Alba'",
        latinName: "Maagdenpalm",
        badge: "Zeer geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.89,
        imageSrc: "/images/plantenfotos/vinca_minor_alba.jpg",
    },
    {
        id: "plant-2",
        group: "bodembedekkers",
        name: "Pachysandra terminalis 'Green Carpet'",
        latinName: "Schaduwkruid",
        badge: "Geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 2.25,
        imageSrc: "/images/plantenfotos/pachysandra_terminalis_green_carpet.jpg",
    },
    {
        id: "plant-3",
        group: "bodembedekkers",
        name: "Geranium macrorrhizum",
        latinName: "Ooievaarsbek",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.19,
        imageSrc: "/images/plantenfotos/geranium_macrorrhizum.jpg",
    },
    {
        id: "plant-4",
        group: "bodembedekkers",
        name: "Ajuga reptans",
        latinName: "Kruipend zenegroen",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.45,
        imageSrc: "/images/plantenfotos/ajuga_reptans.jpg",
    },
    {
        id: "plant-5",
        group: "bodembedekkers",
        name: "Waldsteinia ternata",
        latinName: "Goudaardbei",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.65,
        imageSrc: "/images/plantenfotos/waldsteinia_ternata.jpg",
    },
    {
        id: "plant-6",
        group: "bodembedekkers",
        name: "Cotoneaster dammeri",
        latinName: "Dwergmispel",
        badge: "Goede aanvulling",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 2.95,
        imageSrc: "/images/plantenfotos/cotoneaster_dammeri.jpg",
    },
    {
        id: "plant-7",
        group: "bodembedekkers",
        name: "Epimedium perralchicum",
        latinName: "Elfenbloem",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 2.35,
        imageSrc: "/images/plantenfotos/epimedium_perralchicum.jpg",
    },
    {
        id: "plant-8",
        group: "bodembedekkers",
        name: "Lysimachia nummularia",
        latinName: "Penningkruid",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.25,
        imageSrc: "/images/plantenfotos/lysimachia_nummularia.jpg",
    },
    {
        id: "plant-9",
        group: "bodembedekkers",
        name: "Thymus serpyllum",
        latinName: "Kruiptijm",
        badge: "Zeer geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.39,
        imageSrc: "/images/plantenfotos/thymus_serpyllum.jpg",
    },
    {
        id: "plant-10",
        group: "bodembedekkers",
        name: "Sedum spurium",
        latinName: "Vetkruid",
        badge: "Geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 1.29,
        imageSrc: "/images/plantenfotos/sedum_spurium.jpg",
    },

    {
        id: "plant-11",
        group: "bodembedekkers",
        name: "Lamium maculatum",
        latinName: "Gevlekte dovenetel",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.55,
        imageSrc: "/images/plantenfotos/lamium_maculatum.jpg",
    },
    {
        id: "plant-12",
        group: "bodembedekkers",
        name: "Alchemilla mollis",
        latinName: "Vrouwenmantel",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.49,
        imageSrc: "/images/plantenfotos/alchemilla_mollis.jpg",
    },
    {
        id: "plant-13",
        group: "vaste-planten",
        name: "Salvia nemorosa",
        latinName: "Bossalie",
        badge: "Zeer geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.79,
        imageSrc: "/images/plantenfotos/salvia_nemorosa.jpg",
    },
    {
        id: "plant-14",
        group: "vaste-planten",
        name: "Echinacea purpurea",
        latinName: "Zonnehoed",
        badge: "Geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 2.15,
        imageSrc: "/images/plantenfotos/echinacea_purpurea.jpg",
    },
    {
        id: "plant-15",
        group: "vaste-planten",
        name: "Lavandula angustifolia",
        latinName: "Lavendel",
        badge: "Zeer geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.95,
        imageSrc: "/images/plantenfotos/lavandula_angustifolia.jpg",
    },
    {
        id: "plant-16",
        group: "vaste-planten",
        name: "Rudbeckia fulgida",
        latinName: "Zonnehoed (gele)",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.85,
        imageSrc: "/images/plantenfotos/rudbeckia_fulgida.jpg",
    },
    {
        id: "plant-17",
        group: "vaste-planten",
        name: "Geranium sanguineum",
        latinName: "Bloedooievaarsbek",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.69,
        imageSrc: "/images/plantenfotos/geranium_sanguineum.jpg",
    },
    {
        id: "plant-18",
        group: "vaste-planten",
        name: "Nepeta faassenii",
        latinName: "Kattenkruid",
        badge: "Geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 1.75,
        imageSrc: "/images/plantenfotos/nepeta_faassenii.jpg",
    },
    {
        id: "plant-19",
        group: "vaste-planten",
        name: "Helleborus orientalis",
        latinName: "Kerstroos",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 3.95,
        imageSrc: "/images/plantenfotos/helleborus_orientalis.jpg",
    },
    {
        id: "plant-20",
        group: "vaste-planten",
        name: "Heuchera micrantha",
        latinName: "Purperklokje",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 2.45,
        imageSrc: "/images/plantenfotos/heuchera_micrantha.jpg",
    },
    {
        id: "plant-21",
        group: "vaste-planten",
        name: "Phlox paniculata",
        latinName: "Vlambloem",
        badge: "Geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 2.25,
        imageSrc: "/images/plantenfotos/phlox_paniculata.jpg",
    },
    {
        id: "plant-22",
        group: "vaste-planten",
        name: "Astilbe chinensis",
        latinName: "Pluimspirea",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.95,
        imageSrc: "/images/plantenfotos/astilbe_chinensis.jpg",
    },
    {
        id: "plant-23",
        group: "vaste-planten",
        name: "Campanula poscharskyana",
        latinName: "Klokjesbloem",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.59,
        imageSrc: "/images/plantenfotos/campanula_poscharskyana.jpg",
    },
    {
        id: "plant-24",
        group: "vaste-planten",
        name: "Achillea millefolium",
        latinName: "Duizendblad",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 1.49,
        imageSrc: "/images/plantenfotos/achillea_millefolium.jpg",
    },
    {
        id: "plant-25",
        group: "heesters-struiken",
        name: "Hydrangea macrophylla",
        latinName: "Hortensia",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 4.25,
        imageSrc: "/images/plantenfotos/hydrangea_macrophylla.jpg",
    },
    {
        id: "plant-26",
        group: "heesters-struiken",
        name: "Cornus alba",
        latinName: "Rode kornoelje",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 5.95,
        imageSrc: "/images/plantenfotos/cornus_alba.jpg",
    },
    {
        id: "plant-27",
        group: "bomen",
        name: "Acer campestre",
        latinName: "Veldesdoorn",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 42.50,
        imageSrc: "/images/plantenfotos/acer_campestre.jpg",
    },
    {
        id: "plant-28",
        group: "bomen",
        name: "Amelanchier lamarckii",
        latinName: "Krentenboompje",
        badge: "Zeer geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 54.95,
        imageSrc: "/images/plantenfotos/amelanchier_lamarckii.jpg",
    },
    {
        id: "plant-29",
        group: "bomen",
        name: "Carpinus betulus",
        latinName: "Haagbeuk",
        badge: "Geschikt",
        stockLabel: "Op voorraad",
        pricePerPiece: 39.95,
        imageSrc: "/images/plantenfotos/carpinus_betulus.jpg",
    },
    {
        id: "plant-30",
        group: "bomen",
        name: "Betula pendula",
        latinName: "Ruwe berk",
        badge: "Goede aanvulling",
        stockLabel: "Op voorraad",
        pricePerPiece: 46.50,
        imageSrc: "/images/plantenfotos/betula_pendula.jpg",
    },
    {
        id: "plant-31",
        group: "bomen",
        name: "Prunus avium",
        latinName: "Zoete kers",
        badge: "Geschikt",
        stockLabel: "Binnen een week leverbaar",
        pricePerPiece: 52.50,
        imageSrc: "/images/plantenfotos/prunus_avium.jpg",
    },
];