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
    if (!item) return [];
    if (Array.isArray(item.bulkPrices) && item.bulkPrices.length > 0) {
        return item.bulkPrices;
    }

    const size = item.size?.trim();
    if (!size || size.toLowerCase() === "geen maat geselecteerd" || !Array.isArray(variants)) {
        return [];
    }

    const variant = variants.find((candidate) => candidate.sizeLabel === size);
    return Array.isArray(variant?.bulkPrices) ? variant.bulkPrices : [];
}

export function withResolvedBulkPrices<T extends PlantPricingLike>(
    item: T,
    variants: PlantVariantPricingLike[] | null | undefined
): T {
    const bulkPrices = getResolvedBulkPrices(item, variants);
    if (bulkPrices.length === 0 || item.bulkPrices === bulkPrices) {
        return item;
    }
    return {
        ...item,
        bulkPrices,
    };
}
