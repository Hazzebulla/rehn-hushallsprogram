"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  emptyCustomerPreInspectionPayload,
  type CustomerPreInspectionPayload,
  type CustomerPreInspectionPhoto,
} from "../../../../lib/customer-preinspection";
import { autosaveCustomerPreInspectionAction, submitCustomerPreInspectionAction, type CustomerPreInspectionResult } from "./actions";

const propertyTypes = ["Villa", "Radhus", "Fritidshus", "Parhus", "Kedjehus", "Annat"];
const basementOptions = ["Ja", "Nej", "Vet ej"];
const floorOptions = ["1", "1,5", "2", "2,5", "3", "Vet ej"];
const heatingOptions = ["Bergvärme", "Luft/vatten", "Luft/luft", "Fjärrvärme", "Elpanna", "Ved/pellets", "Olja", "Direktverkande el", "Annat", "Vet ej"];
const hotWaterOptions = ["Separat varmvattenberedare", "Integrerad i värmepump/panna", "Fjärrvärme", "Vet ej", "Annat"];
const distributionOptions = ["Radiatorer", "Golvvärme", "Fläktkonvektorer", "Direktverkande el", "Annat", "Vet ej"];
const floorHeatingScopes = ["Hela huset", "Delar av huset", "Vet ej"];
const yesNoUnknown = ["Ja", "Nej", "Vet ej"];
const countOptions = ["0", "1", "2", "3", "4", "5+"];
const wetRoomProblems = ["Läckage", "Dåligt tryck", "Dålig avrinning", "Lukt från avlopp", "Missfärgning/fukt", "Droppande blandare", "Problem med varmvatten", "Annat", "Inga kända problem"];
const focusOptions = ["Lågt vattentryck", "Ojämn värme", "Kalla radiatorer", "Problem med varmvatten", "Läckage", "Avloppsproblem", "Höga uppvärmningskostnader", "Gammal värmepump/panna", "Gammal varmvattenberedare", "Blandare/WC", "Golvbrunn", "Annat"];

function hasHeatPump(payload: CustomerPreInspectionPayload) {
  if (payload.heating.includes("Fjärrvärme") && payload.heating.length === 1) return false;
  return payload.heating.some((item) => /bergvärme|luft\/vatten|luft\/luft/i.test(item));
}

function hasSeparateWaterHeater(payload: CustomerPreInspectionPayload) {
  return payload.hotWaterType === "Separat varmvattenberedare";
}

function hasFloorHeating(payload: CustomerPreInspectionPayload) {
  return payload.heatDistribution.includes("Golvvärme");
}

function hasLaundryRoom(payload: CustomerPreInspectionPayload) {
  return payload.hasLaundryRoom === "Ja";
}

function progressFor(step: number) {
  return Math.round((step / 6) * 100);
}

async function imageFileToPhoto(file: File, category: string, imageType: CustomerPreInspectionPhoto["imageType"]): Promise<CustomerPreInspectionPhoto> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    const maxSide = imageType === "NAMEPLATE" ? 1200 : 900;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas saknas");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", imageType === "NAMEPLATE" ? 0.74 : 0.64);

    return {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      name: file.name,
      mimeType: "image/jpeg",
      size: Math.round((dataUrl.length * 3) / 4),
      dataUrl,
      createdAt: new Date().toISOString(),
      category,
      imageType,
      ocrCandidate: imageType === "NAMEPLATE",
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "number";
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="huscheckField">
      <span>{label}{required ? " *" : ""}</span>
      <input inputMode={type === "number" ? "numeric" : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
    </label>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  multi = false,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | string[];
  multi?: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <fieldset className="huscheckChoices">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            className={selected.includes(option) ? "active" : ""}
            key={option}
            onClick={() => {
              if (!multi) {
                onChange(option);
                return;
              }
              const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
              onChange(option === "Inga kända problem" ? ["Inga kända problem"] : next.filter((item) => item !== "Inga kända problem"));
            }}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PhotoInput({
  label,
  photos,
  category,
  imageType,
  onChange,
}: {
  label: string;
  photos: CustomerPreInspectionPhoto[];
  category: string;
  imageType: CustomerPreInspectionPhoto["imageType"];
  onChange: (photos: CustomerPreInspectionPhoto[]) => void;
}) {
  const [message, setMessage] = useState("");

  async function handleFiles(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith("image/")).slice(0, 4);
    if (!images.length) return;
    try {
      const next = await Promise.all(images.map((file) => imageFileToPhoto(file, category, imageType)));
      onChange([...photos, ...next].slice(0, 8));
      setMessage("Bilden sparades i rapportunderlaget.");
    } catch {
      setMessage("Bilden kunde inte läsas in.");
    }
  }

  return (
    <div className="huscheckPhoto">
      <div>
        <strong>{label}</strong>
        <small>{imageType === "NAMEPLATE" ? "Försök få texten skarp om det är en typskylt." : "Valfritt, men hjälper montören på plats."}</small>
      </div>
      <label>
        Lägg till bild
        <input accept="image/*" capture="environment" multiple onChange={(event) => handleFiles(event.target.files)} type="file" />
      </label>
      {photos.length ? (
        <div className="huscheckThumbs">
          {photos.map((photo) => (
            <figure key={photo.id}>
              {photo.dataUrl ? <img alt={photo.name || label} src={photo.dataUrl} /> : <span>Sparad bild</span>}
              <button onClick={() => onChange(photos.filter((item) => item.id !== photo.id))} type="button">Ta bort</button>
            </figure>
          ))}
        </div>
      ) : null}
      {message ? <small>{message}</small> : null}
    </div>
  );
}

export default function CustomerPreInspectionView({
  token,
  initialPayload,
  initialStatus,
}: {
  token: string;
  initialPayload: CustomerPreInspectionPayload;
  initialStatus: string;
}) {
  const [payload, setPayload] = useState<CustomerPreInspectionPayload>({ ...emptyCustomerPreInspectionPayload, ...initialPayload });
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState(initialStatus === "customer_form_completed" ? "Formuläret är redan inskickat. Du kan justera och skicka igen om något blivit fel." : "");
  const [result, setResult] = useState<CustomerPreInspectionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const storageKey = `rvm-customer-preinspection-${token}`;
  const progress = useMemo(() => progressFor(step), [step]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setPayload((current) => ({ ...current, ...JSON.parse(saved) }));
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [payload, storageKey]);

  function update<K extends keyof CustomerPreInspectionPayload>(key: K, value: CustomerPreInspectionPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  function autosave() {
    startTransition(async () => {
      const response = await autosaveCustomerPreInspectionAction(token, payload);
      setMessage(response.message);
    });
  }

  function submit() {
    startTransition(async () => {
      const response = await submitCustomerPreInspectionAction(token, payload);
      setResult(response);
      setMessage(response.message);
      if (response.ok) window.localStorage.removeItem(storageKey);
    });
  }

  if (result?.ok && result.completed) {
    return (
      <main className="huscheckShell">
        <section className="huscheckComplete">
          <p className="sectionKicker">RVM Husrapport</p>
          <h1>Tack!</h1>
          <p>Dina uppgifter har sparats inför din Husrapport.</p>
          <div className="miniReportPoints">
            <article className="green">
              <strong>{result.customerName}</strong>
              <p>{result.address}</p>
            </article>
            <article>
              <strong>Nästa steg</strong>
              <p>När vi kommer på plats kompletterar vi rapporten genom att kontrollera installationer, dokumentera produkter, fotografera relevanta delar och identifiera risker eller rekommenderade åtgärder.</p>
            </article>
          </div>
          <p className="huscheckDisclaimer">Du behöver inte fylla i mer just nu.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="huscheckShell">
      <section className="huscheckCard">
        <header>
          <p className="sectionKicker">RVM Husrapport</p>
          <h1>Förbered din Husrapport</h1>
          <p>Svara på det du vet. Du kan välja “Vet ej” och montören verifierar allt på plats.</p>
          <div className="huscheckProgress">
            <span>Steg {step} av 6</span>
            <b>{progress} %</b>
            <i><em style={{ width: `${progress}%` }} /></i>
          </div>
        </header>

        {step === 1 ? (
          <div className="huscheckStep">
            <TextInput label="Förnamn" required value={payload.firstName} onChange={(value) => update("firstName", value)} />
            <TextInput label="Efternamn" required value={payload.lastName} onChange={(value) => update("lastName", value)} />
            <TextInput label="E-post" required type="email" value={payload.email} onChange={(value) => update("email", value)} />
            <TextInput label="Telefonnummer" type="tel" value={payload.phone} onChange={(value) => update("phone", value)} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="huscheckStep">
            <TextInput label="Gatuadress" required value={payload.address} onChange={(value) => update("address", value)} />
            <TextInput label="Postnummer" required value={payload.postalCode} onChange={(value) => update("postalCode", value)} />
            <TextInput label="Ort" required value={payload.city} onChange={(value) => update("city", value)} />
            <ChoiceGroup label="Fastighetstyp" options={propertyTypes} value={payload.propertyType} onChange={(value) => update("propertyType", String(value))} />
            <TextInput label="Byggår" type="number" value={payload.buildYear} onChange={(value) => update("buildYear", value)} />
            <TextInput label="Boyta" type="number" value={payload.livingArea} onChange={(value) => update("livingArea", value)} placeholder="m²" />
            <ChoiceGroup label="Antal våningar" options={floorOptions} value={payload.floors} onChange={(value) => update("floors", String(value))} />
            <ChoiceGroup label="Källare" options={basementOptions} value={payload.basement} onChange={(value) => update("basement", String(value))} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Hur värms huset idag?" multi options={heatingOptions} value={payload.heating} onChange={(value) => update("heating", value as string[])} />
            {hasHeatPump(payload) ? (
              <>
                <TextInput label="Tillverkare" value={payload.heatingBrand} onChange={(value) => update("heatingBrand", value)} placeholder="Ex. NIBE, CTC, IVT" />
                <TextInput label="Modell" value={payload.heatingModel} onChange={(value) => update("heatingModel", value)} />
                <TextInput label="Ungefärlig ålder" value={payload.heatingApproxAge} onChange={(value) => update("heatingApproxAge", value)} placeholder="Ex. 10 år" />
                <TextInput label="Installationsår" type="number" value={payload.heatingInstallationYear} onChange={(value) => update("heatingInstallationYear", value)} />
                <PhotoInput label="Bild på värmepump/panna eller typskylt" category="värme" imageType="NAMEPLATE" photos={payload.heatingPhotos} onChange={(photos) => update("heatingPhotos", photos)} />
              </>
            ) : <p className="huscheckHint">Värmepumpsfrågor visas bara när du valt en värmepumpslösning.</p>}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Vilken typ av varmvattenlösning finns?" options={hotWaterOptions} value={payload.hotWaterType} onChange={(value) => update("hotWaterType", String(value))} />
            {hasSeparateWaterHeater(payload) ? (
              <>
                <TextInput label="Tillverkare" value={payload.waterHeaterBrand} onChange={(value) => update("waterHeaterBrand", value)} />
                <TextInput label="Modell" value={payload.waterHeaterModel} onChange={(value) => update("waterHeaterModel", value)} />
                <TextInput label="Volym om du vet" value={payload.waterHeaterVolume} onChange={(value) => update("waterHeaterVolume", value)} placeholder="Ex. 200 liter" />
                <TextInput label="Ungefärlig ålder" value={payload.waterHeaterApproxAge} onChange={(value) => update("waterHeaterApproxAge", value)} />
                <TextInput label="Installationsår" type="number" value={payload.waterHeaterInstallationYear} onChange={(value) => update("waterHeaterInstallationYear", value)} />
                <PhotoInput label="Bild på varmvattenberedare eller typskylt" category="varmvatten" imageType="NAMEPLATE" photos={payload.waterHeaterPhotos} onChange={(photos) => update("waterHeaterPhotos", photos)} />
              </>
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Hur sprids värmen i huset?" multi options={distributionOptions} value={payload.heatDistribution} onChange={(value) => update("heatDistribution", value as string[])} />
            {hasFloorHeating(payload) ? <ChoiceGroup label="Golvvärme" options={floorHeatingScopes} value={payload.floorHeatingScope} onChange={(value) => update("floorHeatingScope", String(value))} /> : null}
            <ChoiceGroup label="Hur många badrum/WC finns?" options={countOptions} value={payload.bathrooms} onChange={(value) => update("bathrooms", String(value))} />
            <ChoiceGroup label="Finns dusch?" options={yesNoUnknown} value={payload.hasShower} onChange={(value) => update("hasShower", String(value))} />
            <ChoiceGroup label="Finns badkar?" options={yesNoUnknown} value={payload.hasBathtub} onChange={(value) => update("hasBathtub", String(value))} />
            <ChoiceGroup label="Finns tvättstuga?" options={yesNoUnknown} value={payload.hasLaundryRoom} onChange={(value) => update("hasLaundryRoom", String(value))} />
            {hasLaundryRoom(payload) ? <ChoiceGroup label="Finns golvbrunn i tvättstuga?" options={yesNoUnknown} value={payload.hasLaundryFloorDrain} onChange={(value) => update("hasLaundryFloorDrain", String(value))} /> : null}
            <ChoiceGroup label="Finns synliga problem?" multi options={wetRoomProblems} value={payload.wetRoomProblems} onChange={(value) => update("wetRoomProblems", value as string[])} />
          </div>
        ) : null}

        {step === 6 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Är det något särskilt du vill att vi kontrollerar?" multi options={focusOptions} value={payload.focusAreas} onChange={(value) => update("focusAreas", value as string[])} />
            <label className="huscheckField wide">
              <span>Övrig information</span>
              <textarea onChange={(event) => update("otherInformation", event.target.value)} rows={4} value={payload.otherInformation} />
            </label>
            <PhotoInput label="Bilder från huset" category="övrigt" imageType="DOCUMENTATION" photos={payload.otherPhotos} onChange={(photos) => update("otherPhotos", photos)} />
          </div>
        ) : null}

        <footer className="huscheckNav">
          <button disabled={step === 1 || isPending} onClick={() => setStep((current) => Math.max(1, current - 1))} type="button">Tillbaka</button>
          <button disabled={isPending} onClick={autosave} type="button">Spara</button>
          {step < 6 ? (
            <button disabled={isPending} onClick={() => setStep((current) => Math.min(6, current + 1))} type="button">Nästa</button>
          ) : (
            <button disabled={isPending} onClick={submit} type="button">{isPending ? "Skickar..." : "Skicka formulär"}</button>
          )}
        </footer>
        {message ? <p className="huscheckMessage">{message}</p> : null}
      </section>
    </main>
  );
}
