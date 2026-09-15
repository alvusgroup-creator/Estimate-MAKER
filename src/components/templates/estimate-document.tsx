import type { CSSProperties } from "react";
import type { Template } from "@/generated/prisma/enums";
import type { OrgBranding, ClientDTO } from "@/lib/estimates/dto";
import { formatMoney } from "@/lib/estimates/calc";
import { UNIT_LABELS } from "@/lib/estimates/schemas";
import { clientDisplayName, formatAddress } from "@/lib/utils";

/**
 * The document itself. Pure presentational; receives plain numbers/strings so it renders
 * identically in the live editor preview, the public /e/[token] page and print-to-PDF.
 */
export type DocumentLine = {
  name: string;
  description?: string | null;
  quantity: number;
  unit: keyof typeof UNIT_LABELS;
  unitPrice: number;
  lineTotal: number;
  isOptional?: boolean;
};

export type DocumentData = {
  number: string;
  title?: string | null;
  issueDate: string | Date;
  expiresAt?: string | Date | null;
  client: ClientDTO;
  jobAddress: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null };
  lines: DocumentLine[];
  subtotal: number;
  discountAmount: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  notes?: string | null;
  terms?: string | null;
  status?: string;
};

const fmtDate = (d: string | Date, locale: string) =>
  new Date(d).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

export function EstimateDocument({ template, org, data, className }: {
  template: Template;
  org: OrgBranding;
  data: DocumentData;
  className?: string;
}) {
  const money = (n: number) => formatMoney(n, org.currency, org.locale);
  const vars = { "--doc-primary": org.primaryColor, "--doc-accent": org.accentColor } as CSSProperties;
  const orgAddr = formatAddress(org);
  const jobAddr = formatAddress(data.jobAddress);
  const clientAddr = formatAddress(data.client);
  const showJob = jobAddr.length > 0 && jobAddr.join() !== clientAddr.join();

  const Header = template === "BOLD" ? BoldHeader : template === "CLASSIC" ? ClassicHeader : CleanHeader;

  return (
    <article
      style={vars}
      className={`doc bg-white text-[#111] text-[13px] leading-snug w-full mx-auto p-6 sm:p-10 print:p-0 ${template === "CLASSIC" ? "font-serif" : ""} ${className ?? ""}`}
    >
      <Header org={org} data={data} orgAddr={orgAddr} fmtDate={(d) => fmtDate(d, org.locale)} />

      {/* Parties */}
      <section className="grid grid-cols-2 gap-6 mt-8">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Prepared for</p>
          <p className="font-semibold">{clientDisplayName(data.client)}</p>
          {clientAddr.map((l, i) => <p key={i} className="text-neutral-700">{l}</p>)}
          {data.client.phone && <p className="text-neutral-700">{data.client.phone}</p>}
          {data.client.email && <p className="text-neutral-700">{data.client.email}</p>}
        </div>
        {showJob && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Job site</p>
            {jobAddr.map((l, i) => <p key={i} className="text-neutral-700">{l}</p>)}
          </div>
        )}
      </section>

      {data.title && <h2 className="mt-8 text-base font-semibold">{data.title}</h2>}

      {/* Lines */}
      <table className="w-full mt-4 border-collapse">
        <thead>
          <tr className={template === "BOLD" ? "text-white" : "text-neutral-500"} style={template === "BOLD" ? { background: "var(--doc-primary)" } : undefined}>
            <th className="text-left font-medium text-[11px] uppercase tracking-wider py-2 px-2">Description</th>
            <th className="text-right font-medium text-[11px] uppercase tracking-wider py-2 px-2 w-20">Qty</th>
            <th className="text-right font-medium text-[11px] uppercase tracking-wider py-2 px-2 w-24">Rate</th>
            <th className="text-right font-medium text-[11px] uppercase tracking-wider py-2 px-2 w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className={`border-b ${template === "CLASSIC" ? "border-neutral-300" : "border-neutral-200"} ${l.isOptional ? "text-neutral-500" : ""}`}>
              <td className="py-2.5 px-2 align-top">
                <p className="font-medium">
                  {l.name}
                  {l.isOptional && <span className="ml-2 text-[10px] uppercase tracking-wider">optional</span>}
                </p>
                {l.description && <p className="text-neutral-600 whitespace-pre-line">{l.description}</p>}
              </td>
              <td className="py-2.5 px-2 text-right align-top tabular-nums whitespace-nowrap">
                {l.quantity} {UNIT_LABELS[l.unit]}
              </td>
              <td className="py-2.5 px-2 text-right align-top tabular-nums">{money(l.unitPrice)}</td>
              <td className="py-2.5 px-2 text-right align-top tabular-nums font-medium">{money(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <section className="flex justify-end mt-4">
        <dl className="w-full max-w-xs space-y-1">
          <Row label="Subtotal" value={money(data.subtotal)} />
          {data.discountAmount > 0 && <Row label="Discount" value={`− ${money(data.discountAmount)}`} />}
          {data.taxAmount > 0 && <Row label={`${data.taxLabel} (${(data.taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%)`} value={money(data.taxAmount)} />}
          <div className={`flex justify-between pt-2 mt-2 border-t-2 text-base font-semibold ${template === "CLASSIC" ? "border-neutral-800" : "border-neutral-900"}`}>
            <dt>Total</dt>
            <dd className="tabular-nums" style={template !== "CLASSIC" ? { color: "var(--doc-primary)" } : undefined}>{money(data.total)}</dd>
          </div>
          {data.depositAmount > 0 && (
            <div className="flex justify-between text-neutral-700 pt-1">
              <dt>Deposit due on acceptance</dt>
              <dd className="tabular-nums font-medium">{money(data.depositAmount)}</dd>
            </div>
          )}
        </dl>
      </section>

      {(data.notes || data.terms) && (
        <section className="mt-10 grid gap-6 text-[12px] text-neutral-700">
          {data.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Notes</p>
              <p className="whitespace-pre-line">{data.notes}</p>
            </div>
          )}
          {data.terms && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Terms</p>
              <p className="whitespace-pre-line">{data.terms}</p>
            </div>
          )}
        </section>
      )}

      <footer className="mt-10 pt-4 border-t border-neutral-200 text-[11px] text-neutral-500 flex flex-wrap justify-between gap-2">
        <span>{org.name}{org.licenseNo ? ` · ${org.licenseNo}` : ""}</span>
        <span>{[org.phone, org.email, org.website].filter(Boolean).join(" · ")}</span>
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-700">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

type HeaderProps = { org: OrgBranding; data: DocumentData; orgAddr: string[]; fmtDate: (d: string | Date) => string };

function Logo({ org, size = "h-14" }: { org: OrgBranding; size?: string }) {
  if (org.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={org.logoUrl} alt={org.name} className={`${size} w-auto max-w-[180px] object-contain`} />;
  }
  return (
    <div className={`${size} aspect-square rounded-lg grid place-items-center text-white text-xl font-bold`} style={{ background: "var(--doc-primary)" }}>
      {org.name.charAt(0)}
    </div>
  );
}

function Meta({ data, fmtDate, align = "right" }: { data: DocumentData; fmtDate: HeaderProps["fmtDate"]; align?: "left" | "right" }) {
  return (
    <dl className={`text-[12px] ${align === "right" ? "text-right" : ""} space-y-0.5`}>
      <div><dt className="inline text-neutral-500">Estimate </dt><dd className="inline font-medium">{data.number}</dd></div>
      <div><dt className="inline text-neutral-500">Date </dt><dd className="inline">{fmtDate(data.issueDate)}</dd></div>
      {data.expiresAt && <div><dt className="inline text-neutral-500">Valid until </dt><dd className="inline">{fmtDate(data.expiresAt)}</dd></div>}
    </dl>
  );
}

function CleanHeader({ org, data, orgAddr, fmtDate }: HeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        <Logo org={org} />
        <div>
          <p className="font-semibold text-base">{org.name}</p>
          {orgAddr.map((l, i) => <p key={i} className="text-neutral-600 text-[12px]">{l}</p>)}
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight" style={{ color: "var(--doc-primary)" }}>Estimate</p>
        <Meta data={data} fmtDate={fmtDate} />
      </div>
    </header>
  );
}

function BoldHeader({ org, data, orgAddr, fmtDate }: HeaderProps) {
  return (
    <header className="-mx-6 -mt-6 sm:-mx-10 sm:-mt-10 print:m-0 p-6 sm:p-10 text-white" style={{ background: "var(--doc-primary)" }}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {org.logoUrl ? <Logo org={org} /> : <div className="h-14 aspect-square rounded-lg grid place-items-center text-2xl font-bold" style={{ background: "var(--doc-accent)" }}>{org.name.charAt(0)}</div>}
          <div>
            <p className="font-bold text-xl">{org.name}</p>
            <p className="text-white/70 text-[12px]">{orgAddr.join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black uppercase tracking-tight">Estimate</p>
          <p className="text-white/80 text-[12px] mt-1">{data.number} · {fmtDate(data.issueDate)}</p>
          {data.expiresAt && <p className="text-white/80 text-[12px]">Valid until {fmtDate(data.expiresAt)}</p>}
        </div>
      </div>
    </header>
  );
}

function ClassicHeader({ org, data, orgAddr, fmtDate }: HeaderProps) {
  return (
    <header className="text-center border-b-2 border-neutral-800 pb-5">
      <div className="flex justify-center mb-3"><Logo org={org} size="h-12" /></div>
      <p className="text-2xl font-semibold tracking-wide">{org.name}</p>
      <p className="text-neutral-600 text-[12px] mt-1">{[...orgAddr, org.phone, org.licenseNo].filter(Boolean).join("  ·  ")}</p>
      <div className="mt-5 flex items-end justify-between">
        <p className="text-lg uppercase tracking-[0.2em]">Estimate</p>
        <Meta data={data} fmtDate={fmtDate} />
      </div>
    </header>
  );
}
