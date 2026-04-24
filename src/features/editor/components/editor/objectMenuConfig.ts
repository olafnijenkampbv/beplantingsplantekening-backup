export type TreebedVariant =
    | "standard"
    | "multi_stem"
    | "espalier"
    | "roof";

export type GeometryKind = "polygon" | "polyline";

export type ObjectMenuSectionId =
    | "ondergrond"
    | "gebouwen"
    | "afbakening"
    | "beplanting"
    | "verkeer-gebruik"
    | "randen";

export type ObjectMenuLocationType =
    | "tuin"
    | "border-plantvak"
    | "bedrijfsterrein"
    | "openbare-ruimte"
    | "park-groenvoorziening"
    | "erf-landschap";

export type ViewVisibilityGroup =
    | "showGround"
    | "showBuildings"
    | "showBoundaries"
    | "showPlantbeds"
    | "showTreebeds";

type ObjectDefinition = {
    label: string;
    geometry: GeometryKind;
    fill: string;
    stroke: string;
    zIndex: number;
    visibilityGroup: ViewVisibilityGroup;
    isBuilding?: boolean;
    isBoundary?: boolean;
    isAreaMeasurable?: boolean;
};

export const OBJECT_LIBRARY = {
    grass: {
        label: "Gras",
        geometry: "polygon",
        fill: "#DCE9DC",
        stroke: "#4F6B4F",
        zIndex: 1,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    sand: {
        label: "Zand",
        geometry: "polygon",
        fill: "#F3E2A4",
        stroke: "#C2A44A",
        zIndex: 2,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    gravel: {
        label: "Grind",
        geometry: "polygon",
        fill: "#CFC6B6",
        stroke: "#9C8F7A",
        zIndex: 3,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    tiles: {
        label: "Tegels/bestrating",
        geometry: "polygon",
        fill: "#E6E6E6",
        stroke: "#8A8A8A",
        zIndex: 4,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    water: {
        label: "Water",
        geometry: "polygon",
        fill: "#DCEAF4",
        stroke: "#5C89A6",
        zIndex: 5,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    wood: {
        label: "Hout",
        geometry: "polygon",
        fill: "#C9A27A",
        stroke: "#8B5E3C",
        zIndex: 6,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    patio: {
        label: "Terras",
        geometry: "polygon",
        fill: "#E2D4C2",
        stroke: "#B8A48C",
        zIndex: 7,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    asphalt: {
        label: "Asfalt",
        geometry: "polygon",
        fill: "#6E6E6E",
        stroke: "#4B4B4B",
        zIndex: 8,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    concrete: {
        label: "Beton",
        geometry: "polygon",
        fill: "#CFCFCF",
        stroke: "#8F8F8F",
        zIndex: 9,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    parking: {
        label: "Parkeerplaatsen",
        geometry: "polygon",
        fill: "#B8BDC4",
        stroke: "#6B7280",
        zIndex: 10,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },

    road: {
        label: "Rijbaan / weg",
        geometry: "polygon",
        fill: "#6E6E6E",
        stroke: "#4B4B4B",
        zIndex: 11,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    bike_path: {
        label: "Fietspad",
        geometry: "polygon",
        fill: "#C46E6E",
        stroke: "#7C4747",
        zIndex: 12,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    footpath: {
        label: "Voetpad",
        geometry: "polygon",
        fill: "#CFC6B6",
        stroke: "#9C8F7A",
        zIndex: 13,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    sidewalk: {
        label: "Stoep",
        geometry: "polygon",
        fill: "#E6E6E6",
        stroke: "#8A8A8A",
        zIndex: 14,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },
    walking_path: {
        label: "Wandelpad",
        geometry: "polygon",
        fill: "#E2D4C2",
        stroke: "#B8A48C",
        zIndex: 15,
        visibilityGroup: "showGround",
        isAreaMeasurable: true,
    },

    border_edge: {
        label: "Borderrand",
        geometry: "polyline",
        fill: "#E9DED2",
        stroke: "#8C6A4A",
        zIndex: 20,
        visibilityGroup: "showBoundaries",
        isBoundary: true,
        isAreaMeasurable: true,
    },
    curb: {
        label: "Opsluitband",
        geometry: "polyline",
        fill: "#D8D8D8",
        stroke: "#7E7E7E",
        zIndex: 21,
        visibilityGroup: "showBoundaries",
        isBoundary: true,
        isAreaMeasurable: true,
    },
    wall: {
        label: "Muur",
        geometry: "polyline",
        fill: "#B7AAA0",
        stroke: "#6E625A",
        zIndex: 22,
        visibilityGroup: "showGround",
        isBoundary: true,
        isAreaMeasurable: true,
    },
    bridge: {
        label: "Brug",
        geometry: "polygon",
        fill: "#BFA58A",
        stroke: "#7A5A3D",
        zIndex: 23,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    play_equipment: {
        label: "Speeltoestel",
        geometry: "polygon",
        fill: "#F4C46A",
        stroke: "#B7791F",
        zIndex: 24,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    bollards: {
        label: "Paaltjes",
        geometry: "polyline",
        fill: "#D8BB96",
        stroke: "#A89173",
        zIndex: 25,
        visibilityGroup: "showBoundaries",
        isBoundary: true,
        isAreaMeasurable: true,
    },

    plantbed: {
        label: "Plantvak",
        geometry: "polygon",
        fill: "#F2FDEF",
        stroke: "#3F6B3F",
        zIndex: 30,
        visibilityGroup: "showPlantbeds",
        isAreaMeasurable: true,
    },

    hedge: {
        label: "Haag",
        geometry: "polygon",
        fill: "#95CE86",
        stroke: "#56793E",
        zIndex: 30,
        visibilityGroup: "showPlantbeds",
        isAreaMeasurable: true,
    },
    treebed: {
        label: "Boomvak",
        geometry: "polygon",
        fill: "#008000",
        stroke: "#008000",
        zIndex: 31,
        visibilityGroup: "showTreebeds",
        isAreaMeasurable: true,
    },

    generic_building: {
        label: "Gebouw (algemeen)",
        geometry: "polygon",
        fill: "#D9A08F",
        stroke: "#8C3A2F",
        zIndex: 40,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    office_building: {
        label: "Kantoorpand",
        geometry: "polygon",
        fill: "#D6DADF",
        stroke: "#8A949E",
        zIndex: 41,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    warehouse: {
        label: "Loods / hal",
        geometry: "polygon",
        fill: "#C2C7CC",
        stroke: "#6F7882",
        zIndex: 42,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    storage: {
        label: "Opslag / magazijn",
        geometry: "polygon",
        fill: "#B4B8BD",
        stroke: "#5F666E",
        zIndex: 43,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    woonblok: {
        label: "Woonblok",
        geometry: "polygon",
        fill: "#D7A89A",
        stroke: "#8B5A4E",
        zIndex: 44,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    house: {
        label: "Woning",
        geometry: "polygon",
        fill: "#D9A08F",
        stroke: "#8C3A2F",
        zIndex: 45,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    garage: {
        label: "Garage",
        geometry: "polygon",
        fill: "#C88F80",
        stroke: "#7C3A33",
        zIndex: 46,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    shed: {
        label: "Schuur",
        geometry: "polygon",
        fill: "#A87867",
        stroke: "#4A2B24",
        zIndex: 47,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    garden_house: {
        label: "Tuinhuis",
        geometry: "polygon",
        fill: "#D7C19A",
        stroke: "#6B4E2E",
        zIndex: 48,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    carport: {
        label: "Carport",
        geometry: "polygon",
        fill: "#D8D8D8",
        stroke: "#6F6F6F",
        zIndex: 49,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    veranda: {
        label: "Veranda",
        geometry: "polygon",
        fill: "#E7C6BA",
        stroke: "#8C5A45",
        zIndex: 50,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },
    canopy: {
        label: "Overkapping",
        geometry: "polygon",
        fill: "#EFE3DC",
        stroke: "#7A6A5A",
        zIndex: 51,
        visibilityGroup: "showBuildings",
        isBuilding: true,
        isAreaMeasurable: true,
    },

    fence: {
        label: "Schutting",
        geometry: "polyline",
        fill: "#A89173",
        stroke: "#8D6819",
        zIndex: 60,
        visibilityGroup: "showBoundaries",
        isBoundary: true,
        isAreaMeasurable: true,
    },
    gate: {
        label: "Hek",
        geometry: "polyline",
        fill: "#D8BB96",
        stroke: "#A89173",
        zIndex: 61,
        visibilityGroup: "showBoundaries",
        isBoundary: true,
        isAreaMeasurable: true,
    },
    poort: {
        label: "Poort / toegangshek",
        geometry: "polyline",
        fill: "#D8BB96",
        stroke: "#8E6D4E",
        zIndex: 62,
        visibilityGroup: "showBoundaries",
        isBoundary: true,
        isAreaMeasurable: true,
    },
} as const satisfies Record<string, ObjectDefinition>;

export type ObjectType = keyof typeof OBJECT_LIBRARY;

export type ObjectMenuItem = {
    id: ObjectType;
    label: string;
};

export type ObjectMenuSection = {
    id: ObjectMenuSectionId;
    label: string;
    items: ObjectMenuItem[];
};

type ObjectMenuConfigByLocation = Record<ObjectMenuLocationType, ObjectMenuSection[]>;

export const TREEBED_VARIANTS: Array<{ key: TreebedVariant; label: string }> = [
    { key: "standard", label: "Standaard" },
    { key: "multi_stem", label: "Meerstammig" },
    { key: "espalier", label: "Leivorm" },
    { key: "roof", label: "Dakvorm" },
];

export const OBJECT_STYLES: Record<ObjectType, { fill: string; stroke: string }> = Object.fromEntries(
    Object.entries(OBJECT_LIBRARY).map(([key, value]) => [
        key,
        { fill: value.fill, stroke: value.stroke },
    ])
) as Record<ObjectType, { fill: string; stroke: string }>;

export const TYPE_Z_INDEX: Record<ObjectType, number> = Object.fromEntries(
    Object.entries(OBJECT_LIBRARY).map(([key, value]) => [key, value.zIndex])
) as Record<ObjectType, number>;

export const OBJECT_LABELS: Record<ObjectType, string> = Object.fromEntries(
    Object.entries(OBJECT_LIBRARY).map(([key, value]) => [key, value.label])
) as Record<ObjectType, string>;

export const LINE_OBJECT_TYPES = Object.keys(OBJECT_LIBRARY).filter(
    (key) => OBJECT_LIBRARY[key as ObjectType].geometry === "polyline"
) as ObjectType[];

function getObjectDefinition(type: ObjectType): ObjectDefinition {
    return OBJECT_LIBRARY[type] as ObjectDefinition;
}

export const BUILDING_OBJECT_TYPES = (Object.keys(OBJECT_LIBRARY) as ObjectType[]).filter(
    (type) => !!getObjectDefinition(type).isBuilding
);

export const BOUNDARY_OBJECT_TYPES = (Object.keys(OBJECT_LIBRARY) as ObjectType[]).filter(
    (type) => !!getObjectDefinition(type).isBoundary
);

export const AREA_MEASURABLE_OBJECT_TYPES = (Object.keys(OBJECT_LIBRARY) as ObjectType[]).filter(
    (type) => {
        const definition = getObjectDefinition(type);
        return !!definition.isAreaMeasurable || !!definition.isBoundary;
    }
);

const OBJECT_MENU_CONFIG: ObjectMenuConfigByLocation = {
    tuin: [
        {
            id: "beplanting",
            label: "Beplanting",
            items: [
                { id: "plantbed", label: "Plantvak" },
                { id: "hedge", label: "Haag" },
                { id: "treebed", label: "Boomvak" },
            ],
        },
        {
            id: "ondergrond",
            label: "Ondergrond",
            items: [
                { id: "grass", label: "Gras" },
                { id: "tiles", label: "Tegels/bestrating" },
                { id: "water", label: "Water (vijver)" },
                { id: "gravel", label: "Grind" },
                { id: "sand", label: "Zand" },
                { id: "wood", label: "Hout" },
                { id: "patio", label: "Terras" },
            ],
        },
        {
            id: "gebouwen",
            label: "Gebouwen",
            items: [
                { id: "house", label: "Woning" },
                { id: "garage", label: "Garage" },
                { id: "shed", label: "Schuur" },
                { id: "garden_house", label: "Tuinhuis" },
                { id: "carport", label: "Carport" },
                { id: "veranda", label: "Veranda" },
                { id: "canopy", label: "Overkapping" },
            ],
        },
        {
            id: "afbakening",
            label: "Afbakening",
            items: [
                { id: "fence", label: "Schutting" },
                { id: "gate", label: "Hek" },
            ],
        },
    ],

    "border-plantvak": [
        {
            id: "beplanting",
            label: "Beplanting",
            items: [
                { id: "plantbed", label: "Plantvak" },
                { id: "hedge", label: "Haag" },
                { id: "treebed", label: "Boomvak" },
            ],
        },
        {
            id: "ondergrond",
            label: "Ondergrond",
            items: [
                { id: "grass", label: "Gras" },
                { id: "tiles", label: "Tegels/bestrating" },
                { id: "water", label: "Water (vijver)" },
                { id: "gravel", label: "Grind" },
                { id: "sand", label: "Zand" },
                { id: "wood", label: "Hout" },
            ],
        },
        {
            id: "randen",
            label: "Randen",
            items: [
                { id: "border_edge", label: "Borderrand" },
                { id: "wall", label: "Muur" },
                { id: "curb", label: "Opsluitband" },
            ],
        },
        {
            id: "afbakening",
            label: "Afbakening",
            items: [
                { id: "fence", label: "Schutting" },
                { id: "gate", label: "Hek" },
            ],
        },
    ],

    bedrijfsterrein: [
        {
            id: "beplanting",
            label: "Beplanting",
            items: [
                { id: "plantbed", label: "Plantvak" },
                { id: "hedge", label: "Haag" },
                { id: "treebed", label: "Boomvak" },
            ],
        },
        {
            id: "ondergrond",
            label: "Ondergrond",
            items: [
                { id: "grass", label: "Gras" },
                { id: "tiles", label: "Tegels/bestrating" },
                { id: "asphalt", label: "Asfalt" },
                { id: "concrete", label: "Beton" },
                { id: "gravel", label: "Grind" },
                { id: "sand", label: "Zand" },
                { id: "water", label: "Water" },
            ],
        },
        {
            id: "verkeer-gebruik",
            label: "Verkeer & gebruik",
            items: [
                { id: "parking", label: "Parkeerplaatsen" },
                { id: "road", label: "Rijbaan / weg" },
            ],
        },
        {
            id: "gebouwen",
            label: "Gebouwen",
            items: [
                { id: "office_building", label: "Kantoorpand" },
                { id: "warehouse", label: "Loods / hal" },
                { id: "storage", label: "Opslag / magazijn" },
                { id: "canopy", label: "Overkapping" },
                { id: "shed", label: "Schuur" },
            ],
        },
        {
            id: "afbakening",
            label: "Afbakening",
            items: [
                { id: "fence", label: "Schutting" },
                { id: "gate", label: "Hek" },
                { id: "poort", label: "Poort / toegangshek" },
            ],
        },
    ],

    "openbare-ruimte": [
        {
            id: "beplanting",
            label: "Beplanting",
            items: [
                { id: "plantbed", label: "Plantvak" },
                { id: "hedge", label: "Haag" },
                { id: "treebed", label: "Boomvak" },
            ],
        },
        {
            id: "ondergrond",
            label: "Ondergrond",
            items: [
                { id: "grass", label: "Gras" },
                { id: "tiles", label: "Tegels/bestrating" },
                { id: "asphalt", label: "Asfalt" },
                { id: "concrete", label: "Beton" },
                { id: "gravel", label: "Grind" },
                { id: "sand", label: "Zand" },
                { id: "water", label: "Water" },
            ],
        },
        {
            id: "gebouwen",
            label: "Gebouwen",
            items: [
                { id: "generic_building", label: "Gebouw (algemeen)" },
                { id: "woonblok", label: "Woonblok" },
                { id: "canopy", label: "Overkapping" },
            ],
        },
        {
            id: "verkeer-gebruik",
            label: "Verkeer & gebruik",
            items: [
                { id: "road", label: "Rijbaan / weg" },
                { id: "bike_path", label: "Fietspad" },
                { id: "footpath", label: "Voetpad" },
                { id: "sidewalk", label: "Stoep" },
                { id: "parking", label: "Parkeerplaatsen" },
            ],
        },
        {
            id: "afbakening",
            label: "Afbakening",
            items: [
                { id: "gate", label: "Hek" },
                { id: "bollards", label: "Paaltjes" },
            ],
        },
    ],

    "park-groenvoorziening": [
        {
            id: "beplanting",
            label: "Beplanting",
            items: [
                { id: "plantbed", label: "Plantvak" },
                { id: "hedge", label: "Haag" },
                { id: "treebed", label: "Boomvak" },
            ],
        },
        {
            id: "ondergrond",
            label: "Ondergrond",
            items: [
                { id: "grass", label: "Gras" },
                { id: "tiles", label: "Tegels/bestrating" },
                { id: "gravel", label: "Grind" },
                { id: "sand", label: "Zand" },
                { id: "water", label: "Water" },
            ],
        },
        {
            id: "gebouwen",
            label: "Gebouwen",
            items: [
                { id: "generic_building", label: "Gebouw (algemeen)" },
                { id: "bridge", label: "Brug" },
                { id: "play_equipment", label: "Speeltoestel" },
                { id: "canopy", label: "Overkapping" },
            ],
        },
        {
            id: "verkeer-gebruik",
            label: "Verkeer & gebruik",
            items: [
                { id: "road", label: "Rijbaan / weg" },
                { id: "bike_path", label: "Fietspad" },
                { id: "walking_path", label: "Wandelpad" },
                { id: "sidewalk", label: "Stoep" },
            ],
        },
        {
            id: "afbakening",
            label: "Afbakening",
            items: [
                { id: "gate", label: "Hek" },
                { id: "bollards", label: "Paaltjes" },
            ],
        },
    ],

    "erf-landschap": [
        {
            id: "beplanting",
            label: "Beplanting",
            items: [
                { id: "plantbed", label: "Plantvak" },
                { id: "hedge", label: "Haag" },
                { id: "treebed", label: "Boomvak" },
            ],
        },
        {
            id: "ondergrond",
            label: "Ondergrond",
            items: [
                { id: "grass", label: "Gras / weide" },
                { id: "tiles", label: "Tegels/bestrating" },
                { id: "gravel", label: "Grind" },
                { id: "sand", label: "Zand" },
                { id: "water", label: "Water (vijver)" },
                { id: "asphalt", label: "Asfalt" },
            ],
        },
        {
            id: "gebouwen",
            label: "Gebouwen",
            items: [
                { id: "house", label: "Woning" },
                { id: "shed", label: "Schuur" },
                { id: "garden_house", label: "Tuinhuis" },
                { id: "canopy", label: "Overkapping" },
                { id: "carport", label: "Carport" },
            ],
        },
        {
            id: "afbakening",
            label: "Afbakening",
            items: [
                { id: "gate", label: "Hek" },
                { id: "fence", label: "Schutting" },
                { id: "poort", label: "Poort / toegangshek" },
            ],
        },
    ],
};

export function getAllObjectTypes(): ObjectType[] {
    return Object.keys(OBJECT_LIBRARY) as ObjectType[];
}

export function getObjectLabel(type: ObjectType): string {
    return getObjectDefinition(type).label;
}

export function getObjectGeometryKind(type: ObjectType): GeometryKind {
    return getObjectDefinition(type).geometry;
}

export function getObjectVisibilityGroup(type: ObjectType): ViewVisibilityGroup {
    return getObjectDefinition(type).visibilityGroup;
}

export function isBuildingObjectType(type: ObjectType): boolean {
    return !!getObjectDefinition(type).isBuilding;
}

export function isBoundaryObjectType(type: ObjectType): boolean {
    return !!getObjectDefinition(type).isBoundary;
}

export function isAreaMeasurableObjectType(type: ObjectType): boolean {
    return !!getObjectDefinition(type).isAreaMeasurable;
}

export function isLineObjectType(type: ObjectType): boolean {
    return getObjectDefinition(type).geometry === "polyline";
}
export function getObjectMenuSections(locationType: string | null | undefined): ObjectMenuSection[] {
    if (!locationType) {
        return OBJECT_MENU_CONFIG.tuin;
    }

    if (locationType in OBJECT_MENU_CONFIG) {
        return OBJECT_MENU_CONFIG[locationType as ObjectMenuLocationType];
    }

    return OBJECT_MENU_CONFIG.tuin;
}