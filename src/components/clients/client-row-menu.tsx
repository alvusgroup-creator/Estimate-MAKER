"use client";

import { useTransition, type ReactNode } from "react";
import { Archive, Eye, FilePlus2, Mail, MapPin, MessageSquare, Pencil, Phone } from "lucide-react";
import { ContextMenu, type MenuItem } from "@/components/ui/context-menu";
import { archiveClient } from "@/lib/clients/actions";

export type ClientRowData = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null; // pre-joined "street, city, ST zip"
};

export function ClientRowMenu({ client: c, children, includeOpen = true, as }: { client: ClientRowData; children: ReactNode; includeOpen?: boolean; as?: "div" | "li" }) {
  const [, start] = useTransition();
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");

  const items: MenuItem[] = [
    { type: "label", label: name },
    ...(includeOpen ? [{ label: "Open", icon: Eye, href: `/clients/${c.id}` } satisfies MenuItem] : []),
    { label: "New estimate for this client", icon: FilePlus2, href: `/estimates/new?client=${c.id}` },
    { type: "separator" },
    { label: c.phone ? `Call ${c.phone}` : "Call", icon: Phone, href: c.phone ? `tel:${c.phone}` : undefined, disabled: !c.phone },
    { label: "Text", icon: MessageSquare, href: c.phone ? `sms:${c.phone}` : undefined, disabled: !c.phone },
    { label: "Email", icon: Mail, href: c.email ? `mailto:${c.email}` : undefined, disabled: !c.email },
    { label: "Open in Maps", icon: MapPin, href: c.address ? `https://maps.google.com/?q=${encodeURIComponent(c.address)}` : undefined, external: true, disabled: !c.address },
    { type: "separator" },
    { label: "Edit", icon: Pencil, href: `/clients/${c.id}/edit` },
    { label: "Archive", icon: Archive, danger: true, onSelect: () => { if (confirm(`Archive ${name}? Their estimates are kept.`)) start(() => archiveClient(c.id)); } },
  ];

  return <ContextMenu items={items} as={as}>{children}</ContextMenu>;
}
