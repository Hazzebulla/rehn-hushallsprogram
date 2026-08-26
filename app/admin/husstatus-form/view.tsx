"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent } from "react";
import { autosaveHusstatusDraftAction, completeHusstatusFormAction } from "./actions";
import {
  buildImageChecklist,
  getImageChecklistStatus,
  isImageChecklistItemComplete,
  summarizeImageChecklist,
  type ImageChecklistItem,
  type ImageChecklistStatus,
  type ImageChecklistStatusMap,
  type ImageType,
  type SectionStatus,
  type SectionStatusMap,
} from "./image-checklist";
import type { RvmField, RvmSection } from "./spec";

type PropertyOption = {
  id: string;
  label: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerIdentifier: string;
  propertyNo: string;
  address: string;
  propertyType: string;
  buildYear: number | null;
};

type ProductOption = {
  id: string;
  category: string;
  manufacturer: string;
  rskNumber: string;
  productName: string;
  modelName: string;
  unit: string;
  systemType: string;
  technicalData: string;
  expectedLifetimeMinYears: number | null;
  expectedLifetimeMaxYears: number | null;
  replacementPriceMinSek: number | null;
  replacementPriceMaxSek: number | null;
  latestSupplierPrice?: number | null;
  sourceUrl: string;
  manualUrl: string;
  wiringDiagramUrl: string;
  dataQuality: string;
  supplierProducts?: {
    supplierArticleNumber: string;
    rskNumber: string | null;
    supplierName: string;
    calculationGroup: string | null;
    unit: string | null;
    latestPrice?: { price?: number | null } | null;
  }[];
};

type PhotoAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
  componentId?: string;
  imageType?: ImageType;
  checklistItemId?: string;
  ocrCandidate?: boolean;
};

type ComponentRegisterRow = {
  productModelId?: string;
  typeName: string;
  systemName: string;
  category: string;
  brand: string;
  model: string;
  serialNo: string;
  installedYear: string;
  status: string;
  replacementYear: string;
  replacementPeriod: string;
  costKr: string;
  photos?: PhotoAttachment[];
};

type SignatureRole = "Kund" | "Montör" | "Fastighetsägare" | "Representant";

type SignatureEntry = {
  id: string;
  label: string;
  signedBy: string;
  role: SignatureRole;
  signedAt: string;
  imageDataUrl: string;
  signedHash: string;
};

type SignatureMap = Record<string, SignatureEntry>;

type AnswerValue = string | string[] | ComponentRegisterRow[] | PhotoAttachment[] | ImageChecklistStatusMap | SectionStatusMap | SignatureMap;
type Answers = Record<string, AnswerValue>;

const sourceOptions = [
  "Kunduppgift",
  "Kundregister",
  "Fastighetsregister",
  "RVM verifierat",
  "RVM mätt",
  "Dokumentation",
  "Ej kontrollerat",
  "Ej åtkomligt",
  "Ej aktuellt",
];

const fieldSuggestions: Record<string, string[]> = {
  foundation: ["Platta på mark", "Källare", "Krypgrund", "Torpargrund", "Suterräng", "Ej kontrollerat"],
  water_source: ["Kommunalt", "Egen brunn", "Samfällighet", "Okänt"],
  service_material: ["PEM 25", "PEM 32", "PEM 40", "Koppar 22", "Koppar 28", "Galvat", "Okänt"],
  water_meter: ["Kamstrup Q3 2,5", "Kamstrup Q3 4", "Sensus", "Vattenmätarkonsol", "Okänt"],
  main_shutoff: ["Kulventil", "LK 580", "Ballofix", "Servisventil", "Avstängning kärvar", "Ej åtkomligt"],
  well_type_depth: ["Borrad brunn", "Grävd brunn", "Hydrofor", "Hydropress", "Okänt djup"],
  filter_type: ["Partikelfilter", "Avhärdare", "Järn/manganfilter", "UV-filter", "Radonfilter", "Saknas"],
  hot_water_type: ["Värmepump med integrerad VVB", "Extern varmvattenberedare", "Panna", "Värmeväxlare", "Elberedare"],
  hot_water_product: ["NIBE VPB 200", "NIBE VVM 320", "IVT 290", "CTC EcoZenith", "Metro Therm", "OSO"],
  mixing_valve: ["ESBE VTA322", "ESBE VTA320", "LK 550", "MMA", "Blandningsventil saknas"],
  heat_source_type: ["Bergvärme", "Jordvärme", "Luft/vatten", "Frånluftsvärmepump", "Fjärrvärme", "Elpanna", "Pelletspanna", "Vedpanna"],
  heat_source_product: ["NIBE F1245", "NIBE F1255", "NIBE S1255", "IVT PremiumLine X15", "CTC GSi 616", "Thermia Diplomat"],
  nominal_power: ["6 kW", "8 kW", "10 kW", "12 kW", "16 kW", "Tillsats 6 kW", "Tillsats 9 kW"],
  control_system: ["Rego 600", "Rego 800", "NIBE Uplink", "myUplink", "CTC Connect", "EcoLogic", "Okänt"],
  energy_source_type: ["Energibrunn", "Jordvärmeslinga", "Sjövärme", "Luft/vatten", "Ej aktuellt"],
  collector_type: ["PEM 40", "PEM 32", "Dubbelkollektor", "Etanolblandning", "Glykolblandning", "Okänt"],
  heat_pipe_material: ["Stål", "Koppar", "PEX", "Alupex", "Blandat", "Okänt"],
  circulation_pump: ["Grundfos Alpha2 25-60", "Grundfos UPM3 25-75", "Wilo Yonos Para 25/6", "Wilo Stratos", "Okänt"],
  expansion_vessel: ["Reflex N 18", "Reflex N 25", "Flamco 18 l", "Flamco 25 l", "Expansionskärl bör bytas"],
  safety_valve: ["1,5 bar / DN15", "2,5 bar / DN15", "3 bar / DN15", "Flamco Prescor B", "Saknas/ej åtkomlig"],
  valve_type: ["Danfoss RA", "MMA", "TA", "LK", "Äldre slottsventil", "Okänt"],
  floor_heating: ["LK fördelare", "Uponor fördelare", "Roth", "Manuell shunt", "Ställdon saknas", "Ej aktuellt"],
  cold_water_pipe: ["PEM 32", "Koppar 22", "Koppar 28", "PEX 20", "Rör-i-rör", "Galvat"],
  hot_water_pipe: ["Koppar 22", "Koppar 18", "PEX 20", "Rör-i-rör", "Blandat", "Okänt"],
  sewer_type: ["Kommunalt", "Enskilt avlopp", "Trekammarbrunn", "Minireningsverk", "Okänt"],
  sewer_material: ["Gjutjärn 110", "PVC 110", "PP 110", "Betong", "Blandat", "Okänt"],
  floor_drain: ["Purus Oden", "Purus MiniMax", "Jafo", "Äldre plastbrunn", "Gjutjärnsbrunn", "Okänt fabrikat"],
  bathroom_1_drain: ["Purus Oden", "Purus MiniMax", "Jafo", "Äldre plastbrunn", "Gjutjärnsbrunn", "Okänt fabrikat"],
  laundry_drain: ["Purus", "Jafo", "Äldre golvbrunn", "Saknas", "Ej åtkomlig"],
  outdoor_taps: ["Kontrollerat", "Frostfri utekran", "Äldre utekran", "Saknar avstängning", "Ej aktuellt"],
  inspection_owner: ["Matthias", "Arbetsledare Rehn", "Montör Rehn", "Rehn VVS"],
  customer_signer: ["Kund på plats", "Kund signerar digitalt", "Ej aktuellt"],
  rvm_signer: ["Matthias", "Arbetsledare Rehn", "Montör Rehn"],
  report_owner_deadline: ["Rehn VVS", "Arbetsledare Rehn", "Montör Rehn", "Matthias", "Ej satt"],
  followup_owner: ["Rehn VVS", "Arbetsledare", "Montör", "Kund", "Ej satt"],
  next_control: ["Om 3 månader", "Om 6 månader", "Om 12 månader", "Februari 2027", "Mars 2027", "Årlig kontroll"],
  location: ["Timrå", "Sundsvall", "Härnösand", "Bromma", "På plats hos kund"],
};

function propertyAutofillAnswers(property: PropertyOption): Partial<Answers> {
  const contact = [property.customerPhone, property.customerEmail].filter(Boolean).join(" / ");
  const propertyAddress = [property.address, property.propertyNo].filter(Boolean).join(" / ");

  return {
    customer_name: property.customerName,
    contact,
    property_address: propertyAddress,
    build_year: property.buildYear ? String(property.buildYear) : "",
    scope: "Full husstatus",
    customer_name__source: "Kundregister",
    contact__source: "Kundregister",
    property_address__source: "Fastighetsregister",
    build_year__source: property.buildYear ? "Fastighetsregister" : "",
  };
}

function mergeAutofillAnswers(current: Answers, autofill: Partial<Answers>) {
  const next = { ...current };
  for (const [key, value] of Object.entries(autofill)) {
    if (!hasValue(next[key]) && hasValue(value as AnswerValue)) {
      next[key] = value as AnswerValue;
    }
  }
  return next;
}

const emptyComponentRows: ComponentRegisterRow[] = Array.from({ length: 20 }, () => ({
  typeName: "",
  systemName: "",
  category: "",
  brand: "",
  model: "",
  serialNo: "",
  installedYear: "",
  status: "",
  replacementYear: "",
  replacementPeriod: "",
  costKr: "",
  photos: [],
}));

function splitBrandModel(value: string) {
  const [brand = "", ...modelParts] = value.trim().split(/\s+/);
  return { brand, model: modelParts.join(" ") };
}

function parseComponentRegisterText(value: string): ComponentRegisterRow[] {
  const parsed = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return !normalized.includes("installationsregister") && !normalized.startsWith("komponent\t") && normalized !== "komponent";
    })
    .map((line) => {
      const columns = line.includes(";")
        ? line.split(";").map((part) => part.trim())
        : line.split(/\t+/).map((part) => part.trim());

      const [typeName = "", brandModel = "", dataDim = "", serialNo = "", installedYear = "", status = ""] = columns;
      const { brand, model } = splitBrandModel(brandModel);

      return {
        typeName,
        systemName: dataDim,
        category: "Värmesystem",
        brand,
        model,
        serialNo,
        installedYear,
        status,
        replacementYear: "",
        replacementPeriod: "",
        costKr: "",
        photos: [],
      };
    })
    .filter((row) => row.typeName);

  return [...parsed, ...emptyComponentRows].slice(0, 20);
}

function hasValue(value: AnswerValue | undefined) {
  if (Array.isArray(value)) {
    if (!value.length) return false;
    if (typeof value[0] === "object") {
      return (value as ComponentRegisterRow[]).some((row) =>
        Object.values(row).some((cell) => String(cell ?? "").trim().length > 0),
      );
    }
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => String(item ?? "").trim().length > 0);
  }
  return String(value ?? "").trim().length > 0;
}

function isPhotoAttachment(value: unknown): value is PhotoAttachment {
  return value !== null && typeof value === "object" && "dataUrl" in value && "mimeType" in value;
}

function photoArray(value: AnswerValue | undefined): PhotoAttachment[] {
  return Array.isArray(value) && value.every(isPhotoAttachment) ? value : [];
}

function checklistStatuses(value: AnswerValue | undefined): ImageChecklistStatusMap {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as ImageChecklistStatusMap;
}

function signatures(value: AnswerValue | undefined): SignatureMap {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as SignatureMap;
}

function sectionStatuses(value: AnswerValue | undefined): SectionStatusMap {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as SectionStatusMap;
}

function sectionStatusFor(answers: Answers, sectionId: number): SectionStatus {
  return sectionStatuses(answers.section_statuses)[String(sectionId)] ?? "active";
}

function isSectionActive(answers: Answers, sectionId: number) {
  return sectionStatusFor(answers, sectionId) !== "not_applicable";
}

function answerBelongsToInactiveSection(key: string, sections: RvmSection[], answers: Answers) {
  if (key === "section_statuses") return false;
  if (key === "image_checklist_statuses") return false;
  if (key === "signatures") return false;
  const baseKey = key.replace(/__source$|__photos$/, "");
  const owner = sections.find((section) => section.fields.some((field) => field.key === baseKey));
  return owner ? !isSectionActive(answers, owner.id) : false;
}

function lightweightValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(lightweightValue);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === "string" || typeof record.imageDataUrl === "string") {
    return { ...record, dataUrl: "", imageDataUrl: "" };
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, lightweightValue(item)]));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value ?? "");
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function simpleHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function reportSignatureHash(answers: Answers, sections: RvmSection[]) {
  const significant = Object.fromEntries(
    Object.entries(answers)
      .filter(([key]) =>
        key !== "signatures"
        && key !== "image_checklist_statuses"
        && !answerBelongsToInactiveSection(key, sections, answers),
      )
      .map(([key, value]) => [key, lightweightValue(value)]),
  );
  return simpleHash(stableStringify(significant));
}

function lightenStoredPhotos(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(lightenStoredPhotos);
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === "string" && typeof record.mimeType === "string") {
    return { ...record, dataUrl: "" };
  }

  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, lightenStoredPhotos(item)]));
}

function fieldAllowsPhotos(sectionId: number, field: RvmField) {
  if (sectionId === 3) return true;
  if (sectionId === 25) return true;
  if (field.type === "number" || field.type === "date" || field.type === "checklist") return false;
  const normalized = `${field.key} ${field.label}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /bild|foto|oversikt|produkt|fabrikat|modell|pump|ventil|kar|matare|avstang|blandare|wc|brunn|disk|kyl|frys|larm|skap|koppling|ledning|radiator|fordelare|varmekalla|beredare|tvatt|pool|utekran|golvvarme|hydro|filter/.test(normalized);
}

async function imageFileToAttachment(
  file: File,
  metadata: Pick<PhotoAttachment, "componentId" | "imageType" | "checklistItemId" | "ocrCandidate"> = {},
): Promise<PhotoAttachment> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas saknas.");
    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.58);

    return {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      name: file.name,
      mimeType: "image/jpeg",
      size: Math.round((dataUrl.length * 3) / 4),
      dataUrl,
      createdAt: new Date().toISOString(),
      ...metadata,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: RvmField;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  if (field.type === "textarea") {
    return <textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} rows={4} />;
  }

  if (field.type === "select") {
    return (
      <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        <option value="">Ej valt</option>
        {field.options?.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  if (field.type === "checklist") {
    const selected = Array.isArray(value) && (value.length === 0 || typeof value[0] === "string") ? value as string[] : [];
    return (
      <div className="checkGrid">
        {field.options?.map((option) => (
          <label key={option}>
            <input
              checked={selected.includes(option)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))
              }
              type="checkbox"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  const suggestions = fieldSuggestions[field.key] ?? [];
  const listId = suggestions.length ? `suggestions-${field.key}` : undefined;
  const currentValue = String(value ?? "");

  return (
    <>
      <input
        list={listId}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={currentValue}
        onChange={(event) => onChange(event.target.value)}
      />
      {listId ? (
        <datalist id={listId}>
          {suggestions.map((option) => <option key={option} value={option} />)}
        </datalist>
      ) : null}
      {suggestions.length ? (
        <div className="quickPickRow">
          {suggestions.slice(0, 8).map((option) => (
            <button
              className={currentValue === option ? "selected" : ""}
              key={option}
              onClick={() => onChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function PhotoUploader({
  photos,
  compact = false,
  actionLabel = "Lägg till bild",
  captureCamera = false,
  metadata,
  onAdd,
  onRemove,
}: {
  photos: PhotoAttachment[];
  compact?: boolean;
  actionLabel?: string;
  captureCamera?: boolean;
  metadata?: Pick<PhotoAttachment, "componentId" | "imageType" | "checklistItemId" | "ocrCandidate">;
  onAdd: (photos: PhotoAttachment[]) => void;
  onRemove: (photoId: string) => void;
}) {
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    const selectedImages = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    const images = selectedImages.slice(0, 3);
    if (!images.length) return;

    try {
      const remainingSlots = Math.max(0, 6 - photos.length);
      if (!remainingSlots) {
        setError("Max 6 bilder per fråga/rad.");
        return;
      }
      const nextPhotos = await Promise.all(images.slice(0, remainingSlots).map((file) => imageFileToAttachment(file, metadata)));
      onAdd(nextPhotos);
      setError(
        selectedImages.length > images.length || images.length > remainingSlots
          ? "Max 3 bilder per uppladdning och 6 per fråga/rad. Bilder komprimeras för iPad."
          : "Bilderna komprimerades innan sparning.",
      );
    } catch {
      setError("Bilden kunde inte läsas in.");
    }
  }

  return (
    <div className={`photoUploader ${compact ? "compact" : ""}`}>
      <div className="photoActions">
        <span>Bilder</span>
        <label>
          {actionLabel}
          <input
            accept="image/*"
            capture={captureCamera ? "environment" : undefined}
            multiple={!captureCamera}
            onChange={(event) => handleFiles(event.target.files)}
            type="file"
          />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="photoPreviewGrid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              {photo.dataUrl ? <img alt={photo.name || "Komponentbild"} src={photo.dataUrl} /> : <div className="storedPhotoPlaceholder">Sparad bild</div>}
              <figcaption>{photo.name || "Bild"}</figcaption>
              <button onClick={() => onRemove(photo.id)} type="button">Ta bort</button>
            </figure>
          ))}
        </div>
      )}
      {error && <small>{error}</small>}
    </div>
  );
}

const signatureRoles: SignatureRole[] = ["Kund", "Montör", "Fastighetsägare", "Representant"];

function SignaturePad({
  title,
  defaultName,
  defaultRole,
  currentHash,
  signature,
  onChange,
  onRemove,
}: {
  title: string;
  defaultName: string;
  defaultRole: SignatureRole;
  currentHash: string;
  signature?: SignatureEntry;
  onChange: (signature: SignatureEntry) => void;
  onRemove: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [signedBy, setSignedBy] = useState(signature?.signedBy || defaultName);
  const [role, setRole] = useState<SignatureRole>(signature?.role || defaultRole);
  const [editing, setEditing] = useState(false);
  const isValid = Boolean(signature?.imageDataUrl && signature.signedHash === currentHash);
  const hasSavedSignature = Boolean(signature?.imageDataUrl);

  function canvasContext() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    return { canvas, context };
  }

  function drawBackground() {
    const state = canvasContext();
    if (!state) return;
    const { canvas, context } = state;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f7faf9";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#9fb6ba";
    context.lineWidth = Math.max(1, canvas.width * 0.002);
    context.beginPath();
    context.moveTo(canvas.width * 0.08, canvas.height * 0.72);
    context.lineTo(canvas.width * 0.92, canvas.height * 0.72);
    context.stroke();
  }

  function drawSavedSignature() {
    drawBackground();
    if (!signature?.imageDataUrl || editing) return;
    const state = canvasContext();
    if (!state) return;
    const image = new Image();
    image.onload = () => {
      state.context.drawImage(image, 0, 0, state.canvas.width, state.canvas.height);
    };
    image.src = signature.imageDataUrl;
  }

  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      const wrapper = canvas?.parentElement;
      if (!canvas || !wrapper) return;
      const width = Math.max(320, Math.min(860, Math.round(wrapper.clientWidth)));
      const height = Math.max(180, Math.round(width * 0.28));
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (context) {
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#051014";
        context.lineWidth = Math.max(3, canvas.width * 0.006);
      }
      drawSavedSignature();
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", resizeCanvas);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("orientationchange", resizeCanvas);
    };
  }, [signature?.imageDataUrl, editing]);

  useEffect(() => {
    if (!signature?.signedBy) setSignedBy(defaultName);
  }, [defaultName, signature?.signedBy]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas?.setPointerCapture(event.pointerId);
    if (!editing && !hasSavedSignature) drawBackground();
    drawingRef.current = true;
    lastPointRef.current = point(event);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const state = canvasContext();
    const last = lastPointRef.current;
    if (!state || !last) return;
    const next = point(event);
    state.context.beginPath();
    state.context.moveTo(last.x, last.y);
    state.context.lineTo(next.x, next.y);
    state.context.stroke();
    lastPointRef.current = next;
  }

  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    canvas?.releasePointerCapture(event.pointerId);
    if (!canvas) return;
    onChange({
      id: signature?.id || crypto.randomUUID(),
      label: title,
      signedBy: signedBy || defaultName || "Ej angivet",
      role,
      signedAt: new Date().toISOString(),
      imageDataUrl: canvas.toDataURL("image/png"),
      signedHash: currentHash,
    });
    setEditing(false);
  }

  function updateSignerName(value: string) {
    setSignedBy(value);
    if (signature?.imageDataUrl) onChange({ ...signature, signedBy: value, signedHash: "" });
  }

  function updateRole(value: SignatureRole) {
    setRole(value);
    if (signature?.imageDataUrl) onChange({ ...signature, role: value, signedHash: "" });
  }

  function resign() {
    setEditing(true);
    window.setTimeout(drawBackground, 0);
  }

  function clearSignature() {
    if (!window.confirm("Rensa sparad signatur? Tidigare signatur tas bort från utkastet.")) return;
    drawBackground();
    onRemove();
    setEditing(false);
  }

  return (
    <article className={`signatureCard ${isValid ? "signed" : hasSavedSignature ? "invalid" : ""}`}>
      <header>
        <div>
          <span>Signatur</span>
          <strong>{title}</strong>
          <small>Signera med finger eller mus</small>
        </div>
        <b>{isValid ? "Signerad" : hasSavedSignature ? "Kräver ny signering" : "Ej signerad"}</b>
      </header>
      <div className="signatureMeta">
        <label>
          Namn
          <input value={signedBy} onChange={(event) => updateSignerName(event.target.value)} />
        </label>
        <label>
          Roll
          <select value={role} onChange={(event) => updateRole(event.target.value as SignatureRole)}>
            {signatureRoles.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <div className="signatureCanvasWrap">
        <canvas
          aria-label={`${title} signaturfält`}
          onPointerCancel={end}
          onPointerDown={begin}
          onPointerLeave={end}
          onPointerMove={move}
          onPointerUp={end}
          ref={canvasRef}
        />
      </div>
      {signature?.signedAt ? (
        <small>
          Senast signerad {new Date(signature.signedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
          {!isValid ? " · uppgifter har ändrats efter signering" : ""}
        </small>
      ) : null}
      <div className="signatureActions">
        <button onClick={resign} type="button">Signera om</button>
        <button disabled={!hasSavedSignature} onClick={clearSignature} type="button">Rensa signatur</button>
      </div>
    </article>
  );
}

function dedupeProducts(products: ProductOption[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function apiProductToOption(product: Partial<ProductOption> & {
  supplierProducts?: { latestPrice?: { price?: number | null } | null }[];
}): ProductOption {
  return {
    id: String(product.id ?? ""),
    category: String(product.category ?? "Övrigt"),
    manufacturer: String(product.manufacturer ?? ""),
    rskNumber: String(product.rskNumber ?? ""),
    productName: String(product.productName ?? ""),
    modelName: String(product.modelName ?? product.productName ?? ""),
    unit: String(product.unit ?? "st"),
    systemType: String(product.systemType ?? ""),
    technicalData: String(product.technicalData ?? ""),
    expectedLifetimeMinYears: product.expectedLifetimeMinYears ?? null,
    expectedLifetimeMaxYears: product.expectedLifetimeMaxYears ?? null,
    replacementPriceMinSek: product.replacementPriceMinSek ?? null,
    replacementPriceMaxSek: product.replacementPriceMaxSek ?? null,
    latestSupplierPrice: product.supplierProducts?.find((supplierProduct) => supplierProduct.latestPrice?.price)?.latestPrice?.price ?? null,
    sourceUrl: String(product.sourceUrl ?? ""),
    manualUrl: String(product.manualUrl ?? ""),
    wiringDiagramUrl: String(product.wiringDiagramUrl ?? ""),
    dataQuality: String(product.dataQuality ?? "supplier_source"),
    supplierProducts: product.supplierProducts as ProductOption["supplierProducts"],
  };
}

function ComponentRegisterTable({
  rows,
  products,
  onChange,
}: {
  rows: ComponentRegisterRow[];
  products: ProductOption[];
  onChange: (rows: ComponentRegisterRow[]) => void;
}) {
  const [remoteProductsByRow, setRemoteProductsByRow] = useState<Record<number, ProductOption[]>>({});

  function updateRow(index: number, key: keyof ComponentRegisterRow, value: string) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function addRowPhotos(index: number, photos: PhotoAttachment[]) {
    onChange(rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, photos: [...(row.photos ?? []), ...photos].slice(0, 6) } : row
    )));
  }

  function removeRowPhoto(index: number, photoId: string) {
    onChange(rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, photos: (row.photos ?? []).filter((photo) => photo.id !== photoId) } : row
    )));
  }

  const categories = Array.from(new Set([
    ...products.map((product) => product.category),
    "Värmesystem",
    "Tappvatten",
    "Sanitet",
    "Avlopp",
    "El & styr",
  ])).sort((a, b) => a.localeCompare(b, "sv"));

  function manufacturersFor(category: string) {
    return Array.from(new Set(products
      .filter((product) => !category || product.category === category)
      .map((product) => product.manufacturer)))
      .sort((a, b) => a.localeCompare(b, "sv"));
  }

  function productsFor(row: ComponentRegisterRow) {
    return productsForRow(row, -1);
  }

  function productsForRow(row: ComponentRegisterRow, index: number) {
    const query = `${row.model}`.trim().toLowerCase();
    const combinedProducts = dedupeProducts([
      ...products,
      ...(remoteProductsByRow[index] ?? []),
    ]);

    return combinedProducts
      .filter((product) => (!row.category || product.category === row.category) && (!row.brand || product.manufacturer === row.brand))
      .filter((product) => {
        if (!query) return true;
        const supplierText = product.supplierProducts
          ?.map((supplierProduct) => `${supplierProduct.supplierArticleNumber} ${supplierProduct.rskNumber ?? ""} ${supplierProduct.supplierName} ${supplierProduct.calculationGroup ?? ""}`)
          .join(" ") ?? "";
        const text = `${product.manufacturer} ${product.modelName} ${product.productName} ${product.rskNumber} ${supplierText}`.toLowerCase();
        return text.includes(query) || query.split(/\s+/).some((part) => text.includes(part));
      })
      .slice(0, 80);
  }

  function productPrice(product: ProductOption) {
    const min = product.replacementPriceMinSek;
    const max = product.replacementPriceMaxSek;
    if (!min && !max) return product.latestSupplierPrice ? String(Math.round(product.latestSupplierPrice)) : "";
    if (min && max && min !== max) return String(Math.round((min + max) / 2));
    return String(min ?? max ?? product.latestSupplierPrice ?? "");
  }

  function selectProduct(index: number, productId: string) {
    const product = productsForRow(rows[index], index).find((item) => item.id === productId)
      ?? products.find((item) => item.id === productId)
      ?? Object.values(remoteProductsByRow).flat().find((item) => item.id === productId);
    if (!product) {
      updateRow(index, "productModelId", "");
      return;
    }

    onChange(rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      return {
        ...row,
        productModelId: product.id,
        typeName: row.typeName || product.category,
        category: product.category,
        brand: row.brand || product.manufacturer,
        model: row.model || product.productName || product.modelName,
        systemName: row.systemName || product.technicalData || product.systemType,
        costKr: row.costKr || productPrice(product),
      };
    }));
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      rows.forEach((row, index) => {
        const query = row.model.trim();
        if (query.length < 2) return;

        fetch(`/api/products?q=${encodeURIComponent(query)}&take=30`, { signal: controller.signal })
          .then((response) => response.ok ? response.json() : { products: [] })
          .then((data) => {
            const remoteProducts = Array.isArray(data.products) ? data.products.map(apiProductToOption) : [];
            setRemoteProductsByRow((current) => ({ ...current, [index]: remoteProducts }));
          })
          .catch((error) => {
            if ((error as Error).name !== "AbortError") {
              setRemoteProductsByRow((current) => ({ ...current, [index]: [] }));
            }
          });
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [rows.map((row) => row.model).join("|")]);

  return (
    <div className="componentFormTable">
      <div className="componentFormHead">
        <span>#</span>
        <span>Komponent</span>
        <span>System</span>
        <span>Kategori</span>
        <span>Fabrikat</span>
        <span>Modell</span>
        <span>Produktval</span>
        <span>Serie/ID</span>
        <span>År</span>
        <span>Status</span>
        <span>Byte år</span>
        <span>Period</span>
        <span>Kostnad</span>
        <span>Bilder</span>
      </div>
      {rows.map((row, index) => (
        <div className="componentFormRow" key={index}>
          <b>{index + 1}</b>
          <input value={row.typeName ?? ""} onChange={(event) => updateRow(index, "typeName", event.target.value)} />
          <input value={row.systemName ?? ""} onChange={(event) => updateRow(index, "systemName", event.target.value)} />
          <select value={row.category ?? ""} onChange={(event) => updateRow(index, "category", event.target.value)}>
            <option value="">Annan/okänd</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <input list={`manufacturers-${index}`} value={row.brand ?? ""} onChange={(event) => updateRow(index, "brand", event.target.value)} />
          <datalist id={`manufacturers-${index}`}>
            {manufacturersFor(row.category).map((manufacturer) => <option key={manufacturer} value={manufacturer} />)}
          </datalist>
          <input
            list={`models-${index}`}
            value={row.model ?? ""}
            onChange={(event) => updateRow(index, "model", event.target.value)}
            placeholder="Sök modell"
          />
          <datalist id={`models-${index}`}>
            {productsForRow(row, index).map((product) => (
              <option key={product.id} value={product.productName || product.modelName}>
                {product.rskNumber ? `RSK ${product.rskNumber} - ` : ""}{product.manufacturer}
              </option>
            ))}
            <option value="Annan/okänd modell" />
          </datalist>
          <select value={row.productModelId ?? ""} onChange={(event) => selectProduct(index, event.target.value)}>
            <option value="">Annan/okänd modell</option>
            {productsForRow(row, index).map((product) => (
              <option key={product.id} value={product.id}>
                {product.rskNumber ? `RSK ${product.rskNumber} - ` : ""}{product.productName || product.modelName}
              </option>
            ))}
          </select>
          <input value={row.serialNo ?? ""} onChange={(event) => updateRow(index, "serialNo", event.target.value)} />
          <input value={row.installedYear ?? ""} onChange={(event) => updateRow(index, "installedYear", event.target.value)} type="number" />
          <select value={row.status ?? ""} onChange={(event) => updateRow(index, "status", event.target.value)}>
            <option value="">Ej valt</option>
            <option>OK</option>
            <option>Avvikelse</option>
            <option>Medel</option>
            <option>Hög</option>
            <option>Akut</option>
          </select>
          <input value={row.replacementYear ?? ""} onChange={(event) => updateRow(index, "replacementYear", event.target.value)} placeholder="2030" type="number" />
          <input value={row.replacementPeriod ?? ""} onChange={(event) => updateRow(index, "replacementPeriod", event.target.value)} placeholder="februari-mars" />
          <input value={row.costKr ?? ""} onChange={(event) => updateRow(index, "costKr", event.target.value)} type="number" />
          <PhotoUploader
            compact
            photos={row.photos ?? []}
            onAdd={(photos) => addRowPhotos(index, photos)}
            onRemove={(photoId) => removeRowPhoto(index, photoId)}
          />
        </div>
      ))}
    </div>
  );
}

function statusLabel(status: ImageChecklistStatus, imageCount: number, item: ImageChecklistItem) {
  if (isImageChecklistItemComplete(status, imageCount, item.imageType)) {
    if (status === "DONE") return "Klar";
    if (status === "NO_VISIBLE_NAMEPLATE") return "Ingen synlig typskylt";
    if (status === "NOT_ACCESSIBLE") return "Ej åtkomlig";
    if (status === "NOT_APPLICABLE") return "Ej tillämpligt";
  }
  return "Saknas";
}

function ImageChecklistPanel({
  items,
  statuses,
  answers,
  onStatusChange,
  onAddPhotos,
  onRemovePhoto,
  onJump,
}: {
  items: ImageChecklistItem[];
  statuses: ImageChecklistStatusMap;
  answers: Answers;
  onStatusChange: (itemId: string, status: ImageChecklistStatus) => void;
  onAddPhotos: (item: ImageChecklistItem, photos: PhotoAttachment[]) => void;
  onRemovePhoto: (item: ImageChecklistItem, photoId: string) => void;
  onJump: (sectionId: number, itemId?: string) => void;
}) {
  if (!items.length) {
    return (
      <section className="portalPanel imageChecklistPanel" id="image-checklist">
        <div className="panelTitle">
          <h3>Bildchecklista</h3>
          <span>0 punkter</span>
        </div>
        <p>Checklistan fylls automatiskt när komponenter och installationer registreras i formuläret.</p>
      </section>
    );
  }

  return (
    <section className="portalPanel imageChecklistPanel" id="image-checklist">
      <div className="panelTitle">
        <h3>Bildchecklista</h3>
        <span>{items.length} punkter</span>
      </div>
      <p>Skapas automatiskt från registrerade installationer. Typskyltar markeras för framtida OCR.</p>
      <div className="imageChecklistGrid">
        {items.map((item) => {
          const photosKey = `${item.id}__photos`;
          const photos = photoArray(answers[photosKey]);
          const status = getImageChecklistStatus(statuses, item.id);
          const complete = isImageChecklistItemComplete(status, photos.length, item.imageType);

          return (
            <article
              className={`imageChecklistCard ${complete ? "complete" : ""} ${item.level === "REQUIRED" ? "required" : "recommended"}`}
              id={`image-item-${item.id}`}
              key={item.id}
            >
              <header>
                <div>
                  <span>{item.level === "REQUIRED" ? "Obligatorisk" : "Rekommenderad"}</span>
                  <strong>{item.title}</strong>
                  <small>{item.reason}</small>
                </div>
                <b>{statusLabel(status, photos.length, item)}</b>
              </header>
              <label>
                Status
                <select value={status} onChange={(event) => onStatusChange(item.id, event.target.value as ImageChecklistStatus)}>
                  <option value="MISSING">Saknas</option>
                  <option value="DONE">Bild tagen</option>
                  {item.imageType === "NAMEPLATE" ? <option value="NO_VISIBLE_NAMEPLATE">Ingen synlig typskylt</option> : null}
                  <option value="NOT_ACCESSIBLE">Ej åtkomlig</option>
                  <option value="NOT_APPLICABLE">Ej tillämpligt</option>
                </select>
              </label>
              <PhotoUploader
                actionLabel={photos.length ? "Ta om / lägg till" : "Ta bild"}
                captureCamera
                compact
                metadata={{
                  checklistItemId: item.id,
                  componentId: item.componentId,
                  imageType: item.imageType,
                  ocrCandidate: item.imageType === "NAMEPLATE",
                }}
                photos={photos}
                onAdd={(nextPhotos) => onAddPhotos(item, nextPhotos)}
                onRemove={(photoId) => onRemovePhoto(item, photoId)}
              />
              <button className="textButton" onClick={() => onJump(25, item.id)} type="button">
                Gå till bildpunkt
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ExistingPhotosPanel({ answers, sections }: { answers: Answers; sections: RvmSection[] }) {
  const fieldLabels = new Map(
    sections.flatMap((section) => section.fields.map((field) => [field.key, `${section.id}. ${field.label}`] as const)),
  );
  const photos: Array<{ id: string; title: string; photo: PhotoAttachment }> = [];

  for (const [key, value] of Object.entries(answers)) {
    if (key === "component_register_rows" && Array.isArray(value)) {
      (value as ComponentRegisterRow[]).forEach((row, rowIndex) => {
        for (const photo of row.photos ?? []) {
          photos.push({
            id: `component-${rowIndex}-${photo.id}`,
            title: [row.typeName, row.brand, row.model].filter(Boolean).join(" ") || `Komponentrad ${rowIndex + 1}`,
            photo,
          });
        }
      });
      continue;
    }

    if (!key.endsWith("__photos")) continue;
    const itemPhotos = photoArray(value);
    if (!itemPhotos.length) continue;
    const fieldKey = key.replace(/__photos$/, "");
    const title = fieldLabels.get(fieldKey) ?? "Bildchecklista";
    itemPhotos.forEach((photo) => photos.push({ id: `${key}-${photo.id}`, title, photo }));
  }

  if (!photos.length) {
    return (
      <section className="existingPhotosPanel">
        <div className="panelTitle">
          <h3>Befintliga bilder</h3>
          <span>0 bilder</span>
        </div>
        <p>Uppladdade bilder från formuläret visas här när de finns sparade.</p>
      </section>
    );
  }

  return (
    <section className="existingPhotosPanel">
      <div className="panelTitle">
        <h3>Befintliga bilder</h3>
        <span>{photos.length} bilder</span>
      </div>
      <div className="existingPhotosGrid">
        {photos.map(({ id, title, photo }) => (
          <figure key={id}>
            {photo.dataUrl ? <img alt={photo.name || title} src={photo.dataUrl} /> : <div className="storedPhotoPlaceholder">Sparad bild</div>}
            <figcaption>
              <strong>{title}</strong>
              <small>{photo.imageType === "NAMEPLATE" ? "Typskylt / OCR" : photo.name || "Bild"}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function HusstatusFormView({
  databaseOnline,
  properties,
  products,
  sections,
  fieldCount,
  initialPropertyId,
  initialAnswers = {},
  initialStatus = "NOT_STARTED",
}: {
  databaseOnline: boolean;
  properties: PropertyOption[];
  products: ProductOption[];
  sections: RvmSection[];
  fieldCount: number;
  initialPropertyId?: string;
  initialAnswers?: Record<string, unknown>;
  initialStatus?: string;
}) {
  const [propertyId, setPropertyId] = useState(initialPropertyId || properties[0]?.id || "");
  const reportUrl = propertyId ? `/husrapport?propertyId=${propertyId}` : "/husrapport";
  const [answers, setAnswers] = useState<Answers>(initialAnswers as Answers);
  const [registerPaste, setRegisterPaste] = useState(String(initialAnswers.component_register ?? ""));
  const [activeSection, setActiveSection] = useState(1);
  const [message, setMessage] = useState(
    databaseOnline ? "Formuläret autosparas som utkast i databasen." : "Databasen är offline. Formulär kan inte slutföras.",
  );
  const [reviewMode, setReviewMode] = useState<"NONE" | "WARNING" | "BLOCKED" | "READY">("NONE");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydratedRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const storageKey = `rvm-husstatus-draft-${propertyId || "none"}`;

  const answeredCount = useMemo(
    () => Object.entries(answers).filter(([key, value]) =>
      key !== "section_statuses"
      && key !== "image_checklist_statuses"
      && !answerBelongsToInactiveSection(key, sections, answers)
      && hasValue(value),
    ).length,
    [answers, sections],
  );
  const saveableCount = useMemo(() => Object.values(answers).filter(hasValue).length, [answers]);
  const activeFieldCount = useMemo(
    () => sections.filter((item) => isSectionActive(answers, item.id)).reduce((count, item) => count + item.fields.length, 0),
    [answers, sections],
  );
  const inactiveSectionCount = useMemo(
    () => sections.filter((item) => !isSectionActive(answers, item.id)).length,
    [answers, sections],
  );
  const progress = Math.min(100, Math.round((answeredCount / Math.max(activeFieldCount, 1)) * 100));
  const formButtonLabel =
    initialStatus === "SUBMITTED"
      ? "Visa formulärunderlag"
      : answeredCount > 0
        ? `Fortsätt formulär - ${progress} % klart`
        : "Fyll i formulär";
  const section = sections.find((item) => item.id === activeSection) ?? sections[0];
  const activeSectionStatus = sectionStatusFor(answers, section.id);
  const activeSectionIsNotApplicable = activeSectionStatus === "not_applicable";
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const currentSignatureHash = useMemo(() => reportSignatureHash(answers, sections), [answers, sections]);
  const savedSignatures = signatures(answers.signatures);
  const imageChecklist = useMemo(() => buildImageChecklist(answers), [answers]);
  const imageStatuses = checklistStatuses(answers.image_checklist_statuses);
  const imageCountForItem = (itemId: string) => photoArray(answers[`${itemId}__photos`]).length;
  const imageSummary = useMemo(
    () => summarizeImageChecklist(imageChecklist, imageStatuses, imageCountForItem),
    [answers, imageChecklist, imageStatuses],
  );

  function savedTimeLabel(date = new Date()) {
    return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }

  async function saveDraftNow() {
    if (!propertyId || saveableCount === 0) {
      setMessage(saveableCount === 0 ? "Inget är ifyllt ännu." : "Välj fastighet först.");
      return false;
    }

    const payload = JSON.stringify(answers);
    window.localStorage.setItem(storageKey, payload);

    if (!databaseOnline) {
      lastSavedPayloadRef.current = payload;
      const time = savedTimeLabel();
      setLastSavedAt(time);
      setMessage(`Sparat lokalt kl ${time}. Databasen krävs för att slutföra rapporten.`);
      return true;
    }

    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("answers", payload);
    const result = await autosaveHusstatusDraftAction(formData);
    if (result.ok) {
      lastSavedPayloadRef.current = payload;
      const time = savedTimeLabel();
      setLastSavedAt(time);
      setMessage(`Sparat kl ${time}.`);
      return true;
    }
    setMessage(`${result.message} Utkastet finns sparat lokalt i den här webbläsaren.`);
    return false;
  }

  useEffect(() => {
    if (!propertyId) return;
    const saved = window.localStorage.getItem(storageKey);
    const loadedAnswers = lightenStoredPhotos(saved ? JSON.parse(saved) : initialAnswers) as Answers;
    const nextAnswers = selectedProperty
      ? mergeAutofillAnswers(loadedAnswers, propertyAutofillAnswers(selectedProperty))
      : loadedAnswers;
    const loadedPayload = JSON.stringify(loadedAnswers);
    const nextPayload = JSON.stringify(nextAnswers);
    setAnswers(nextAnswers);
    setRegisterPaste(String(nextAnswers.component_register ?? ""));
    window.localStorage.setItem(storageKey, nextPayload);
    lastSavedPayloadRef.current = loadedPayload === nextPayload ? nextPayload : loadedPayload;
    hydratedRef.current = true;
  }, [propertyId, storageKey, initialAnswers, selectedProperty]);

  useEffect(() => {
    if (!propertyId || !hydratedRef.current) return;
    const payload = JSON.stringify(answers);
    window.localStorage.setItem(storageKey, payload);

    if (!databaseOnline || saveableCount === 0 || payload === lastSavedPayloadRef.current) return;
    const timer = window.setTimeout(() => {
      const formData = new FormData();
      formData.set("propertyId", propertyId);
      formData.set("answers", payload);
      startTransition(async () => {
        const result = await autosaveHusstatusDraftAction(formData);
        if (result.ok) {
          lastSavedPayloadRef.current = payload;
          const time = savedTimeLabel();
          setLastSavedAt(time);
          setMessage(`Sparat kl ${time}.`);
          return;
        }
        setMessage(result.message);
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [answers, saveableCount, databaseOnline, propertyId, storageKey]);

  function setStructuredAnswer(key: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function setSectionStatus(sectionId: number, status: SectionStatus) {
    setAnswers((current) => ({
      ...current,
      section_statuses: {
        ...sectionStatuses(current.section_statuses),
        [String(sectionId)]: status,
      },
    }));
    setMessage(status === "not_applicable" ? "Sektionen är markerad som finns ej. Tidigare svar behålls." : "Sektionen är aktiv igen. Tidigare svar visas.");
  }

  function setSignature(signatureKey: string, signature: SignatureEntry) {
    setAnswers((current) => ({
      ...current,
      signatures: {
        ...signatures(current.signatures),
        [signatureKey]: signature,
      },
    }));
  }

  function removeSignature(signatureKey: string) {
    setAnswers((current) => {
      const next = { ...signatures(current.signatures) };
      delete next[signatureKey];
      return { ...current, signatures: next };
    });
  }

  function parseRegisterPaste() {
    const rows = parseComponentRegisterText(registerPaste);
    setAnswers((current) => ({
      ...current,
      component_register: registerPaste,
      component_register_rows: rows,
    }));
    setActiveSection(19);
    setMessage("Registret är tolkat till komponentrader. Kontrollera raderna och spara.");
  }

  function autofillCustomerInfo() {
    if (!selectedProperty) {
      setMessage("Välj en fastighet först.");
      return;
    }
    const autofill = propertyAutofillAnswers(selectedProperty);
    setAnswers((current) => mergeAutofillAnswers(current, autofill));
    setActiveSection(1);
    setMessage("Kund- och fastighetsinfo är ifylld från registret utan att skriva över befintliga svar.");
  }

  function addFieldPhotos(key: string, photos: PhotoAttachment[]) {
    setAnswers((current) => ({
      ...current,
      [key]: [...photoArray(current[key]), ...photos].slice(0, 6),
    }));
  }

  function removeFieldPhoto(key: string, photoId: string) {
    setAnswers((current) => ({
      ...current,
      [key]: photoArray(current[key]).filter((photo) => photo.id !== photoId),
    }));
  }

  function setImageChecklistStatus(itemId: string, status: ImageChecklistStatus) {
    setAnswers((current) => ({
      ...current,
      image_checklist_statuses: {
        ...checklistStatuses(current.image_checklist_statuses),
        [itemId]: status,
      },
    }));
  }

  function addChecklistPhotos(item: ImageChecklistItem, photos: PhotoAttachment[]) {
    const photosKey = `${item.id}__photos`;
    setAnswers((current) => ({
      ...current,
      [photosKey]: [...photoArray(current[photosKey]), ...photos].slice(0, 6),
      image_checklist_statuses: {
        ...checklistStatuses(current.image_checklist_statuses),
        [item.id]: "DONE",
      },
    }));
  }

  function removeChecklistPhoto(item: ImageChecklistItem, photoId: string) {
    const photosKey = `${item.id}__photos`;
    setAnswers((current) => {
      const nextPhotos = photoArray(current[photosKey]).filter((photo) => photo.id !== photoId);
      const statuses = checklistStatuses(current.image_checklist_statuses);
      return {
        ...current,
        [photosKey]: nextPhotos,
        image_checklist_statuses: {
          ...statuses,
          [item.id]: nextPhotos.length ? statuses[item.id] ?? "DONE" : "MISSING",
        },
      };
    });
  }

  function jumpToSection(sectionId: number, itemId?: string) {
    setActiveSection(sectionId);
    window.setTimeout(() => {
      const target = itemId ? document.getElementById(`image-item-${itemId}`) : document.querySelector(".formSection");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  function goToMissingImages() {
    const firstMissing = imageSummary.missingRequired[0] ?? imageSummary.missingRecommended[0];
    if (firstMissing) jumpToSection(25, firstMissing.id);
  }

  function saveReview(force = false) {
    if (!force && imageSummary.missingRecommended.length > 0) {
      setReviewMode("WARNING");
      setMessage(`Bilddokumentationen är inte komplett. ${imageSummary.missingRecommended.length} rekommenderade bilder saknas.`);
      return;
    }
    setReviewMode("READY");
    saveNow();
  }

  function complete() {
    if (imageSummary.missingRequired.length > 0) {
      setReviewMode("BLOCKED");
      setMessage(`Genomgången kan inte slutföras. ${imageSummary.missingRequired.length} obligatoriska bildpunkter återstår.`);
      return;
    }
    setReviewMode("READY");
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("answers", JSON.stringify(answers));

    startTransition(async () => {
      const result = await completeHusstatusFormAction(formData);
      setMessage(result.message);
      if (result.ok) window.localStorage.removeItem(storageKey);
    });
  }

  function saveNow() {
    startTransition(async () => {
      await saveDraftNow();
    });
  }

  function changeProperty(nextPropertyId: string) {
    if (!nextPropertyId || nextPropertyId === propertyId) return;
    setPropertyId(nextPropertyId);
    hydratedRef.current = false;
    lastSavedPayloadRef.current = "";
    const url = new URL(window.location.href);
    url.searchParams.set("propertyId", nextPropertyId);
    window.location.href = url.toString();
  }

  function previewReport() {
    startTransition(async () => {
      const saved = await saveDraftNow();
      if (saved || answeredCount === 0) window.location.href = reportUrl;
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">RVM Husstatus digitalt formulär</p>
          <h1>25 avsnitt enligt ert formulärunderlag.</h1>
          <p>
            Formuläret skiljer kunduppgifter från RVM-mätningar, sparar originalsvaret som submission och
            fyller husrapportens grunddata deterministiskt.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
            {lastSavedAt && !isPending ? <small>Senast sparat kl {lastSavedAt}</small> : null}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/report-import">Importera PDF</a>
          <button className="buttonLink" disabled={isPending || !databaseOnline} onClick={previewReport} type="button">Förhandsgranska rapport</button>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Avsnitt</span>
          <strong>{sections.length}</strong>
          <small>Enligt specifikationen</small>
        </article>
        <article className="portalPanel">
          <span>Fält</span>
          <strong>{activeFieldCount}</strong>
          <small>{inactiveSectionCount} sektioner finns ej</small>
        </article>
        <article className="portalPanel">
          <span>Besvarade</span>
          <strong>{answeredCount}</strong>
          <small>{progress} % klart</small>
        </article>
        <article className="portalPanel">
          <span>Status</span>
          <strong>{initialStatus === "SUBMITTED" ? "Slutfört" : answeredCount > 0 ? "Utkast" : "Inte påbörjat"}</strong>
          <small>Prisma submission</small>
        </article>
        <article className={`portalPanel ${imageSummary.missingRequired.length ? "needsAttention" : ""}`}>
          <span>Bilder</span>
          <strong>{imageSummary.complete}/{imageSummary.total}</strong>
          <small>{imageSummary.imageProgress} % klart · {imageSummary.missingRequired.length} obligatoriska saknas</small>
        </article>
      </section>

      <section className="portalPanel formToolbar">
        <label>
          Fastighet
          <select disabled={isPending} value={propertyId} onChange={(event) => changeProperty(event.target.value)}>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setActiveSection(1)}>{formButtonLabel}</button>
        <button disabled={!propertyId} onClick={autofillCustomerInfo} type="button">Autofyll kundinfo</button>
        <button disabled={isPending || saveableCount === 0} onClick={saveNow} type="button">Spara utkast</button>
        <button disabled={isPending || saveableCount === 0} onClick={() => saveReview()} type="button">Spara genomgång</button>
        <button disabled={isPending || !databaseOnline} onClick={previewReport} type="button">Förhandsgranska rapport</button>
        <button disabled={!databaseOnline || isPending || !propertyId} onClick={complete}>
          Slutför och skapa husrapport
        </button>
      </section>

      {reviewMode !== "NONE" ? (
        <section className={`portalPanel completionReview ${reviewMode.toLowerCase()}`}>
          <div>
            <span>Slutkontroll</span>
            <strong>
              {reviewMode === "BLOCKED"
                ? "Genomgången kan inte slutföras"
                : reviewMode === "WARNING"
                  ? "Bilddokumentationen är inte komplett"
                  : "Redo att spara"}
            </strong>
            <small>Formulär: {progress} % · Bilder: {imageSummary.complete}/{imageSummary.total}</small>
          </div>
          <div className="completionLists">
            {imageSummary.missingRequired.length > 0 ? (
              <div>
                <b>Saknas obligatoriskt</b>
                {imageSummary.missingRequired.slice(0, 8).map((item) => (
                  <button key={item.id} onClick={() => jumpToSection(25, item.id)} type="button">{item.title}</button>
                ))}
              </div>
            ) : (
              <div><b>Klart</b><span>Obligatoriska bildpunkter är hanterade.</span></div>
            )}
            {imageSummary.missingRecommended.length > 0 ? (
              <div>
                <b>Rekommenderas</b>
                {imageSummary.missingRecommended.slice(0, 8).map((item) => (
                  <button key={item.id} onClick={() => jumpToSection(25, item.id)} type="button">{item.title}</button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="portalActions">
            <button className="buttonLink" onClick={goToMissingImages} type="button">Gå till saknade bilder</button>
            {reviewMode === "WARNING" ? <button className="buttonLink" onClick={() => saveReview(true)} type="button">Spara ändå</button> : null}
          </div>
        </section>
      ) : null}

      <section className="husstatusFormShell">
        <nav className="formSectionNav" aria-label="Formuläravsnitt">
          {sections.map((item) => {
            const itemIsActive = isSectionActive(answers, item.id);
            const sectionDone = item.fields.some((field) => hasValue(answers[field.key]));
            return (
              <button className={`${item.id === activeSection ? "active" : ""} ${!itemIsActive ? "notApplicable" : ""}`} key={item.id} onClick={() => setActiveSection(item.id)}>
                <b>{item.id}</b>
                <span>{item.title}</span>
                {!itemIsActive ? <em>Finns ej</em> : sectionDone && <i />}
              </button>
            );
          })}
        </nav>

        <article className="portalPanel formSection">
          <div className="panelTitle">
            <h3>{section.id}. {section.title}{activeSectionIsNotApplicable ? " - Finns ej" : ""}</h3>
            <span>{activeSectionIsNotApplicable ? "Finns ej i fastigheten" : `${section.fields.length} fält`}</span>
          </div>
          <p>{section.description}</p>
          <div className="sectionApplicability">
            <strong>{section.title}</strong>
            <div role="group" aria-label="Sektionen finns i fastigheten">
              <button
                className={activeSectionStatus === "active" ? "selected" : ""}
                onClick={() => setSectionStatus(section.id, "active")}
                type="button"
              >
                ✓ Finns
              </button>
              <button
                className={activeSectionStatus === "not_applicable" ? "selected" : ""}
                onClick={() => setSectionStatus(section.id, "not_applicable")}
                type="button"
              >
                ○ Finns ej
              </button>
            </div>
          </div>
          {activeSectionIsNotApplicable ? (
            <div className="notApplicableNotice">
              <strong>{section.title} finns ej i fastigheten.</strong>
              <span>Fälten, bildkraven och valideringen för den här sektionen hoppas över. Tidigare svar och bilder finns kvar om du väljer Finns igen.</span>
            </div>
          ) : section.id === 19 ? (
            <>
              <div className="registerPasteBox">
                <label>
                  <span>Klistra in register från värmepump/underlag</span>
                  <textarea
                    value={registerPaste}
                    onChange={(event) => {
                      setRegisterPaste(event.target.value);
                      setStructuredAnswer("component_register", event.target.value);
                    }}
                    placeholder={"Värmepump\tNIBE F1245-8\t8 kW / 180 l\tNIBE-1245-1608742\t2016\tGod"}
                    rows={6}
                  />
                </label>
                <button type="button" onClick={parseRegisterPaste}>Tolka till komponentrader</button>
              </div>
              <ComponentRegisterTable
                rows={Array.isArray(answers.component_register_rows) ? answers.component_register_rows as ComponentRegisterRow[] : emptyComponentRows}
                products={products}
                onChange={(rows) => setStructuredAnswer("component_register_rows", rows)}
              />
            </>
          ) : (
            <>
            <div className="rvmFieldGrid">
              {section.fields.map((field) => {
                const photosKey = `${field.key}__photos`;
                const photos = photoArray(answers[photosKey]);
                const canAttachPhotos = fieldAllowsPhotos(section.id, field);

                return (
                  <div className={canAttachPhotos ? "rvmField withPhotos" : "rvmField"} key={field.key}>
                    <label>
                  <span>{field.label}</span>
                  <FieldControl field={field} value={answers[field.key]} onChange={(value) => setStructuredAnswer(field.key, value)} />
                  {field.source ? (
                    <select
                      className="sourceSelect"
                      value={String(answers[`${field.key}__source`] ?? "")}
                      onChange={(event) => setStructuredAnswer(`${field.key}__source`, event.target.value)}
                    >
                      <option value="">Källa/status</option>
                      {sourceOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : null}
                    </label>
                    {canAttachPhotos ? (
                      <PhotoUploader
                        photos={photos}
                        onAdd={(nextPhotos) => addFieldPhotos(photosKey, nextPhotos)}
                        onRemove={(photoId) => removeFieldPhoto(photosKey, photoId)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            {section.id === 25 ? (
              <div className="section25Images">
                <ExistingPhotosPanel answers={answers} sections={sections} />
                <ImageChecklistPanel
                  answers={answers}
                  items={imageChecklist}
                  statuses={imageStatuses}
                  onAddPhotos={addChecklistPhotos}
                  onJump={jumpToSection}
                  onRemovePhoto={removeChecklistPhoto}
                  onStatusChange={setImageChecklistStatus}
                />
              </div>
            ) : null}
            {section.id === 24 ? (
              <div className="signatureGrid">
                <SignaturePad
                  currentHash={currentSignatureHash}
                  defaultName={String(answers.customer_signer || selectedProperty?.customerName || "")}
                  defaultRole="Fastighetsägare"
                  onChange={(signature) => setSignature("customer", signature)}
                  onRemove={() => removeSignature("customer")}
                  signature={savedSignatures.customer}
                  title="Kund / fastighetsägare"
                />
                <SignaturePad
                  currentHash={currentSignatureHash}
                  defaultName={String(answers.rvm_signer || "")}
                  defaultRole="Montör"
                  onChange={(signature) => setSignature("technician", signature)}
                  onRemove={() => removeSignature("technician")}
                  signature={savedSignatures.technician}
                  title="Montör / RVM"
                />
              </div>
            ) : null}
            </>
          )}
        </article>
      </section>
    </section>
  );
}


