// @edufarm/ui v0 — token-driven primitives + trust badges.
// Full component build (Storybook) lands in Phase 0.2. Types only for now so apps compile.

export type BadgeKind = "official" | "verified" | "urgent" | "edition" | "points";
export type ButtonKind = "primary" | "accent" | "outline" | "danger";

export interface TrustBadgeProps {
  kind: BadgeKind;
  label: string;
}

// Rendered by apps until React components land. Keeps class contract stable.
export function badgeClass(kind: BadgeKind): string {
  return `edubadge edubadge-${kind}`;
}

export function buttonClass(kind: ButtonKind): string {
  return `edubtn edubtn-${kind}`;
}

export { Icon, Dot } from "./icons";
export type { IconName } from "./icons";
export { EDU_CSS } from "./styles";
export { Field, Alert, Badge, Tabs, Modal, Confirm, DataTable, Pagination, EmptyState, LoadingState, ErrorState, SuccessNote } from "./components";
export { Crumb } from "./Nav";
export { NavLinks, MobileBar, PortalLinks } from "./Nav";
export type { NavItem } from "./Nav";
