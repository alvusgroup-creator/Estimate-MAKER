/**
 * Starter catalog offered during onboarding so the first estimate takes minutes, not an hour.
 * Prices are placeholders the contractor edits — never presented as market rates.
 */
export type CatalogPreset = {
  name: string;
  description?: string;
  category: string;
  unit: "HOUR" | "DAY" | "SQFT" | "LINEAR_FT" | "EACH" | "FLAT" | "CUBIC_YD" | "GALLON";
  unitPrice: number;
  taxable?: boolean;
  isMaterial?: boolean;
};

export const GENERAL_CONTRACTOR_PRESETS: CatalogPreset[] = [
  // Labor
  { name: "General Labor", description: "Skilled labor, per hour, per worker", category: "Labor", unit: "HOUR", unitPrice: 65, taxable: false },
  { name: "Demolition & Haul-Away", description: "Removal of existing materials and disposal", category: "Labor", unit: "HOUR", unitPrice: 75, taxable: false },
  { name: "Site Prep & Protection", description: "Floor/furniture protection, masking, dust control", category: "Labor", unit: "FLAT", unitPrice: 150, taxable: false },
  { name: "Final Cleanup", description: "Debris removal and broom-clean of work area", category: "Labor", unit: "FLAT", unitPrice: 125, taxable: false },
  // Painting
  { name: "Interior Painting — Walls", description: "Two coats premium paint, patch & prep included", category: "Painting", unit: "SQFT", unitPrice: 2.5 },
  { name: "Interior Painting — Ceilings", description: "Two coats flat ceiling paint", category: "Painting", unit: "SQFT", unitPrice: 2.0 },
  { name: "Exterior Painting", description: "Pressure wash, scrape, prime, two coats", category: "Painting", unit: "SQFT", unitPrice: 3.5 },
  { name: "Trim & Baseboard Painting", category: "Painting", unit: "LINEAR_FT", unitPrice: 3.0 },
  // Drywall / Carpentry
  { name: "Drywall Install & Finish", description: "Hang, tape, three-coat finish, ready for paint", category: "Drywall", unit: "SQFT", unitPrice: 3.25 },
  { name: "Drywall Repair (patch)", category: "Drywall", unit: "EACH", unitPrice: 175 },
  { name: "Baseboard Install", description: "Material + install, painted or stained", category: "Carpentry", unit: "LINEAR_FT", unitPrice: 8 },
  { name: "Interior Door Install", description: "Pre-hung door, hardware not included", category: "Carpentry", unit: "EACH", unitPrice: 350 },
  // Flooring
  { name: "LVP Flooring Install", description: "Luxury vinyl plank, underlayment included", category: "Flooring", unit: "SQFT", unitPrice: 4.5 },
  { name: "Tile Install", description: "Floor tile, thinset and grout included", category: "Flooring", unit: "SQFT", unitPrice: 12 },
  // Exterior
  { name: "Fence Install — Wood Privacy", description: "6 ft pressure-treated, posts set in concrete", category: "Exterior", unit: "LINEAR_FT", unitPrice: 42 },
  { name: "Deck Build", description: "Pressure-treated framing, composite decking", category: "Exterior", unit: "SQFT", unitPrice: 55 },
  { name: "Pressure Washing", category: "Exterior", unit: "SQFT", unitPrice: 0.35 },
  { name: "Gutter Cleaning", category: "Exterior", unit: "LINEAR_FT", unitPrice: 1.5 },
  // Landscaping
  { name: "Lawn Mowing & Edging", category: "Landscaping", unit: "FLAT", unitPrice: 60 },
  { name: "Mulch Install", description: "Material + spread, 3 in depth", category: "Landscaping", unit: "CUBIC_YD", unitPrice: 95, isMaterial: true },
  { name: "Sod Install", category: "Landscaping", unit: "SQFT", unitPrice: 2.25 },
  // Materials / misc
  { name: "Materials", description: "Materials at cost + markup, receipts available", category: "Materials", unit: "EACH", unitPrice: 0, isMaterial: true },
  { name: "Dumpster Rental", category: "Materials", unit: "EACH", unitPrice: 450, isMaterial: true },
  { name: "Permit Fee", description: "Pass-through municipal permit cost", category: "Fees", unit: "EACH", unitPrice: 0, taxable: false },
  { name: "Service Call / Trip Charge", category: "Fees", unit: "FLAT", unitPrice: 95, taxable: false },
];

export const DEFAULT_TERMS = `This estimate is valid for 30 days from the date above.
A deposit is due upon acceptance to schedule the work; balance is due upon completion.
Pricing is based on the scope described. Any changes or unforeseen conditions (hidden damage, code requirements, material price changes) will be quoted as a change order before proceeding.
All work is performed in a professional manner according to standard practices and includes cleanup of the work area.`;
