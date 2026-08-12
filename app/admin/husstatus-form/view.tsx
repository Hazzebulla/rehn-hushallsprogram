"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { autosaveHusstatusDraftAction, completeHusstatusFormAction } from "./actions";
import type { RvmField, RvmSection } from "./spec";

type PropertyOption = {
  id: string;
  label: string;
};

type PhotoAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
};

type ComponentRegisterRow = {
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

type AnswerValue = string | string[] | ComponentRegisterRow[] | PhotoAttachment[];
type Answers = Record<string, AnswerValue>;

const sourceOptions = [
  "Kunduppgift",
  "RVM verifierat",
  "RVM mätt",
  "Dokumentation",
  "Ej kontrollerat",
  "Ej åtkomligt",
  "Ej aktuellt",
];

const emptyComponentRows: ComponentRegisterRow[] = Array.from({ length: 20 }, () => ({
  typeName: "",
  systemName: "",
  category: "Värmesystem",
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
  return String(value ?? "").trim().length > 0;
}

function isPhotoAttachment(value: unknown): value is PhotoAttachment {
  return value !== null && typeof value === "object" && "dataUrl" in value && "mimeType" in value;
}

function photoArray(value: AnswerValue | undefined): PhotoAttachment[] {
  return Array.isArray(value) && value.every(isPhotoAttachment) ? value : [];
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

async function imageFileToAttachment(file: File): Promise<PhotoAttachment> {
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

  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function PhotoUploader({
  photos,
  compact = false,
  onAdd,
  onRemove,
}: {
  photos: PhotoAttachment[];
  compact?: boolean;
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
      const nextPhotos = await Promise.all(images.slice(0, remainingSlots).map(imageFileToAttachment));
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
          Lägg till bild
          <input accept="image/*" multiple onChange={(event) => handleFiles(event.target.files)} type="file" />
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

function ComponentRegisterTable({
  rows,
  onChange,
}: {
  rows: ComponentRegisterRow[];
  onChange: (rows: ComponentRegisterRow[]) => void;
}) {
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

  return (
    <div className="componentFormTable">
      <div className="componentFormHead">
        <span>#</span>
        <span>Komponent</span>
        <span>System</span>
        <span>Kategori</span>
        <span>Fabrikat</span>
        <span>Modell</span>
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
          <input value={row.typeName} onChange={(event) => updateRow(index, "typeName", event.target.value)} />
          <input value={row.systemName} onChange={(event) => updateRow(index, "systemName", event.target.value)} />
          <select value={row.category} onChange={(event) => updateRow(index, "category", event.target.value)}>
            <option>Värmesystem</option>
            <option>Tappvatten</option>
            <option>Sanitet</option>
            <option>Avlopp</option>
            <option>El & styr</option>
          </select>
          <input value={row.brand} onChange={(event) => updateRow(index, "brand", event.target.value)} />
          <input value={row.model} onChange={(event) => updateRow(index, "model", event.target.value)} />
          <input value={row.serialNo} onChange={(event) => updateRow(index, "serialNo", event.target.value)} />
          <input value={row.installedYear} onChange={(event) => updateRow(index, "installedYear", event.target.value)} type="number" />
          <select value={row.status} onChange={(event) => updateRow(index, "status", event.target.value)}>
            <option value="">Ej valt</option>
            <option>OK</option>
            <option>Avvikelse</option>
            <option>Medel</option>
            <option>Hög</option>
            <option>Akut</option>
          </select>
          <input value={row.replacementYear ?? ""} onChange={(event) => updateRow(index, "replacementYear", event.target.value)} placeholder="2030" type="number" />
          <input value={row.replacementPeriod ?? ""} onChange={(event) => updateRow(index, "replacementPeriod", event.target.value)} placeholder="februari-mars" />
          <input value={row.costKr} onChange={(event) => updateRow(index, "costKr", event.target.value)} type="number" />
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

export default function HusstatusFormView({
  databaseOnline,
  properties,
  sections,
  fieldCount,
  initialPropertyId,
  initialAnswers = {},
  initialStatus = "NOT_STARTED",
}: {
  databaseOnline: boolean;
  properties: PropertyOption[];
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydratedRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const storageKey = `rvm-husstatus-draft-${propertyId || "none"}`;

  const answeredCount = useMemo(() => Object.values(answers).filter(hasValue).length, [answers]);
  const progress = Math.min(100, Math.round((answeredCount / Math.max(fieldCount, 1)) * 100));
  const formButtonLabel =
    initialStatus === "SUBMITTED"
      ? "Visa formulärunderlag"
      : answeredCount > 0
        ? `Fortsätt formulär - ${progress} % klart`
        : "Fyll i formulär";
  const section = sections.find((item) => item.id === activeSection) ?? sections[0];

  function savedTimeLabel(date = new Date()) {
    return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }

  async function saveDraftNow() {
    if (!databaseOnline || !propertyId || answeredCount === 0) {
      setMessage(answeredCount === 0 ? "Inget är ifyllt ännu." : "Utkastet kunde inte sparas.");
      return false;
    }

    const payload = JSON.stringify(answers);
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("answers", payload);
    const result = await autosaveHusstatusDraftAction(formData);
    if (result.ok) {
      lastSavedPayloadRef.current = payload;
      const time = savedTimeLabel();
      setLastSavedAt(time);
      setMessage(`Sparat kl ${time}.`);
      window.localStorage.setItem(storageKey, payload);
      return true;
    }
    setMessage(result.message);
    return false;
  }

  useEffect(() => {
    if (!propertyId) return;
    const saved = window.localStorage.getItem(storageKey);
    const nextAnswers = lightenStoredPhotos(saved ? JSON.parse(saved) : initialAnswers) as Answers;
    setAnswers(nextAnswers);
    setRegisterPaste(String(nextAnswers.component_register ?? ""));
    window.localStorage.setItem(storageKey, JSON.stringify(nextAnswers));
    lastSavedPayloadRef.current = JSON.stringify(nextAnswers);
    hydratedRef.current = true;
  }, [propertyId, storageKey, initialAnswers]);

  useEffect(() => {
    if (!propertyId || !hydratedRef.current) return;
    const payload = JSON.stringify(answers);
    window.localStorage.setItem(storageKey, payload);

    if (!databaseOnline || answeredCount === 0 || payload === lastSavedPayloadRef.current) return;
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
  }, [answers, answeredCount, databaseOnline, propertyId, storageKey]);

  function setStructuredAnswer(key: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [key]: value }));
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

  function complete() {
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
          <strong>{fieldCount}</strong>
          <small>Digital formulärversion 1</small>
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
      </section>

      <section className="portalPanel formToolbar">
        <label>
          Fastighet
          <select disabled={!databaseOnline || isPending} value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setActiveSection(1)}>{formButtonLabel}</button>
        <button disabled={!databaseOnline || isPending || answeredCount === 0} onClick={saveNow} type="button">Spara nu</button>
        <button disabled={isPending || !databaseOnline} onClick={previewReport} type="button">Förhandsgranska rapport</button>
        <button disabled={!databaseOnline || isPending || !propertyId} onClick={complete}>
          Slutför och skapa husrapport
        </button>
      </section>

      <section className="husstatusFormShell">
        <nav className="formSectionNav" aria-label="Formuläravsnitt">
          {sections.map((item) => {
            const sectionDone = item.fields.some((field) => hasValue(answers[field.key]));
            return (
              <button className={item.id === activeSection ? "active" : ""} key={item.id} onClick={() => setActiveSection(item.id)}>
                <b>{item.id}</b>
                <span>{item.title}</span>
                {sectionDone && <i />}
              </button>
            );
          })}
        </nav>

        <article className="portalPanel formSection">
          <div className="panelTitle">
            <h3>{section.id}. {section.title}</h3>
            <span>{section.fields.length} fält</span>
          </div>
          <p>{section.description}</p>
          {section.id === 19 ? (
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
                onChange={(rows) => setStructuredAnswer("component_register_rows", rows)}
              />
            </>
          ) : (
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
          )}
        </article>
      </section>
    </section>
  );
}
