"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, KeyRound, LayoutGrid, Newspaper, Send, Users, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NavLinks({ onNavigate }) {
	const pathname = usePathname();

	return (
		<nav className="flex flex-col gap-0.5">
			{NAV_ITEMS.map(({ href, label, icon: Icon }) => {
				const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
				return (
					<Link
						key={href}
						href={href}
						onClick={onNavigate}
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"flex h-9 items-center gap-2.5 rounded-lg pr-3 pl-2.5 text-sm font-medium transition-colors duration-150",
							isActive
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
						)}
					>
						<Icon className="size-4" />
						{label}
					</Link>
				);
			})}
		</nav>
	);
}

const NAV_ITEMS = [
	{ href: "/", label: "Vue d’ensemble", icon: LayoutGrid },
	{ href: "/campaigns", label: "Campagnes", icon: Send },
	{ href: "/contacts", label: "Contacts", icon: Users },
	{ href: "/newsletters", label: "Newsletters", icon: Newspaper },
	{ href: "/domains", label: "Domaines", icon: Globe },
	{ href: "/settings", label: "Configuration", icon: Settings2 },
	{ href: "/api-keys", label: "Clés API", icon: KeyRound },
];
