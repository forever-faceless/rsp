import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  as?: "h1" | "h2";
  className?: string;
};

export function SectionHeading({ eyebrow, title, subtitle, align = "left", tone = "light", as: Tag = "h2", className }: Props) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", dark && "on-dark", className)}>
      {eyebrow ? <p className={cn("eyebrow", align === "center" && "eyebrow-plain justify-center")}>{eyebrow}</p> : null}
      <Tag className={cn(Tag === "h1" ? "display-1" : "display-2", eyebrow && "mt-4", dark && "!text-paper-50")}>{title}</Tag>
      {subtitle ? <p className={cn("mt-4 text-[1.02rem] leading-relaxed", dark ? "text-navy-200" : "text-ink-600")}>{subtitle}</p> : null}
    </div>
  );
}
