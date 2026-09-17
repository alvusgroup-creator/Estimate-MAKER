/**
 * Construction trades offered at onboarding. The pick is stored on the org (`trade`) and decides
 * which starter catalog categories the contractor gets — a painter shouldn't wade through fence prices.
 */
import { GENERAL_CONTRACTOR_PRESETS, type CatalogPreset } from "./catalog-presets";

export type Trade = { id: string; label: string; categories: string[] | "all" };

const BASE = ["Labor", "Materials", "Fees"];

export const TRADES: Trade[] = [
  { id: "general_contractor", label: "General contractor", categories: "all" },
  { id: "remodeling", label: "Remodeling", categories: "all" },
  { id: "handyman", label: "Handyman", categories: "all" },
  { id: "carpentry", label: "Carpentry", categories: [...BASE, "Carpentry", "Drywall"] },
  { id: "concrete_masonry", label: "Concrete & masonry", categories: BASE },
  { id: "decks_fences", label: "Decks & fences", categories: [...BASE, "Exterior"] },
  { id: "demolition", label: "Demolition", categories: BASE },
  { id: "drywall", label: "Drywall", categories: [...BASE, "Drywall", "Painting"] },
  { id: "electrical", label: "Electrical", categories: BASE },
  { id: "flooring", label: "Flooring", categories: [...BASE, "Flooring"] },
  { id: "framing", label: "Framing", categories: [...BASE, "Carpentry"] },
  { id: "hvac", label: "HVAC", categories: BASE },
  { id: "landscaping", label: "Landscaping", categories: [...BASE, "Landscaping", "Exterior"] },
  { id: "painting", label: "Painting", categories: [...BASE, "Painting", "Drywall"] },
  { id: "plumbing", label: "Plumbing", categories: BASE },
  { id: "pressure_washing", label: "Pressure washing", categories: [...BASE, "Exterior"] },
  { id: "roofing", label: "Roofing", categories: BASE },
  { id: "siding", label: "Siding", categories: [...BASE, "Exterior"] },
  { id: "tile", label: "Tile", categories: [...BASE, "Flooring"] },
  { id: "windows_doors", label: "Windows & doors", categories: [...BASE, "Carpentry"] },
];

export const tradeById = (id: string | null | undefined) => TRADES.find((t) => t.id === id) ?? null;

/** Starter catalog for a trade; unknown/missing trade gets the full general-contractor set. */
export function presetsForTrade(id: string | null | undefined): CatalogPreset[] {
  const t = tradeById(id);
  if (!t || t.categories === "all") return GENERAL_CONTRACTOR_PRESETS;
  const cats = t.categories;
  return GENERAL_CONTRACTOR_PRESETS.filter((p) => cats.includes(p.category));
}
