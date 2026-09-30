import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getSession()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <main className="bg-grid flex min-h-dvh items-center justify-center bg-paper-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Image src="/brand/logo-full-sm.webp" alt="RSP Ventures" width={360} height={267} priority unoptimized className="h-auto w-48" />
        </div>
        <div className="card mt-8 p-6 shadow-card sm:p-8">
          <p className="label-mono">Staff only</p>
          <h1 className="mt-2 text-[1.5rem]">Sign in to the register</h1>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
        <p className="mt-6 text-center text-[13px]">
          <Link href="/en" className="inline-flex items-center gap-1.5 font-semibold text-ink-600 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
