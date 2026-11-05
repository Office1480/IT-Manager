import { Cable, Headphones, HardDrive, Keyboard, Laptop, Monitor, Mouse, Package, Printer, Router, Server, Smartphone, Tablet, PcCase } from "lucide-react";
import type { AssetCategory } from "@prisma/client";

const ICONS: Record<AssetCategory, typeof Laptop> = {
  LAPTOP: Laptop, DESKTOP: PcCase, MONITOR: Monitor, KEYBOARD: Keyboard, MOUSE: Mouse, HEADSET: Headphones,
  DOCKING: HardDrive, PHONE: Smartphone, TABLET: Tablet, PRINTER: Printer, NETWORK: Router, SERVER: Server,
  ACCESSORY: Cable, OTHER: Package,
};

export function CategoryIcon({ category, className }: { category: AssetCategory; className?: string }) {
  const Icon = ICONS[category] ?? Package;
  return <Icon className={className} />;
}
