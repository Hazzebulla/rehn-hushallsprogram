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
    }
  }

  return images.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

