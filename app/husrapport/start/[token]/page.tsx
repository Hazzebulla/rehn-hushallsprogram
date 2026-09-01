import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { payloadFromStored } from "../../../../lib/customer-preinspection";
import CustomerPreInspectionView from "./view";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function CustomerPreInspectionPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 24) notFound();

  const link = await prisma.customerPreInspectionLink.findUnique({ where: { token } });
  if (!link || (link.expiresAt && link.expiresAt < new Date())) notFound();

  return (
    <CustomerPreInspectionView
      token={token}
      initialPayload={payloadFromStored(link.payload)}
      initialStatus={link.status}
      initialCompletedAt={link.completedAt?.toISOString() ?? null}
    />
  );
}
