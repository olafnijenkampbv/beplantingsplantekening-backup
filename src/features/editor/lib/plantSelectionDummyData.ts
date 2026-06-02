export type PlantGroupKey =
    | "bodembedekkers"
    | "vaste-planten"
    | "hagen"
    | "heesters-struiken"
    | "bomen"
    | "zoek-zelf"
    | "tuinmaterialen";

export type ViewMode = "grid" | "list";

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

export const EMPTY_ADVANCED_PLANT_SELECTION_FILTERS: PlantSelectionAdvancedFilters = {
    plantgroepen: [],
    kleuren: [],
    standplaatsen: [],
    grondsoorten: [],
    bloeiperiodes: [],
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
    "Januari",
    "Februari",
    "Maart",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Augustus",
    "September",
    "Oktober",
    "November",
    "December",
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

export const GROUP_OPTIONS: Array<{
    key: PlantGroupKey;
    label: string;
    variant?: "primary" | "secondary" | "search";
}> = [
    { key: "bodembedekkers",   label: "Bodembedekkers",       variant: "primary" },
    { key: "vaste-planten",    label: "Vaste planten",         variant: "secondary" },
    { key: "hagen",            label: "Hagen",                 variant: "secondary" },
    { key: "heesters-struiken",label: "Heesters & struiken",   variant: "secondary" },
    { key: "bomen",            label: "Bomen",                 variant: "secondary" },
    { key: "zoek-zelf",        label: "Zoek zelf een plant",   variant: "search" },
    { key: "tuinmaterialen",   label: "Tuinmaterialen",        variant: "secondary" },
];

export const GROUP_LABELS: Record<PlantGroupKey, string> = {
    "bodembedekkers":    "Bodembedekkers",
    "vaste-planten":     "Vaste planten",
    "hagen":             "Hagen",
    "heesters-struiken": "Heesters & struiken",
    "bomen":             "Bomen",
    "zoek-zelf":         "Zoek zelf een plant",
    "tuinmaterialen":    "Tuinmaterialen",
};
