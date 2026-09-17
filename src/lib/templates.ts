import type { Template } from "@/generated/prisma/enums";

/** The six document layouts. Order = how they're offered in the pickers. */
export const TEMPLATES: { id: Template; label: string; description: string }[] = [
  { id: "CLEAN", label: "Clean", description: "Big title, gradient table header" },
  { id: "BOLD", label: "Bold", description: "Full-color header band" },
  { id: "CLASSIC", label: "Classic", description: "Letterhead with dark table" },
  { id: "NOIR", label: "Noir", description: "Black header, centered title" },
  { id: "MINIMAL", label: "Minimal", description: "Thin rules, no fills" },
  { id: "EXECUTIVE", label: "Executive", description: "Blue table, big balance line" },
];
