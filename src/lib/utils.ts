import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clientDisplayName(c: { firstName: string; lastName?: string | null; companyName?: string | null }) {
  const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return c.companyName ? `${c.companyName} (${person})` : person;
}

export function formatAddress(a: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}) {
  const line2 = [a.city, a.state].filter(Boolean).join(", ");
  return [a.addressLine1, a.addressLine2, [line2, a.postalCode].filter(Boolean).join(" ")].filter((x): x is string => !!x);
}

/** Date N days from now (negative = past). Kept out of render bodies so components stay pure per react-hooks/purity. */
export function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
