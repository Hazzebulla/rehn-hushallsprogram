export type ImageRequirementLevel = "REQUIRED" | "RECOMMENDED";
export type ImageType = "OVERVIEW" | "NAMEPLATE" | "CONNECTIONS" | "DISPLAY" | "DOCUMENTATION";
export type ImageChecklistStatus = "MISSING" | "DONE" | "NO_VISIBLE_NAMEPLATE" | "NOT_ACCESSIBLE" | "NOT_APPLICABLE";
export type SectionStatus = "active" | "not_applicable";

export type ImageChecklistStatusMap = Record<string, ImageChecklistStatus>;
export type SectionStatusMap = Record<string, SectionStatus>;

export type ImageChecklistItem = {
  id: string;
  title: string;
  componentId: string;
  componentName: string;
  imageType: ImageType;
  level: ImageRequirementLevel;
  sectionId: number;
  reason: string;
};

type ComponentRegisterRow = {
  typeName?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
};

type Answers = Record<string, unknown>;

const notPresentPattern = /^(|nej|saknas|ej aktuellt|ej bedomt|ej bedömt|ej kontrollerat|okant|okänt)$/i;

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasPresentAnswer(value: unknown) {
  const text = normalize(value);
  return !!text && !notPresentPattern.test(text);
}

function slug(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sectionStatuses(answers: Answers): SectionStatusMap {
  return isRecord(answers.section_statuses) ? answers.section_statuses as SectionStatusMap : {};
}

function isSectionActive(answers: Answers, sectionId: number) {
  return sectionStatuses(answers)[String(sectionId)] !== "not_applicable";
}

function getComponentRows(answers: Answers): ComponentRegisterRow[] {
  const value = answers.component_register_rows;
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((row) => ({
      typeName: String(row.typeName ?? ""),
      category: String(row.category ?? ""),
      brand: String(row.brand ?? ""),
      model: String(row.model ?? ""),
      serialNo: String(row.serialNo ?? ""),
    }))
    .filter((row) => hasPresentAnswer(row.typeName) || hasPresentAnswer(row.model) || hasPresentAnswer(row.brand));
}

function makeComponentId(prefix: string, row?: ComponentRegisterRow, fallback?: string) {
  const label = [row?.typeName, row?.brand, row?.model, row?.serialNo, fallback].filter(Boolean).join(" ");
  return `${prefix}-${slug(label || fallback || "komponent")}`;
}

function addItem(items: ImageChecklistItem[], item: Omit<ImageChecklistItem, "id">) {
  const id = `${item.componentId}-${item.imageType.toLowerCase()}`;
  if (items.some((existing) => existing.id === id)) return;
  items.push({ ...item, id });
}

function addStandardComponentImages(
  items: ImageChecklistItem[],
  args: {
    componentId: string;
    componentName: string;
    sectionId: number;
    overviewLevel?: ImageRequirementLevel;
    nameplateLevel?: ImageRequirementLevel;
    extra?: ImageType[];
  },
) {
  addItem(items, {
    componentId: args.componentId,
    componentName: args.componentName,
    title: `${args.componentName} - översiktsbild`,
    imageType: "OVERVIEW",
    level: args.overviewLevel ?? "RECOMMENDED",
    sectionId: args.sectionId,
    reason: "Visar placering, skick och anslutningar i sitt sammanhang.",
  });
  addItem(items, {
    componentId: args.componentId,
    componentName: args.componentName,
    title: `${args.componentName} - typskylt/etikett`,
    imageType: "NAMEPLATE",
    level: args.nameplateLevel ?? "RECOMMENDED",
    sectionId: args.sectionId,
    reason: "Behövs för framtida OCR, modell, serienummer och komponentregister.",
  });

  for (const imageType of args.extra ?? []) {
    const title =
      imageType === "CONNECTIONS"
        ? `${args.componentName} - röranslutningar`
        : imageType === "DISPLAY"
          ? `${args.componentName} - display/driftinformation`
          : `${args.componentName} - dokumentation`;
    addItem(items, {
      componentId: args.componentId,
      componentName: args.componentName,
      title,
      imageType,
      level: "RECOMMENDED",
      sectionId: args.sectionId,
      reason: "Kompletterar bedömningen och gör rapporten lättare att följa upp.",
    });
  }
}

function rowLabel(row: ComponentRegisterRow) {
  return [row.typeName, row.brand, row.model].filter(Boolean).join(" ").trim() || "Komponent";
}

function addFromComponentRegister(items: ImageChecklistItem[], answers: Answers) {
  for (const row of getComponentRows(answers)) {
    const text = normalize(`${row.typeName} ${row.category} ${row.brand} ${row.model}`);
    const label = rowLabel(row);
    const componentId = makeComponentId("register", row, label);

    if (/varmepump|värmepump|franluft|bergvarme|luft-vatten|luft\/vatten|luft-luft|luft\/luft|ctc|nibe|ivt|thermia/.test(text) && isSectionActive(answers, 7)) {
      addStandardComponentImages(items, {
        componentId,
        componentName: label,
        sectionId: 7,
        overviewLevel: "REQUIRED",
        nameplateLevel: "REQUIRED",
        extra: ["CONNECTIONS", "DISPLAY"],
      });
      continue;
    }

    if (/fjarrvarme|fjärrvärme|panna|beredare|varmvatten/.test(text) && isSectionActive(answers, 6)) {
      addStandardComponentImages(items, { componentId, componentName: label, sectionId: 6 });
      continue;
    }

    if (/cirk|vvc|pump|expansion|karl|kärl|ventil|filter|fordelare|fördelare|ventilation/.test(text) && isSectionActive(answers, 9)) {
      addStandardComponentImages(items, { componentId, componentName: label, sectionId: 9 });
    }
  }
}

export function buildImageChecklist(answers: Answers): ImageChecklistItem[] {
  const items: ImageChecklistItem[] = [];
  if (!isSectionActive(answers, 25)) return items;

  if (isSectionActive(answers, 7) && (hasPresentAnswer(answers.heat_source_type) || hasPresentAnswer(answers.heat_source_product))) {
    addStandardComponentImages(items, {
      componentId: "heat-source",
      componentName: "Värmekälla/värmepump",
      sectionId: 7,
      overviewLevel: "REQUIRED",
      nameplateLevel: "REQUIRED",
      extra: ["CONNECTIONS", "DISPLAY"],
    });
  }

  if (isSectionActive(answers, 6) && (hasPresentAnswer(answers.hot_water_type) || hasPresentAnswer(answers.hot_water_product))) {
    addStandardComponentImages(items, {
      componentId: "hot-water",
      componentName: "Varmvattenberedare/VVB",
      sectionId: 6,
    });
  }

  if (isSectionActive(answers, 9) && hasPresentAnswer(answers.circulation_pump)) {
    addStandardComponentImages(items, { componentId: "circulation-pump", componentName: "Cirkulationspump", sectionId: 9 });
  }

  if (isSectionActive(answers, 9) && hasPresentAnswer(answers.expansion_vessel)) {
    addStandardComponentImages(items, { componentId: "expansion-vessel", componentName: "Expansionskärl", sectionId: 9 });
  }

  if (isSectionActive(answers, 10) && hasPresentAnswer(answers.floor_heating)) {
    addStandardComponentImages(items, { componentId: "floor-heating", componentName: "Golvvärmefördelare", sectionId: 10 });
  }

  if (isSectionActive(answers, 4) && hasPresentAnswer(answers.main_shutoff)) {
    addItem(items, {
      componentId: "main-shutoff",
      componentName: "Huvudavstängning",
      title: "Huvudavstängning - bild",
      imageType: "OVERVIEW",
      level: "REQUIRED",
      sectionId: 4,
      reason: "Kritisk punkt vid vattenläcka och framtida service.",
    });
  }

  if (isSectionActive(answers, 4) && hasPresentAnswer(answers.water_meter)) {
    addStandardComponentImages(items, { componentId: "water-meter", componentName: "Vattenmätare", sectionId: 4 });
  }

  if (isSectionActive(answers, 13) && hasPresentAnswer(answers.dishwasher)) {
    addStandardComponentImages(items, { componentId: "dishwasher", componentName: "Diskmaskin", sectionId: 13 });
  }

  if (isSectionActive(answers, 13) && hasPresentAnswer(answers.water_alarm)) {
    addItem(items, {
      componentId: "water-alarm",
      componentName: "Vattenlarm/vattenfelsbrytare",
      title: "Vattenlarm/vattenfelsbrytare - dokumentation",
      imageType: "DOCUMENTATION",
      level: "RECOMMENDED",
      sectionId: 13,
      reason: "Visar skyddsnivå och placering.",
    });
  }

  if (isSectionActive(answers, 15) && hasPresentAnswer(answers.laundry_machines)) {
    addStandardComponentImages(items, { componentId: "washing-machine", componentName: "Tvättmaskin", sectionId: 15 });
    addStandardComponentImages(items, { componentId: "dryer", componentName: "Torktumlare", sectionId: 15 });
  }

  if (isSectionActive(answers, 15) && hasPresentAnswer(answers.laundry_alarm)) {
    addItem(items, {
      componentId: "laundry-water-alarm",
      componentName: "Läckagelarm tvättstuga",
      title: "Läckagelarm tvättstuga - dokumentation",
      imageType: "DOCUMENTATION",
      level: "RECOMMENDED",
      sectionId: 15,
      reason: "Visar skyddsnivå och placering.",
    });
  }

  if (isSectionActive(answers, 13) && hasPresentAnswer(answers.kitchen_sink_cabinet)) {
    addItem(items, {
      componentId: "kitchen-sink-cabinet",
      componentName: "Diskbänksskåp",
      title: "Diskbänksskåp - synliga kopplingar",
      imageType: "OVERVIEW",
      level: "RECOMMENDED",
      sectionId: 13,
      reason: "Viktig dokumentation för vattensäkerhet i kök.",
    });
  }

  if (
    (isSectionActive(answers, 12) && hasPresentAnswer(answers.floor_drain))
    || (isSectionActive(answers, 14) && hasPresentAnswer(answers.bathroom_1_drain))
    || (isSectionActive(answers, 15) && hasPresentAnswer(answers.laundry_drain))
  ) {
    addItem(items, {
      componentId: "floor-drains",
      componentName: "Golvbrunnar",
      title: "Golvbrunn - fabrikat/skick",
      imageType: "DOCUMENTATION",
      level: "RECOMMENDED",
      sectionId: 12,
      reason: "Underlag för våtrumsrisk och framtida åtgärdsplan.",
    });
  }

  addFromComponentRegister(items, answers);

  return items.sort((a, b) => {
    if (a.level !== b.level) return a.level === "REQUIRED" ? -1 : 1;
    return a.sectionId - b.sectionId || a.title.localeCompare(b.title, "sv");
  });
}

export function getImageChecklistStatus(statuses: ImageChecklistStatusMap, itemId: string): ImageChecklistStatus {
  return statuses[itemId] ?? "MISSING";
}

export function isImageChecklistItemComplete(status: ImageChecklistStatus, imageCount: number, imageType: ImageType) {
  if (status === "DONE") return imageCount > 0;
  if (imageType === "NAMEPLATE") {
    return status === "NO_VISIBLE_NAMEPLATE" || status === "NOT_ACCESSIBLE" || status === "NOT_APPLICABLE";
  }
  return status === "NOT_ACCESSIBLE" || status === "NOT_APPLICABLE";
}

export function summarizeImageChecklist(items: ImageChecklistItem[], statuses: ImageChecklistStatusMap, imageCountForItem: (itemId: string) => number) {
  const missingRequired = items.filter((item) => (
    item.level === "REQUIRED" && !isImageChecklistItemComplete(getImageChecklistStatus(statuses, item.id), imageCountForItem(item.id), item.imageType)
  ));
  const missingRecommended = items.filter((item) => (
    item.level === "RECOMMENDED" && !isImageChecklistItemComplete(getImageChecklistStatus(statuses, item.id), imageCountForItem(item.id), item.imageType)
  ));
  const complete = items.length - missingRequired.length - missingRecommended.length;

  return {
    complete,
    total: items.length,
    missingRequired,
    missingRecommended,
    imageProgress: items.length ? Math.round((complete / items.length) * 100) : 100,
  };
}
