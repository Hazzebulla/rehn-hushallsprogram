"use client";

import { useMemo, useState, useTransition } from "react";
import {
  actionTemplates,
  areaCheckTemplates,
  emptyInspectionState,
  findingObjects,
  findingTypes,
  inspectionAreas,
  inspectionProgress,
  inspectionSummary,
  installationTypes,
  riskLabels,
  timingLabels,
  type ActionTiming,
  type AreaStatus,
  type InspectionAreaId,
  type InspectionFinding,
  type InspectionInstallation,
  type InspectionPhoto,
  type InspectionProduct,
  type RiskLevel,
  type TechnicianInspectionState,
  type TypePlateExtraction,
} from "../../../../lib/technician-inspection";
import { autosaveInspectionAction, completeInspectionAction, startInspectionAction } from "./actions";

export type InspectionProductOption = {
  id: string;
  manufacturer: string;
  modelName: string;
  category: string;
  technicalInfo: string;
  replacementPriceMinSek: number | null;
  replacementPriceMaxSek: number | null;
  sourceText: string;
};

type ReportVm = {
  id: string;
  reportNo: string;
  status: string;
  propertyId: string;
  customerName: string;
  address: string;
  buildYear: string;
  heating: string;
  customerCompletion: number;
  customerRows: string[][];
};

const areaStatusLabels: Record<AreaStatus, string> = {
  not_started: "Ej påbörjad",
  in_progress: "Pågående",
  checked: "Kontrollerad",
  has_findings: "Brister hittade",
  not_applicable: "Finns ej",
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyInstallation(areaId: InspectionAreaId): InspectionInstallation {
  return {
    id: newId("installation"),
    areaId,
    type: "Värmepump",
    manufacturer: "",
    model: "",
    serialNo: "",
    manufacturingYear: "",
    installationYear: "",
    volume: "",
    power: "",
    voltage: "",
    rsk: "",
    placement: "",
    status: "Okänd",
    comment: "",
    photos: [],
  };
}

function emptyFinding(areaId: InspectionAreaId): InspectionFinding {
  return {
    id: newId("finding"),
    areaId,
    object: "Blandare",
    types: [],
    riskLevel: "watch",
    timing: "12_months",
    recommendedAction: "",
    comment: "",
    photos: [],
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

async function imageFileToPhoto(file: File, areaId: InspectionAreaId, category: InspectionPhoto["category"], linkedId?: string): Promise<InspectionPhoto> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    const maxSide = category === "Typskylt" ? 1300 : 900;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas saknas");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", category === "Typskylt" ? 0.76 : 0.64);
    return {
      id: newId("photo"),
      name: file.name,
      mimeType: "image/jpeg",
      size: Math.round((dataUrl.length * 3) / 4),
      dataUrl,
      createdAt: new Date().toISOString(),
      areaId,
      category,
      linkedId,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function simulatedTypePlateExtraction(installation: InspectionInstallation): TypePlateExtraction {
  return {
    manufacturer: installation.manufacturer || "Okänd",
    model: installation.model || "Okänd",
    type: installation.type || "Okänd",
    serialNo: installation.serialNo || "Okänd",
    manufacturingYear: installation.manufacturingYear || "Okänd",
    power: installation.power || "Okänd",
    voltage: installation.voltage || "Okänd",
    volume: installation.volume || "Okänd",
    rsk: installation.rsk || "Okänd",
    confidence: {
      manufacturer: installation.manufacturer ? "medium" : "low",
      model: installation.model ? "medium" : "low",
      serialNo: installation.serialNo ? "medium" : "low",
      manufacturingYear: installation.manufacturingYear ? "medium" : "low",
      rsk: installation.rsk ? "medium" : "low",
    },
    verified: false,
  };
}

function matchProduct(query: string, products: InspectionProductOption[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return products.filter((product) => {
    const haystack = `${product.manufacturer} ${product.modelName} ${product.category} ${product.technicalInfo} ${product.sourceText}`.toLowerCase();
    return haystack.includes(normalized);
  }).slice(0, 8);
}

function formatPhotoDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

function InspectionPhotoGrid({
  photos,
  emptyText = "Inga bilder tillagda ännu.",
}: {
  photos: InspectionPhoto[];
  emptyText?: string;
}) {
  if (!photos.length) return <p className="inspectionEmptyPhotos">{emptyText}</p>;

  return (
    <div className="inspectionPhotoGrid">
      {photos.map((photo) => (
        <figure key={photo.id}>
          <img alt={photo.name || photo.category} src={photo.dataUrl} />
          <figcaption>
            <strong>{photo.category}</strong>
            <span>{photo.name || "Bild"}</span>
            <small>{formatPhotoDate(photo.createdAt)}</small>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function TechnicianInspectionView({
  report,
  initialState,
  productOptions,
}: {
  report: ReportVm;
  initialState: TechnicianInspectionState;
  productOptions: InspectionProductOption[];
}) {
  const [state, setState] = useState<TechnicianInspectionState>(() => initialState.reportId ? initialState : emptyInspectionState(report.id, report.propertyId));
  const [activeArea, setActiveArea] = useState<InspectionAreaId>("heat");
  const [activePanel, setActivePanel] = useState<"overview" | "installation" | "product" | "finding" | "photo" | "complete" | "customer">("overview");
  const [draftInstallation, setDraftInstallation] = useState<InspectionInstallation>(() => emptyInstallation("heat"));
  const [draftFinding, setDraftFinding] = useState<InspectionFinding>(() => emptyFinding("heat"));
  const [productMode, setProductMode] = useState<"existing" | "recommended">("existing");
  const [productQuery, setProductQuery] = useState("");
  const [manualProduct, setManualProduct] = useState({ rsk: "", name: "", manufacturer: "", category: "" });
  const [photoCategory, setPhotoCategory] = useState<InspectionPhoto["category"]>("Översikt");
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState("Sparat lokalt");
  const [forceComplete, setForceComplete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const progress = inspectionProgress(state);
  const summary = inspectionSummary(state);
  const activeAreaState = state.areas[activeArea];
  const activeAreaPhotos = useMemo(
    () => state.photos.filter((photo) => photo.areaId === activeArea),
    [activeArea, state.photos],
  );
  const productMatches = matchProduct(productQuery, productOptions);

  function persist(next: TechnicianInspectionState, actionMessage = "Sparar…") {
    setState(next);
    window.localStorage.setItem(`rvm-technician-inspection-${report.id}`, JSON.stringify(next));
    setSaveState(actionMessage);
    startTransition(async () => {
      const response = await autosaveInspectionAction(report.id, next);
      setSaveState(response.ok ? "Sparat" : "Ej synkat");
      setMessage(response.message);
    });
  }

  function startInspection() {
    startTransition(async () => {
      const response = await startInspectionAction(report.id);
      if (response.ok && response.state) {
        setState(response.state);
        setMessage(response.message);
      } else {
        setMessage(response.message);
      }
    });
  }

  function updateArea(status: AreaStatus, comment?: string) {
    const next = {
      ...state,
      areas: {
        ...state.areas,
        [activeArea]: {
          ...state.areas[activeArea],
          status,
          checkedAt: status === "checked" || status === "has_findings" || status === "not_applicable" ? new Date().toISOString() : state.areas[activeArea].checkedAt,
          checkedBy: state.inspectorName,
          comment: comment ?? state.areas[activeArea].comment,
        },
      },
    };
    persist(next);
  }

  function toggleCustomerVerified(label: string) {
    const next = {
      ...state,
      verifiedCustomerFields: {
        ...state.verifiedCustomerFields,
        [label]: {
          verified: !state.verifiedCustomerFields[label]?.verified,
          verifiedAt: new Date().toISOString(),
          verifiedBy: state.inspectorName || "Montör",
        },
      },
    };
    persist(next);
  }

  function addInstallation() {
    const item = { ...draftInstallation, id: newId("installation"), areaId: activeArea };
    persist({
      ...state,
      installations: [item, ...state.installations],
      areas: { ...state.areas, [activeArea]: { ...state.areas[activeArea], status: "in_progress" } },
    });
    setDraftInstallation(emptyInstallation(activeArea));
    setActivePanel("overview");
  }

  function addFinding() {
    const item = { ...draftFinding, id: newId("finding"), areaId: activeArea, createdAt: new Date().toISOString() };
    persist({
      ...state,
      findings: [item, ...state.findings],
      areas: { ...state.areas, [activeArea]: { ...state.areas[activeArea], status: "has_findings" } },
    });
    setDraftFinding(emptyFinding(activeArea));
    setActivePanel("overview");
  }

  function addProduct(product?: InspectionProductOption) {
    const item: InspectionProduct = product
      ? {
          id: newId("product"),
          areaId: activeArea,
          mode: productMode,
          rsk: productQuery,
          productModelId: product.id,
          name: `${product.manufacturer} ${product.modelName}`,
          manufacturer: product.manufacturer,
          model: product.modelName,
          category: product.category,
          technicalInfo: product.technicalInfo,
          listPriceSek: product.replacementPriceMinSek ?? product.replacementPriceMaxSek ?? undefined,
          source: "local_product_database",
        }
      : {
          id: newId("product"),
          areaId: activeArea,
          mode: productMode,
          rsk: manualProduct.rsk || productQuery,
          name: manualProduct.name || "Manuell produkt",
          manufacturer: manualProduct.manufacturer,
          model: "",
          category: manualProduct.category || "Okänd kategori",
          technicalInfo: "Produkten behöver kompletteras administrativt.",
          source: "manual",
        };

    persist({ ...state, products: [item, ...state.products] });
    setProductQuery("");
    setManualProduct({ rsk: "", name: "", manufacturer: "", category: "" });
    setActivePanel("overview");
  }

  async function addPhotos(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith("image/")).slice(0, 8);
    if (!images.length) return;
    try {
      const nextPhotos = await Promise.all(images.map((file) => imageFileToPhoto(file, activeArea, photoCategory)));
      persist({ ...state, photos: [...nextPhotos, ...state.photos] });
      setActivePanel("overview");
    } catch {
      setMessage("Bilden kunde inte läsas in.");
    }
  }

  async function addInstallationPhoto(files: FileList | null, category: InspectionPhoto["category"]) {
    const file = files?.[0];
    if (!file) return;
    const photo = await imageFileToPhoto(file, activeArea, category, draftInstallation.id);
    setDraftInstallation((current) => ({
      ...current,
      photos: [photo, ...current.photos],
      typePlate: category === "Typskylt" ? simulatedTypePlateExtraction(current) : current.typePlate,
    }));
  }

  function approveTypePlate() {
    setDraftInstallation((current) => ({
      ...current,
      typePlate: current.typePlate ? {
        ...current.typePlate,
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: state.inspectorName || "Montör",
      } : undefined,
    }));
  }

  function completeInspection() {
    startTransition(async () => {
      const response = await completeInspectionAction(report.id, state, forceComplete);
      if (response.ok && response.state) {
        setState(response.state);
        setActivePanel("customer");
        setMessage(response.message);
      } else {
        setMessage(response.message);
        setForceComplete(true);
      }
    });
  }

  const areaItems = useMemo(() => inspectionAreas.map((area) => ({
    ...area,
    status: state.areas[area.id]?.status ?? "not_started",
    findings: state.findings.filter((finding) => finding.areaId === area.id).length,
  })), [state]);

  return (
    <section className="adminWork technicianInspection">
      <header className="inspectionHero">
        <div>
          <p className="sectionKicker">Montörens besiktning</p>
          <h1>{report.customerName}</h1>
          <p>{report.address} · Byggår {report.buildYear || "ej angivet"} · {report.heating}</p>
          <div className="inspectionMeta">
            <span>{report.reportNo}</span>
            <span>Status: {report.status}</span>
            <span>Kunden har fyllt i {report.customerCompletion || 0} % av rapporten</span>
            <span>{saveState}</span>
          </div>
        </div>
        <div className="inspectionProgressRing">
          <strong>{progress}%</strong>
          <span>Husrapport</span>
        </div>
      </header>

      {state.status === "not_started" && ["customer_form_completed", "visit_scheduled"].includes(report.status) ? (
        <section className="portalPanel inspectionStart">
          <strong>Redo för platsbesök.</strong>
          <p>Starta besiktningen när montören är på plats. Status sätts då till Pågående besiktning.</p>
          <button className="buttonLink primary" disabled={isPending} onClick={startInspection} type="button">Starta besiktning</button>
        </section>
      ) : null}

      <section className="inspectionLayout">
        <aside className="inspectionAreaRail">
          {areaItems.map((area) => (
            <button className={activeArea === area.id ? "active" : ""} key={area.id} onClick={() => setActiveArea(area.id)} type="button">
              <strong>{area.title}</strong>
              <span>{areaStatusLabels[area.status]}{area.findings ? ` · ${area.findings}` : ""}</span>
            </button>
          ))}
        </aside>

        <section className="inspectionWorkspace">
          <div className="inspectionToolbar">
            <button onClick={() => { setDraftInstallation(emptyInstallation(activeArea)); setActivePanel("installation"); }} type="button">+ Installation</button>
            <button onClick={() => setActivePanel("product")} type="button">+ Produkt</button>
            <button onClick={() => { setDraftFinding(emptyFinding(activeArea)); setActivePanel("finding"); }} type="button">+ Brist</button>
            <button onClick={() => setActivePanel("photo")} type="button">+ Bild</button>
            <button onClick={() => updateArea("checked")} type="button">Markera kontrollerat</button>
            <button onClick={() => updateArea("not_applicable")} type="button">Finns ej</button>
          </div>

          {activePanel === "overview" ? (
            <>
              <section className="portalPanel">
                <div className="panelTitle">
                  <h3>{inspectionAreas.find((area) => area.id === activeArea)?.title}</h3>
                  <span>{areaStatusLabels[activeAreaState.status]}</span>
                </div>
                <div className="inspectionChecks">
                  {areaCheckTemplates[activeArea].map((question) => (
                    <div key={question}>
                      <strong>{question}</strong>
                      {["Ja", "Nej", "Ej relevant", "Ej kontrollerat"].map((value) => (
                        <button
                          className={activeAreaState.checks[question] === value ? "active" : ""}
                          key={value}
                          onClick={() => persist({
                            ...state,
                            areas: {
                              ...state.areas,
                              [activeArea]: {
                                ...activeAreaState,
                                status: activeAreaState.status === "not_started" ? "in_progress" : activeAreaState.status,
                                checks: { ...activeAreaState.checks, [question]: value as "Ja" | "Nej" | "Ej relevant" | "Ej kontrollerat" },
                              },
                            },
                          })}
                          type="button"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>

              <section className="inspectionColumns">
                <article className="portalPanel">
                  <h3>Installationer</h3>
                  {state.installations.filter((item) => item.areaId === activeArea).map((item) => (
                    <div className="inspectionItem" key={item.id}>
                      <strong>{item.type}</strong>
                      <span>{item.manufacturer} {item.model}</span>
                      <b>{item.status}</b>
                      {item.photos.length ? <small>{item.photos.length} bilder sparade</small> : null}
                    </div>
                  ))}
                </article>
                <article className="portalPanel">
                  <h3>Brister</h3>
                  {state.findings.filter((item) => item.areaId === activeArea).map((item) => (
                    <div className={`inspectionItem risk-${item.riskLevel}`} key={item.id}><strong>{item.object}</strong><span>{item.types.join(", ")}</span><b>{riskLabels[item.riskLevel]}</b></div>
                  ))}
                </article>
              </section>

              <section className="portalPanel">
                <div className="panelTitle">
                  <h3>Bilder i området</h3>
                  <span>{activeAreaPhotos.length} bilder</span>
                </div>
                <InspectionPhotoGrid photos={activeAreaPhotos} />
              </section>
            </>
          ) : null}

          {activePanel === "installation" ? (
            <section className="portalPanel inspectionForm">
              <div className="panelTitle"><h3>Ny installation</h3><span>{inspectionAreas.find((area) => area.id === activeArea)?.title}</span></div>
              <label>Typ<select value={draftInstallation.type} onChange={(event) => setDraftInstallation({ ...draftInstallation, type: event.target.value })}>{installationTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Tillverkare<input value={draftInstallation.manufacturer} onChange={(event) => setDraftInstallation({ ...draftInstallation, manufacturer: event.target.value })} /></label>
              <label>Modell<input value={draftInstallation.model} onChange={(event) => setDraftInstallation({ ...draftInstallation, model: event.target.value })} /></label>
              <label>Serienummer<input value={draftInstallation.serialNo} onChange={(event) => setDraftInstallation({ ...draftInstallation, serialNo: event.target.value })} /></label>
              <label>Tillverkningsår<input value={draftInstallation.manufacturingYear} onChange={(event) => setDraftInstallation({ ...draftInstallation, manufacturingYear: event.target.value })} /></label>
              <label>Installationsår<input value={draftInstallation.installationYear} onChange={(event) => setDraftInstallation({ ...draftInstallation, installationYear: event.target.value })} /></label>
              {["Varmvattenberedare", "Värmepump", "Panna"].includes(draftInstallation.type) ? <label>Volym<input value={draftInstallation.volume} onChange={(event) => setDraftInstallation({ ...draftInstallation, volume: event.target.value })} /></label> : null}
              {["Cirkulationspump", "Pump", "Värmepump", "Panna", "Varmvattenberedare"].includes(draftInstallation.type) ? <label>Effekt<input value={draftInstallation.power} onChange={(event) => setDraftInstallation({ ...draftInstallation, power: event.target.value })} /></label> : null}
              {["Cirkulationspump", "Pump"].includes(draftInstallation.type) ? <label>Spänning<input value={draftInstallation.voltage} onChange={(event) => setDraftInstallation({ ...draftInstallation, voltage: event.target.value })} /></label> : null}
              <label>RSK<input value={draftInstallation.rsk} onChange={(event) => setDraftInstallation({ ...draftInstallation, rsk: event.target.value })} /></label>
              <label>Placering<input value={draftInstallation.placement} onChange={(event) => setDraftInstallation({ ...draftInstallation, placement: event.target.value })} /></label>
              <label>Status<select value={draftInstallation.status} onChange={(event) => setDraftInstallation({ ...draftInstallation, status: event.target.value as InspectionInstallation["status"] })}>{["God", "Bevaka", "Bör åtgärdas", "Akut", "Okänd"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="wide">Kommentar<textarea value={draftInstallation.comment} onChange={(event) => setDraftInstallation({ ...draftInstallation, comment: event.target.value })} /></label>
              <label className="photoButton">Bild<input accept="image/*" capture="environment" onChange={(event) => addInstallationPhoto(event.target.files, "Installation")} type="file" /></label>
              <label className="photoButton">Läs typskylt<input accept="image/*" capture="environment" onChange={(event) => addInstallationPhoto(event.target.files, "Typskylt")} type="file" /></label>
              <div className="wide">
                <InspectionPhotoGrid photos={draftInstallation.photos} emptyText="Ta en bild på installationen eller typskylten." />
              </div>
              {draftInstallation.typePlate ? (
                <div className="typePlateReview wide">
                  <strong>Vi hittade följande information</strong>
                  {Object.entries(draftInstallation.typePlate).filter(([key]) => !["confidence", "verified", "verifiedAt", "verifiedBy"].includes(key)).map(([key, value]) => (
                    <span key={key}>{key}: {String(value)} · {draftInstallation.typePlate?.confidence[key] ?? "låg"} säkerhet</span>
                  ))}
                  <button className="buttonLink" onClick={approveTypePlate} type="button">{draftInstallation.typePlate.verified ? "Godkänd" : "Godkänn avläsning"}</button>
                </div>
              ) : null}
              <div className="portalActions wide"><button className="buttonLink primary" onClick={addInstallation} type="button">Spara installation</button><button className="buttonLink" onClick={() => setActivePanel("overview")} type="button">Avbryt</button></div>
            </section>
          ) : null}

          {activePanel === "product" ? (
            <section className="portalPanel inspectionForm">
              <div className="panelTitle"><h3>Lägg till produkt</h3><span>RSK först, manuell om den saknas</span></div>
              <label className="wide">Ange RSK-nummer eller sök produkt<input autoFocus value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Ex. 8344302 eller FM Mattsson 9000" /></label>
              <div className="segmented wide"><button className={productMode === "existing" ? "active" : ""} onClick={() => setProductMode("existing")} type="button">Befintlig installation</button><button className={productMode === "recommended" ? "active" : ""} onClick={() => setProductMode("recommended")} type="button">Rekommenderad produkt</button></div>
              <div className="productMatches wide">
                {productMatches.map((product) => <button key={product.id} onClick={() => addProduct(product)} type="button"><strong>{product.manufacturer} {product.modelName}</strong><span>{product.category} · {product.technicalInfo}</span></button>)}
                {productQuery && !productMatches.length ? <p>Produkten finns inte i produktdatabasen ännu.</p> : null}
              </div>
              <label>RSK<input value={manualProduct.rsk} onChange={(event) => setManualProduct({ ...manualProduct, rsk: event.target.value })} /></label>
              <label>Produktnamn<input value={manualProduct.name} onChange={(event) => setManualProduct({ ...manualProduct, name: event.target.value })} /></label>
              <label>Tillverkare<input value={manualProduct.manufacturer} onChange={(event) => setManualProduct({ ...manualProduct, manufacturer: event.target.value })} /></label>
              <label>Kategori<input value={manualProduct.category} onChange={(event) => setManualProduct({ ...manualProduct, category: event.target.value })} /></label>
              <div className="portalActions wide"><button className="buttonLink primary" onClick={() => addProduct()} type="button">Lägg till manuellt</button><button className="buttonLink" onClick={() => setActivePanel("overview")} type="button">Avbryt</button></div>
            </section>
          ) : null}

          {activePanel === "finding" ? (
            <section className="portalPanel inspectionForm">
              <div className="panelTitle"><h3>Ny brist</h3><span>Färdiga val först</span></div>
              <label>Objekt<select value={draftFinding.object} onChange={(event) => setDraftFinding({ ...draftFinding, object: event.target.value })}>{findingObjects.map((item) => <option key={item}>{item}</option>)}</select></label>
              <fieldset className="wide multiButtons"><legend>Typ av brist</legend>{findingTypes.map((item) => <button className={draftFinding.types.includes(item) ? "active" : ""} onClick={() => setDraftFinding({ ...draftFinding, types: draftFinding.types.includes(item) ? draftFinding.types.filter((value) => value !== item) : [...draftFinding.types, item] })} key={item} type="button">{item}</button>)}</fieldset>
              <label>Risknivå<select value={draftFinding.riskLevel} onChange={(event) => setDraftFinding({ ...draftFinding, riskLevel: event.target.value as RiskLevel })}>{Object.entries(riskLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>Åtgärdstid<select value={draftFinding.timing} onChange={(event) => setDraftFinding({ ...draftFinding, timing: event.target.value as ActionTiming })}>{Object.entries(timingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>Åtgärdsmall<select value={draftFinding.recommendedAction} onChange={(event) => setDraftFinding({ ...draftFinding, recommendedAction: event.target.value })}><option value="">Välj mall</option>{actionTemplates.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Arbetstid<input value={draftFinding.workHours ?? ""} onChange={(event) => setDraftFinding({ ...draftFinding, workHours: event.target.value })} placeholder="Ex. 2 h" /></label>
              <label className="wide">Kommentar<textarea value={draftFinding.comment} onChange={(event) => setDraftFinding({ ...draftFinding, comment: event.target.value })} /></label>
              <div className="portalActions wide"><button className="buttonLink primary" onClick={addFinding} type="button">Spara brist</button><button className="buttonLink" onClick={() => setActivePanel("overview")} type="button">Avbryt</button></div>
            </section>
          ) : null}

          {activePanel === "photo" ? (
            <section className="portalPanel inspectionForm">
              <div className="panelTitle"><h3>Lägg till bild</h3><span>Kopplas till aktuellt område</span></div>
              <label>Kategori<select value={photoCategory} onChange={(event) => setPhotoCategory(event.target.value as InspectionPhoto["category"])}>{["Översikt", "Installation", "Produkt", "Typskylt", "Brist", "Före", "Övrigt"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="photoDrop wide">Ta eller välj bilder<input accept="image/*" capture="environment" multiple onChange={(event) => addPhotos(event.target.files)} type="file" /></label>
              <div className="wide">
                <InspectionPhotoGrid photos={activeAreaPhotos} />
              </div>
            </section>
          ) : null}
        </section>
      </section>

      <section className="inspectionBottom">
        <article className="portalPanel">
          <h3>Kunden har uppgett</h3>
          <div className="customerVerifyList">
            {report.customerRows.length ? report.customerRows.map(([label, value]) => (
              <div key={label}>
                <strong>{label}</strong>
                <span>{value}</span>
                <button className={state.verifiedCustomerFields[label]?.verified ? "active" : ""} onClick={() => toggleCustomerVerified(label)} type="button">
                  {state.verifiedCustomerFields[label]?.verified ? "Verifierad" : "Verifiera"}
                </button>
              </div>
            )) : <p>Kundförformulär saknas eller är inte inskickat.</p>}
          </div>
        </article>

        <article className="portalPanel">
          <h3>Avsluta</h3>
          <p>{summary.checkedAreas} områden kontrollerade, {summary.installations} installationer, {summary.photos} bilder, {summary.findings} brister.</p>
          <p>Risker: {summary.risks.low} låg · {summary.risks.watch} bevaka · {summary.risks.action} bör åtgärdas · {summary.risks.urgent} akut</p>
          <div className="portalActions">
            <button className="buttonLink primary" disabled={isPending} onClick={completeInspection} type="button">Avsluta huskontroll</button>
            <button className="buttonLink" onClick={() => setActivePanel("customer")} type="button">Visa kundöversikt</button>
          </div>
        </article>
      </section>

      {activePanel === "customer" ? (
        <section className="customerQuickView">
          <h2>Din Husrapport – Snabböversikt</h2>
          <p>{report.address} · {new Date().toLocaleDateString("sv-SE")}</p>
          <div className="miniReportCounts">
            <article><span>Kontrollerade områden</span><strong>{summary.checkedAreas}</strong><small>Av {inspectionAreas.length}</small></article>
            <article><span>Installationer</span><strong>{summary.installations}</strong><small>Registrerade idag</small></article>
            <article><span>Viktiga åtgärder</span><strong>{summary.risks.urgent + summary.risks.action}</strong><small>Preliminärt</small></article>
          </div>
          <h3>Viktigast från dagens genomgång</h3>
          <div className="miniReportPoints">
            {state.findings.slice(0, 3).map((finding, index) => (
              <article className={finding.riskLevel === "urgent" ? "red" : finding.riskLevel === "action" ? "yellow" : "green"} key={finding.id}>
                <strong>{index + 1}. {finding.object}</strong>
                <p>{riskLabels[finding.riskLevel]}. {finding.recommendedAction || finding.types.join(", ")}</p>
              </article>
            ))}
          </div>
          <p>Din fullständiga Husrapport granskas nu av Rehn VVS & Montage. Du får en personlig länk via e-post inom 1–3 arbetsdagar.</p>
        </section>
      ) : null}

      {message ? <p className="inspectionToast">{message}</p> : null}
    </section>
  );
}
