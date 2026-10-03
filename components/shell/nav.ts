import {
  ChartLineUp,
  ChefHat,
  CookingPot,
  Gear,
  Megaphone,
  Package,
  Receipt,
  SquaresFour,
  UsersThree,
  Wallet,
  IdentificationBadge,
  type Icon,
} from "@phosphor-icons/react";

export const NAV: { href: string; label: string; icon: Icon; group: "Run" | "Grow" | "Admin" }[] = [
  { href: "/", label: "Command center", icon: SquaresFour, group: "Run" },
  { href: "/orders", label: "Orders", icon: ChefHat, group: "Run" },
  { href: "/menu", label: "Menu", icon: CookingPot, group: "Run" },
  { href: "/inventory", label: "Inventory", icon: Package, group: "Run" },
  { href: "/sales", label: "Sales", icon: ChartLineUp, group: "Grow" },
  { href: "/marketing", label: "Marketing", icon: Megaphone, group: "Grow" },
  { href: "/customers", label: "Customers", icon: UsersThree, group: "Grow" },
  { href: "/billing", label: "Billing", icon: Receipt, group: "Admin" },
  { href: "/finance", label: "Finance", icon: Wallet, group: "Admin" },
  { href: "/staff", label: "Staff", icon: IdentificationBadge, group: "Admin" },
  { href: "/settings", label: "Settings", icon: Gear, group: "Admin" },
];
