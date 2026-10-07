// Shared navigation: active-aware links, cross-portal switcher, breadcrumbs.
// Used by all three Next.js apps so the ecosystem feels like one product.
// Active link = aria-current="page"; layouts style it via
// `header.top a[aria-current="page"]` / `.bottomnav a[aria-current="page"]`.
// NOTE: framework-agnostic on purpose — active state comes from
// window.location (works in Next.js, plain HTML, or any future shell).
"use client";

import React, { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

function usePath(): string {
  const [path, setPath] = useState<string>("/");
  useEffect(() => {
    const read = () => setPath(window.location.pathname);
    read();
    window.addEventListener("popstate", read);
    // Next.js client navigation patches history — poll cheaply for the first seconds.
    const t = window.setInterval(read, 500);
    window.setTimeout(() => window.clearInterval(t), 5000);
    return () => {
      window.removeEventListener("popstate", read);
      window.clearInterval(t);
    };
  }, []);
  return path;
}

// Top-bar links with active highlight. Pass the layout's link class (e.g. "navlink").
export function NavLinks({ items, linkClassName }: { items: NavItem[]; linkClassName?: string }) {
  const path = usePath();
  return (
    <span className="navlinks-group">
      {items.map((it) => (
        <a
          key={it.href}
          href={it.href}
          className={linkClassName}
          aria-current={isActive(path, it.href) ? "page" : undefined}
        >
          <Icon name={it.icon} size={14} /> <span>{it.label}</span>
        </a>
      ))}
    </span>
  );
}

// Bottom-bar variant for phones (stacked icon + label).
export function MobileBar({ items }: { items: NavItem[] }) {
  const path = usePath();
  return (
    <>
      {items.map((it) => (
        <a key={it.href} href={it.href} aria-current={isActive(path, it.href) ? "page" : undefined}>
          <Icon name={it.icon} size={18} />
          <small>{it.label}</small>
        </a>
      ))}
    </>
  );
}

// Jump between the portals of the ecosystem (local-first + LAN/tunnel aware URLs).
export function PortalLinks() {
  const [host, setHost] = useState("localhost");
  const [protocol, setProtocol] = useState("http:");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.hostname || "localhost");
      setProtocol(window.location.protocol || "http:");
    }
  }, []);
  const portals: { href: string; label: string; icon: IconName }[] = [
    { href: `${protocol}//${host}:8080/`, label: "Portal", icon: "dashboard" },
    { href: `${protocol}//${host}:3001/`, label: "Student", icon: "grad" },
    { href: `${protocol}//${host}:3002/`, label: "Lecturer", icon: "book" },
    { href: `${protocol}//${host}:3003/`, label: "Admin", icon: "shield" },
  ];
  return (
    <span className="portals">
      {portals.map((p) => (
        <a key={p.label} href={p.href} title={`Open ${p.label} portal`}>
          <Icon name={p.icon} size={14} /> <span>{p.label}</span>
        </a>
      ))}
    </span>
  );
}

// Breadcrumb trail for detail pages: Home / Courses / BIO 201 …
export function Crumb({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
      {trail.map((t, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i}>
            {i > 0 && " / "}
            {t.href && !last ? <a href={t.href}>{t.label}</a> : <strong aria-current={last ? "page" : undefined}>{t.label}</strong>}
          </span>
        );
      })}
    </nav>
  );
}
