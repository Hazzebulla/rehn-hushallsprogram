export type HusstatusImage = {
  id: string;
  customerId: string;
  customerName: string;
  propertyId: string;
  propertyName: string;
  address: string;
  submissionId: string;
  sectionId: number;
  sectionTitle: string;
  fieldKey: string;
  fieldLabel: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  createdAt: string;
  visibility: "INTERNAL" | "CUSTOMER";
};

type SectionMeta = {
  id: number;
  title: string;
  fields: Array<{ key: string; label: string }>;
};

type SubmissionLike = {
  id: string;
  answers: Array<{ fieldKey: string; value: unknown }>;
  inspection?: {
    property?: {
      id: string;
      propertyNo: string | null;
      address: string;
      customer: { id: string; name: string };
    } | null;
  } | null;
};

type PhotoLike = {
  id?: unknown;
  name?: unknown;
  mimeType?: unknown;
  size?: unknown;
  dataUrl?: unknown;
  createdAt?: unknown;
  areaId?: unknown;
  category?: unknown;
  linkedId?: unknown;
};

type TechnicianPhotoOwner = {
  areaId?: unknown;
  type?: unknown;
  object?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  photos?: unknown;
};

const technicianAreaTitles: Record<string, string> = {
  heat: "Värmesystem",
  tapwater: "Tappvatten",
  hotwater: "Varmvatten",
  drain: "Avlopp",
  bathroom: "Badrum",
  kitchen: "Kök",
  laundry: "Tvättstuga",
  technical: "Teknikrum",
  other: "Övrigt",
};

const imageVisibility = new Set([
  "component_register_rows",
  "other_information__photos",
  "other_image_notes__photos",
  "other_followup__photos",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function answerPayload(value: unknown) {
  if (!isRecord(value)) return value;
  return value.values ?? value.value ?? value;
}

function isPhoto(value: unknown): value is PhotoLike {
  return isRecord(value) && typeof value.dataUrl === "string" && value.dataUrl.startsWith("data:image/");
}

function normalizePhoto(photo: PhotoLike, fallbackId: string) {
  return {
    id: String(photo.id ?? fallbackId),
    fileName: String(photo.name ?? "Bild"),
    mimeType: String(photo.mimeType ?? "image/jpeg"),
    size: Number(photo.size ?? 0),
    dataUrl: String(photo.dataUrl ?? ""),
    createdAt: String(photo.createdAt ?? ""),
  };
}

function technicianSection(areaId: unknown) {
  const key = String(areaId ?? "other");
  return technicianAreaTitles[key] ?? "Montörens besiktning";
}

function fieldLookup(sections: SectionMeta[]) {
  return new Map(
    sections.flatMap((section) =>
      section.fields.map((field) => [
        field.key,
        {
          sectionId: section.id,
          sectionTitle: section.title,
          fieldLabel: field.label,
        },
      ]),
    ),
  );
}

function baseImage(submission: SubmissionLike) {
  const property = submission.inspection?.property;
  return {
    customerId: property?.customer.id ?? "-",
    customerName: property?.customer.name ?? "Okänd kund",
    propertyId: property?.id ?? "-",
    propertyName: property?.propertyNo ?? "Fastighet",
    address: property?.address ?? "-",
    submissionId: submission.id,
  };
}

export function extractHusstatusImages(submissions: SubmissionLike[], sections: SectionMeta[]): HusstatusImage[] {
  const lookup = fieldLookup(sections);
  const images: HusstatusImage[] = [];

  for (const submission of submissions) {
    const base = baseImage(submission);

    for (const answer of submission.answers) {
      const payload = answerPayload(answer.value);

      if (answer.fieldKey.endsWith("__photos") && Array.isArray(payload)) {
        const originalKey = answer.fieldKey.replace(/__photos$/, "");
        const meta = lookup.get(originalKey) ?? {
          sectionId: 99,
          sectionTitle: "Bilder",
          fieldLabel: originalKey,
        };

        payload.filter(isPhoto).forEach((photo, index) => {
          const normalized = normalizePhoto(photo, `${submission.id}-${answer.fieldKey}-${index}`);
          images.push({
            ...base,
            ...normalized,
            sectionId: meta.sectionId,
            sectionTitle: meta.sectionTitle,
            fieldKey: originalKey,
            fieldLabel: meta.fieldLabel,
            visibility: imageVisibility.has(answer.fieldKey) ? "CUSTOMER" : "INTERNAL",
          });
        });
      }

      if (answer.fieldKey === "component_register_rows" && Array.isArray(payload)) {
        payload.filter(isRecord).forEach((row, rowIndex) => {
          const label = String(row.typeName ?? row.model ?? `Komponent ${rowIndex + 1}`);
          const photos = Array.isArray(row.photos) ? row.photos : [];
          photos.filter(isPhoto).forEach((photo, photoIndex) => {
            const normalized = normalizePhoto(photo, `${submission.id}-component-${rowIndex}-${photoIndex}`);
            images.push({
              ...base,
              ...normalized,
              sectionId: 19,
              sectionTitle: "Samlat installations- och dimensionsregister",
              fieldKey: "component_register_rows",
              fieldLabel: label,
              visibility: "CUSTOMER",
            });
          });
        });
      }

      if (answer.fieldKey === "technician_inspection" && isRecord(payload)) {
        const areaPhotos = Array.isArray(payload.photos) ? payload.photos : [];
        areaPhotos.filter(isPhoto).forEach((photo, index) => {
          const normalized = normalizePhoto(photo, `${submission.id}-technician-area-${index}`);
          const sectionTitle = technicianSection(photo.areaId);
          images.push({
            ...base,
            ...normalized,
            sectionId: 30,
            sectionTitle,
            fieldKey: "technician_inspection.photos",
            fieldLabel: `${String(photo.category ?? "Bild")} - ${sectionTitle}`,
            visibility: "CUSTOMER",
          });
        });

        const installations = Array.isArray(payload.installations) ? payload.installations : [];
        installations.filter(isRecord).forEach((owner: TechnicianPhotoOwner, ownerIndex) => {
          const photos = Array.isArray(owner.photos) ? owner.photos : [];
          const title = [owner.type, owner.manufacturer, owner.model].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ") || `Installation ${ownerIndex + 1}`;
          photos.filter(isPhoto).forEach((photo, photoIndex) => {
            const normalized = normalizePhoto(photo, `${submission.id}-technician-installation-${ownerIndex}-${photoIndex}`);
            images.push({
              ...base,
              ...normalized,
              sectionId: 31,
              sectionTitle: technicianSection(owner.areaId),
              fieldKey: "technician_inspection.installations",
              fieldLabel: title,
              visibility: "CUSTOMER",
            });
          });
        });

        const findings = Array.isArray(payload.findings) ? payload.findings : [];
        findings.filter(isRecord).forEach((owner: TechnicianPhotoOwner, ownerIndex) => {
          const photos = Array.isArray(owner.photos) ? owner.photos : [];
          const title = String(owner.object ?? `Brist ${ownerIndex + 1}`);
          photos.filter(isPhoto).forEach((photo, photoIndex) => {
            const normalized = normalizePhoto(photo, `${submission.id}-technician-finding-${ownerIndex}-${photoIndex}`);
            images.push({
              ...base,
              ...normalized,
              sectionId: 32,
              sectionTitle: technicianSection(owner.areaId),
              fieldKey: "technician_inspection.findings",
              fieldLabel: title,
              visibility: "CUSTOMER",
            });
          });
        });
      }
    }
  }

  return images.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

