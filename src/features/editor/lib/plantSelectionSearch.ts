const DRAADKLUIT_ALIASES = ["dr", "drkl", "drkluit", "draadkluit"];
const CONTAINER_ALIASES = ["cont", "cont.", "container"];

export function matchesSearchQuery(value: string, query: string) {
    const normalizedValue = value.toLowerCase();
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return true;
    }

    if (normalizedValue.includes(normalizedQuery)) {
        return true;
    }

    const compactValue = normalizedValue.replace(/[\s\-_./]+/g, "");
    const compactQuery = normalizedQuery.replace(/[\s\-_./]+/g, "");

    if (compactValue.includes(compactQuery)) {
        return true;
    }

    const valueParts = normalizedValue
        .split(/[\s\-_./]+/)
        .map((part) => part.trim())
        .filter(Boolean);

    const queryParts = normalizedQuery
        .split(/[\s\-_./]+/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (queryParts.length === 0) {
        return true;
    }

    let searchIndex = 0;

    for (const part of queryParts) {
        let found = false;

        for (let i = searchIndex; i < valueParts.length; i += 1) {
            const candidate = valueParts[i];

            if (
                candidate.includes(part) ||
                part.includes(candidate) ||
                candidate.replace(/[\s\-_./]+/g, "").includes(compactQuery)
            ) {
                found = true;
                searchIndex = i + 1;
                break;
            }
        }

        if (!found) {
            return false;
        }
    }

    return true;
}

function normalizeSizeToken(value: string) {
    return value
        .toLowerCase()
        .replace(/,/g, ".")
        .replace(/\s+/g, " ")
        .trim();
}

function extractHeightToken(value: string): string | null {
    const normalized = normalizeSizeToken(value);
    const match = normalized.match(/\b\d+\s*-\s*\d+\b/);

    if (!match) {
        return null;
    }

    return match[0].replace(/\s*/g, "");
}

function extractHoToken(value: string): string | null {
    const normalized = normalizeSizeToken(value);
    const match = normalized.match(/\b\d+\s*-\s*\d+\s*ho\b/);

    if (!match) {
        return null;
    }

    return match[0].replace(/\s+/g, "");
}

function extractPotToken(value: string): string | null {
    const normalized = normalizeSizeToken(value);

    const cMatch = normalized.match(/\bc\s*(\d+(?:\.\d+)?)\b/);
    if (cMatch) {
        return `c${cMatch[1]}`;
    }

    const lMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*l\b/);
    if (lMatch) {
        return `c${lMatch[1]}`;
    }

    const pMatch = normalized.match(/\bp\s*(\d+)\b/);
    if (pMatch) {
        return `p${pMatch[1]}`;
    }

    return null;
}

function extractRootballToken(value: string): "draadkluit" | "container" | null {
    const normalized = normalizeSizeToken(value);

    const matchesAliasFamily = (aliases: string[]) =>
        aliases.some((alias) => {
            const normalizedAlias = normalizeSizeToken(alias);

            return (
                normalized.includes(normalizedAlias) ||
                normalizedAlias.includes(normalized)
            );
        });

    if (matchesAliasFamily(DRAADKLUIT_ALIASES)) {
        return "draadkluit";
    }

    if (matchesAliasFamily(CONTAINER_ALIASES)) {
        return "container";
    }

    return null;
}

export function matchesPlantSizeSearch(sizeLabel: string, query: string) {
    const normalizedQuery = normalizeSizeToken(query);

    if (!normalizedQuery) {
        return true;
    }

    const sizeText = normalizeSizeToken(sizeLabel);

    const queryHeight = extractHeightToken(normalizedQuery);
    const sizeHeight = extractHeightToken(sizeText);

    if (queryHeight && queryHeight !== sizeHeight) {
        return false;
    }

    const queryHo = extractHoToken(normalizedQuery);
    const sizeHo = extractHoToken(sizeText);

    if (queryHo && queryHo !== sizeHo) {
        return false;
    }

    const queryPot = extractPotToken(normalizedQuery);
    const sizePot = extractPotToken(sizeText);

    if (queryPot) {
        const queryPotMatch = queryPot.match(/^([a-z]+)(\d+(?:\.\d+)?)$/);
        const sizePotMatch = sizePot?.match(/^([a-z]+)(\d+(?:\.\d+)?)$/);

        if (!queryPotMatch || !sizePotMatch) {
            return false;
        }

        const queryPrefix = queryPotMatch[1];
        const sizePrefix = sizePotMatch[1];

        if (queryPrefix !== sizePrefix) {
            return false;
        }

        const queryRawNumber = queryPotMatch[2];
        const sizeRawNumber = sizePotMatch[2];

        const normalizedQueryRawNumber = queryRawNumber.replace(/\.0+$/, "");
        const normalizedSizeRawNumber = sizeRawNumber.replace(/\.0+$/, "");

        if (!normalizedSizeRawNumber.startsWith(normalizedQueryRawNumber)) {
            return false;
        }
    }

    const queryRootball = extractRootballToken(normalizedQuery);
    const sizeRootball = extractRootballToken(sizeText);

    if (queryRootball) {
        if (!sizeRootball || queryRootball !== sizeRootball) {
            return false;
        }
    }

    let strippedQuery = normalizedQuery
        .replace(/\b\d+\s*-\s*\d+\s*ho\b/g, " ")
        .replace(/\b\d+\s*-\s*\d+\b/g, " ")
        .replace(/\bc\s*\d+(?:\.\d+)?\b/g, " ")
        .replace(/\b\d+(?:\.\d+)?\s*l\b/g, " ")
        .replace(/\bp\s*\d+\b/g, " ");

    if (queryRootball === "draadkluit") {
        strippedQuery = strippedQuery
            .replace(/draadkluit|drkluit|drkl|dr/g, " ");
    }

    if (queryRootball === "container") {
        strippedQuery = strippedQuery
            .replace(/container|cont\.?|contai[a-z]*/g, " ");
    }

    strippedQuery = strippedQuery
        .replace(/\s+/g, " ")
        .trim();

    if (!strippedQuery) {
        return true;
    }

    return sizeText.includes(strippedQuery);
}