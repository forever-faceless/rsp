import type { ListingStatus, ProjectStatus } from "@/lib/db/enums";
import { cn } from "@/lib/utils";

const listingTone: Record<ListingStatus, string> = {
  available: "bg-success-100 text-success-700",
  reserved: "bg-warning-100 text-warning-700",
  sold: "bg-muted-100 text-muted-600",
};

const projectTone: Record<ProjectStatus, string> = {
  upcoming: "bg-navy-100 text-navy-700",
  ongoing: "bg-success-100 text-success-700",
  completed: "bg-gold-100 text-gold-800",
  sold_out: "bg-muted-100 text-muted-600",
};

export function ListingStatusBadge({ status, label, className }: { status: ListingStatus; label: string; className?: string }) {
  return <span className={cn("badge badge-dot", listingTone[status], className)}>{label}</span>;
}

/** The stamp laid across a listing that has been sold. It sits over the picture, so its parent must be positioned. */
export function SoldStamp({ label, className }: { label: string; className?: string }) {
  return <span className={cn("sold-stamp", className)}>{label}</span>;
}

export function ProjectStatusBadge({ status, label, className }: { status: ProjectStatus; label: string; className?: string }) {
  return <span className={cn("badge badge-dot", projectTone[status], className)}>{label}</span>;
}
