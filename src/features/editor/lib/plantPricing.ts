import type { BulkPriceTier } from "@/lib/db/plantTypes";

export type PlantPricingLike = {
    plant: {
        id?: string;
        pricePerPiece?: number | null;
    };
    size?: string;
    bulkPrices?: BulkPriceTier[] | null;
};

export type PlantVariantPricingLike = {
    sizeLabel: string;
    price?: number | null;
    bulkPrices?: BulkPriceTier[] | null;
};

function isValidPrice(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function getUnitPriceForQuantity(
    basePrice: number | null | undefined,
    bulkPrices: BulkPriceTier[] | null | undefined,
    quantity: number
): number | null {
    if (!isValidPrice(basePrice)) return null;

    const count = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
    if (count <= 0 || !Array.isArray(bulkPrices) || bulkPrices.length === 0) {
        return basePrice;
    }

    const matchingTier = [...bulkPrices]
        .filter((tier) => Number.isFinite(tier.minQty) && tier.minQty > 0 && isValidPrice(tier.price))
        .sort((a, b) => b.minQty - a.minQty)
        .find((tier) => count >= tier.minQty);

    return matchingTier?.price ?? basePrice;
}

export function getPlantUnitPriceForQuantity(
    item: PlantPricingLike | null | undefined,
    quantity: number
): number | null {
    if (!item) return null;
    return getUnitPriceForQuantity(item.plant.pricePerPiece, item.bulkPrices, quantity);
}

export function getPlantTotalPriceForQuantity(
    item: PlantPricingLike | null | undefined,
    quantity: number
): number | null {
    const unitPrice = getPlantUnitPriceForQuantity(item, quantity);
    if (unitPrice === null) return null;
    return Math.max(0, quantity) * unitPrice;
}

export function getResolvedBulkPrices(
    item: PlantPricingLike | null | undefined,
    variants: PlantVariantPricingLike[] | null | undefined
): BulkPriceTier[] {
    return getResolvedVariant(item, variants)?.bulkPrices ?? [];
}

function getResolvedVariant(
    item: PlantPricingLike | null | undefined,
    variants: PlantVariantPricingLike[] | null | undefined
): PlantVariantPricingLike | null {
    if (!item) return null;

    const size = item.size?.trim();
    if (!size || size.toLowerCase() === "geen maat geselecteerd" || !Array.isArray(variants)) {
        return null;
    }

    const variant = variants.find((candidate) => candidate.sizeLabel === size);
    return variant ?? null;
}

export function withResolvedBulkPrices<T extends PlantPricingLike>(
    item: T,
    variants: PlantVariantPricingLike[] | null | undefined
): T {
    const variant = getResolvedVariant(item, variants);
    if (!variant) {
        return item;
    }

    const bulkPrices = Array.isArray(variant.bulkPrices) ? variant.bulkPrices : [];
    const resolvedPrice = isValidPrice(variant.price) ? variant.price : item.plant.pricePerPiece;
    const hasPriceChange = resolvedPrice !== item.plant.pricePerPiece;
    const hasBulkPriceChange = item.bulkPrices !== bulkPrices;

    if (!hasPriceChange && !hasBulkPriceChange) return item;

    return {
        ...item,
        plant: {
            ...item.plant,
            pricePerPiece: resolvedPrice,
        },
        bulkPrices,
    };
}
