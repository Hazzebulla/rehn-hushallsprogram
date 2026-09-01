"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { submitHuscheckAction, type HuscheckPayload, type HuscheckPhoto, type HuscheckResult } from "./actions";

const storageKey = "rvm-public-huscheck-draft-v1";

const emptyPayload: HuscheckPayload = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  postalCode: "",
  city: "",
  propertyType: "Villa",
  buildYear: "",
  livingArea: "",
  floors: "",
  heating: [],
  heatPumpBrand: "",
  heatPumpModel: "",
  heatPumpYear: "",
  heatPumpWorks: "",
  heatPumpAlarms: "",
  heatPumpService: "",
  heatPumpPhotos: [],
  hotWaterType: "",
  waterHeaterBrand: "",
  waterHeaterModel: "",
  waterHeaterYear: "",
  waterHeaterSize: "",
  hotWaterProblems: "",
  waterHeaterPhotos: [],
  heatDistribution: "",
  radiatorsWarm: "",
  coldRadiators: "",
  valvesChanged: "",
  floorHeatingType: "",
  floorHeatingAreas: "",
  floorHeatingYear: "",
  coldRooms: "",
  problems: [],
  problemDescription: "",
  recentWork: "",
  recentWorkDescription: "",
  otherPhotos: [],
};

const propertyTypes = ["Villa", "Radhus", "Fritidshus", "Annat"];
const heatingOptions = ["Bergvärme", "Jordvärme", "Luft/vatten", "Luft/luft", "Fjärrvärme", "Direktverkande el", "Pelletspanna", "Vedpanna", "Annat", "Vet inte"];
const yesNoUnknown = ["Ja", "Nej", "Vet inte"];
const hotWaterOptions = ["Separat varmvattenberedare", "Varmvatten via värmepump", "Varmvatten via fjärrvärme", "Vet inte"];
const distributionOptions = ["Radiatorer", "Golvvärme", "Både radiatorer och golvvärme", "Annat", "Vet inte"];
const floorHeatingOptions = ["Vattenburen", "Elektrisk", "Vet inte", "Finns ej"];
const problemOptions = ["Dåligt varmvatten", "Ojämn värme", "Kalla radiatorer", "Höga energikostnader", "Läckage", "Lågt vattentryck", "Missljud", "Problem med värmepump", "Problem med golvvärme", "Annat", "Inga kända problem"];

function includesAny(values: string[], patterns: RegExp[]) {
  return values.some((value) => patterns.some((pattern) => pattern.test(value)));
}

function hasHeatPump(payload: HuscheckPayload) {
  return includesAny(payload.heating, [/bergvärme/i, /jordvärme/i, /luft\/vatten/i, /luft\/luft/i]);
}

function hasRadiators(payload: HuscheckPayload) {
  return /radiatorer/i.test(payload.heatDistribution);
}

function hasFloorHeating(payload: HuscheckPayload) {
  return /golvvärme/i.test(payload.heatDistribution);
}

function hasSeparateWaterHeater(payload: HuscheckPayload) {
  return payload.hotWaterType === "Separat varmvattenberedare";
}

function progressFor(payload: HuscheckPayload, step: number) {
  const base = Math.round(((step - 1) / 6) * 100);
  const required = [payload.firstName, payload.lastName, payload.phone, payload.email, payload.address, payload.city];
  const filled = required.filter((value) => value.trim()).length;
  return Math.min(100, Math.max(base, Math.round(((filled / required.length) * 18) + base)));
}

async function imageFileToAttachment(
  file: File,
  metadata: Pick<HuscheckPhoto, "componentId" | "imageType" | "checklistItemId" | "ocrCandidate">,
): Promise<HuscheckPhoto> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    const maxSide = metadata.imageType === "NAMEPLATE" ? 1100 : 820;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas saknas.");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", metadata.imageType === "NAMEPLATE" ? 0.72 : 0.62);

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
  componentId,
  imageType,
  onChange,
}: {
  label: string;
  photos: HuscheckPhoto[];
  componentId: string;
  imageType: "OVERVIEW" | "NAMEPLATE" | "DOCUMENTATION";
  onChange: (photos: HuscheckPhoto[]) => void;
}) {
  const [message, setMessage] = useState("");

  async function handleFiles(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith("image/")).slice(0, 2);
    if (!images.length) return;

    try {
      const next = await Promise.all(images.map((file) => imageFileToAttachment(file, {
        componentId,
        imageType,
        checklistItemId: `${componentId}-${imageType.toLowerCase()}`,
        ocrCandidate: imageType === "NAMEPLATE",
      })));
      onChange([...photos, ...next].slice(0, 4));
      setMessage(imageType === "NAMEPLATE" ? "Bilden sparas i högre upplösning för framtida OCR." : "Bilden komprimerades innan den sparades.");
    } catch {
      setMessage("Bilden kunde inte läsas in.");
    }
  }

  return (
    <div className="huscheckPhoto">
      <div>
        <strong>{label}</strong>
        <small>{imageType === "NAMEPLATE" ? "Försök få texten på typplåten skarp." : "Ta gärna en översiktsbild."}</small>
      </div>
      <label>
        Ta bild
        <input accept="image/*" capture="environment" multiple onChange={(event) => handleFiles(event.target.files)} type="file" />
      </label>
      {photos.length > 0 ? (
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

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "number";
  placeholder?: string;
}) {
  return (
    <label className="huscheckField">
      <span>{label}</span>
      <input inputMode={type === "number" ? "numeric" : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

export default function HuscheckView() {
  const [payload, setPayload] = useState<HuscheckPayload>(emptyPayload);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<HuscheckResult | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const progress = useMemo(() => progressFor(payload, step), [payload, step]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setPayload({ ...emptyPayload, ...JSON.parse(saved) });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [payload]);

  function update<K extends keyof HuscheckPayload>(key: K, value: HuscheckPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setMessage("");
    startTransition(async () => {
      const response = await submitHuscheckAction(payload);
      setResult(response);
      setMessage(response.message);
      if (response.ok) window.localStorage.removeItem(storageKey);
    });
  }

  if (result?.ok) {
    return (
      <main className="huscheckShell">
        <section className="huscheckComplete">
          <p className="sectionKicker">RVM Huscheck</p>
          <h1>Din preliminära Husstatus</h1>
          <p>{result.message}</p>
          <div className="miniReportCounts">
            <article><span>Grönt</span><strong>{result.report.green}</strong><small>områden utan tydliga problem</small></article>
            <article><span>Gult</span><strong>{result.report.yellow}</strong><small>bör kontrolleras</small></article>
            <article><span>Rött</span><strong>{result.report.red}</strong><small>rapporterat problem</small></article>
          </div>
          <div className="miniReportPoints">
            {result.report.points.map((point) => (
              <article className={point.tone} key={point.title}>
                <strong>{point.title}</strong>
                <p>{point.text}</p>
              </article>
            ))}
          </div>
          <p className="huscheckDisclaimer">
            Detta är en preliminär sammanställning baserad på uppgifter du själv har lämnat och ersätter inte en teknisk kontroll på plats.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="huscheckShell">
      <section className="huscheckCard">
        <header>
          <p className="sectionKicker">RVM Huscheck</p>
          <h1>Förbered din Husrapport</h1>
          <p>Svara på några enkla frågor innan vi kommer ut. Du behöver inte kunna VVS-termer och du kan välja “Vet inte”.</p>
          <div className="huscheckProgress">
            <span>Steg {step} av 6</span>
            <b>{progress} %</b>
            <i><em style={{ width: `${progress}%` }} /></i>
          </div>
        </header>

        {step === 1 ? (
          <div className="huscheckStep">
            <TextInput label="Förnamn" value={payload.firstName} onChange={(value) => update("firstName", value)} />
            <TextInput label="Efternamn" value={payload.lastName} onChange={(value) => update("lastName", value)} />
            <TextInput label="Telefonnummer" type="tel" value={payload.phone} onChange={(value) => update("phone", value)} />
            <TextInput label="E-post" type="email" value={payload.email} onChange={(value) => update("email", value)} />
            <TextInput label="Adress" value={payload.address} onChange={(value) => update("address", value)} />
            <TextInput label="Postnummer" value={payload.postalCode} onChange={(value) => update("postalCode", value)} />
            <TextInput label="Ort" value={payload.city} onChange={(value) => update("city", value)} />
            <ChoiceGroup label="Fastighetstyp" options={propertyTypes} value={payload.propertyType} onChange={(value) => update("propertyType", String(value))} />
            <TextInput label="Byggår" type="number" value={payload.buildYear} onChange={(value) => update("buildYear", value)} />
            <TextInput label="Ungefärlig boyta" type="number" value={payload.livingArea} onChange={(value) => update("livingArea", value)} placeholder="m²" />
            <TextInput label="Antal våningar" type="number" value={payload.floors} onChange={(value) => update("floors", value)} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Hur värms huset idag?" multi options={heatingOptions} value={payload.heating} onChange={(value) => update("heating", value as string[])} />
            {hasHeatPump(payload) ? <p className="huscheckHint">Du har valt en värmepumpslösning. Nästa steg visar några enkla frågor om pumpen.</p> : null}
            {payload.heating.includes("Fjärrvärme") ? <p className="huscheckHint">Värmepumpsfrågor döljs om fjärrvärme är det enda värmesättet.</p> : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="huscheckStep">
            {hasHeatPump(payload) ? (
              <>
                <TextInput label="Fabrikat" value={payload.heatPumpBrand} onChange={(value) => update("heatPumpBrand", value)} placeholder="Ex. NIBE, CTC, IVT" />
                <TextInput label="Modell" value={payload.heatPumpModel} onChange={(value) => update("heatPumpModel", value)} placeholder="Skriv Vet inte om du inte vet" />
                <TextInput label="Ungefärligt installationsår" type="number" value={payload.heatPumpYear} onChange={(value) => update("heatPumpYear", value)} />
                <ChoiceGroup label="Fungerar den normalt?" options={yesNoUnknown} value={payload.heatPumpWorks} onChange={(value) => update("heatPumpWorks", String(value))} />
                <TextInput label="Har några fel eller larm förekommit?" value={payload.heatPumpAlarms} onChange={(value) => update("heatPumpAlarms", value)} placeholder="Nej, Vet inte eller beskriv kort" />
                <TextInput label="När servades den senast?" value={payload.heatPumpService} onChange={(value) => update("heatPumpService", value)} placeholder="Ex. 2024, Vet inte" />
                <PhotoInput label="Bild på värmepump / typplåt" componentId="customer-heat-pump" imageType="NAMEPLATE" photos={payload.heatPumpPhotos} onChange={(photos) => update("heatPumpPhotos", photos)} />
              </>
            ) : (
              <p className="huscheckHint">Du har inte angett någon värmepump. Gå vidare till varmvatten.</p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Hur görs varmvatten i huset?" options={hotWaterOptions} value={payload.hotWaterType} onChange={(value) => update("hotWaterType", String(value))} />
            {hasSeparateWaterHeater(payload) ? (
              <>
                <TextInput label="Fabrikat" value={payload.waterHeaterBrand} onChange={(value) => update("waterHeaterBrand", value)} />
                <TextInput label="Modell" value={payload.waterHeaterModel} onChange={(value) => update("waterHeaterModel", value)} placeholder="Vet inte går bra" />
                <TextInput label="Installationsår" type="number" value={payload.waterHeaterYear} onChange={(value) => update("waterHeaterYear", value)} />
                <TextInput label="Storlek om du vet" value={payload.waterHeaterSize} onChange={(value) => update("waterHeaterSize", value)} placeholder="Ex. 200 liter" />
                <TextInput label="Problem med varmvatten?" value={payload.hotWaterProblems} onChange={(value) => update("hotWaterProblems", value)} placeholder="Nej, Vet inte eller beskriv kort" />
                <PhotoInput label="Bild på varmvattenberedarens typplåt" componentId="customer-water-heater" imageType="NAMEPLATE" photos={payload.waterHeaterPhotos} onChange={(photos) => update("waterHeaterPhotos", photos)} />
              </>
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Hur sprids värmen i huset?" options={distributionOptions} value={payload.heatDistribution} onChange={(value) => update("heatDistribution", String(value))} />
            {hasRadiators(payload) ? (
              <>
                <ChoiceGroup label="Blir alla radiatorer varma?" options={yesNoUnknown} value={payload.radiatorsWarm} onChange={(value) => update("radiatorsWarm", String(value))} />
                <TextInput label="Finns radiatorer som är kalla?" value={payload.coldRadiators} onChange={(value) => update("coldRadiators", value)} placeholder="Ex. två på övervåningen" />
                <TextInput label="Har termostater eller ventiler bytts?" value={payload.valvesChanged} onChange={(value) => update("valvesChanged", value)} placeholder="Ja, Nej eller Vet inte" />
              </>
            ) : null}
            {hasFloorHeating(payload) ? (
              <>
                <ChoiceGroup label="Golvvärme" options={floorHeatingOptions} value={payload.floorHeatingType} onChange={(value) => update("floorHeatingType", String(value))} />
                <TextInput label="Vilka delar av huset?" value={payload.floorHeatingAreas} onChange={(value) => update("floorHeatingAreas", value)} placeholder="Ex. badrum och hall" />
                <TextInput label="Ungefärligt installationsår" type="number" value={payload.floorHeatingYear} onChange={(value) => update("floorHeatingYear", value)} />
                <TextInput label="Finns rum som känns kallare?" value={payload.coldRooms} onChange={(value) => update("coldRooms", value)} placeholder="Nej, Vet inte eller beskriv" />
              </>
            ) : null}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="huscheckStep">
            <ChoiceGroup label="Finns det något du vill att vi tittar extra på?" multi options={problemOptions} value={payload.problems} onChange={(value) => update("problems", value as string[])} />
            <label className="huscheckField wide">
              <span>Beskriv gärna problemet</span>
              <textarea onChange={(event) => update("problemDescription", event.target.value)} rows={4} value={payload.problemDescription} />
            </label>
            <ChoiceGroup label="Har något VVS-arbete gjorts de senaste åren?" options={yesNoUnknown} value={payload.recentWork} onChange={(value) => update("recentWork", String(value))} />
            {payload.recentWork === "Ja" ? (
              <label className="huscheckField wide">
                <span>Vad gjordes och ungefär när?</span>
                <textarea onChange={(event) => update("recentWorkDescription", event.target.value)} rows={3} value={payload.recentWorkDescription} />
              </label>
            ) : null}
            <PhotoInput label="Bild på annat problemområde" componentId="customer-other" imageType="DOCUMENTATION" photos={payload.otherPhotos} onChange={(photos) => update("otherPhotos", photos)} />
          </div>
        ) : null}

        <footer className="huscheckNav">
          <button disabled={step === 1 || isPending} onClick={() => setStep((current) => Math.max(1, current - 1))} type="button">Tillbaka</button>
          {step < 6 ? (
            <button onClick={() => setStep((current) => Math.min(6, current + 1))} type="button">Nästa</button>
          ) : (
            <button disabled={isPending} onClick={submit} type="button">{isPending ? "Skickar..." : "Skicka in Huscheck"}</button>
          )}
        </footer>
        {message ? <p className="huscheckMessage">{message}</p> : null}
      </section>
    </main>
  );
}
