import { redirect } from "next/navigation";
import type React from "react";
import { getCurrentSessionUser } from "../../lib/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSessionUser();
  if (!session || session.role === "CUSTOMER") redirect("/login?next=/admin");

  return children;
}
