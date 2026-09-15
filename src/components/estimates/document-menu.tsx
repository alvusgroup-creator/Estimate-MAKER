"use client";

import type { ReactNode } from "react";
import { EstimateRowMenu, type EstimateRowData } from "./estimate-row-menu";

/** Right-click anywhere on the rendered document for the same actions as the Share panel. */
export function DocumentMenu({ estimate, children }: { estimate: EstimateRowData; children: ReactNode }) {
  return (
    <EstimateRowMenu estimate={estimate} includeOpen={false}>
      {children}
    </EstimateRowMenu>
  );
}
