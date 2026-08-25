import { prisma } from "./prisma";

const JS_EDUCATION_BASE_URL = "https://jseducation.se";

type JsEducationProduct = {
  manufacturer: string;
  modelName: string;
  sourceUrl: string;
  category: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&aring;/g, "å")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Aring;/g, "Å")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferProductCategory(name: string) {
  const text = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (/vent|hrv|flm|ers|sam/.test(text)) return "Ventilation";
  if (/vvm|evp|compact|beredare|varmvatten|sp|eminent|city vx|vx/.test(text)) return "Varmvattenberedare";
  if (/elkassett|elkasset|elbox|elcombi|elk|elpanna|pellet|vedex|panna|olja/.test(text)) return "Panna/tillsats";
  if (/pool|vbx|hbs|smo|uplink|gateway|display|styr|givare|canbus|rts|pcs|pcu/.test(text)) return "Styrning/tillbehör";
  if (/luft|air|split|ecoair|altherma|aria|nordic inverter/.test(text)) return "Luftvärmepump";
  if (/franluft|f370|f470|f730|f750|fighter 310|fighter 360|fighter 410|600p|640p/.test(text)) return "Frånluftsvärmepump";
  if (/greenline|premium|geo|fighter|f11|f12|f13|s11|s12|ecopart|ecoheat|gsi|berg|jord/.test(text)) return "Värmepump";

  return "Värmepump";
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "user-agent": "RVM-Husrapport/1.0 (+reference product index import)",
    },
  });

  if (!response.ok) {
    throw new Error(`JS Education svarade ${response.status} för ${url}`);
  }

  return response.text();
}

export async function getJsEducationRobotsStatus() {
  const robots = await fetchText(`${JS_EDUCATION_BASE_URL}/robots.txt`);
  const userAgentBlock = robots.match(/User-agent:\s*\*([\s\S]*?)(?:\nUser-agent:|$)/i)?.[1] ?? "";
  const allowed = /Allow:\s*\/\s*$/im.test(userAgentBlock) && !/Disallow:\s*\/\s*$/im.test(userAgentBlock);
  const referenceUse = /use=reference/i.test(robots);
  const searchAllowed = /search=yes/i.test(robots);

  return { allowed, referenceUse, searchAllowed, robots };
}

export async function fetchJsEducationProductIndex() {
  const html = await fetchText(JS_EDUCATION_BASE_URL);
  const products = new Map<string, JsEducationProduct>();
  let currentManufacturer = "";

  for (const line of html.split(/\r?\n/)) {
    const brandMatch = line.match(/href="\/brand\/[^"]+"[^>]*>([^<]+)<\/a>/i);
    if (brandMatch) currentManufacturer = decodeHtml(brandMatch[1]);

    const productMatch = line.match(/href="(\/product\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!productMatch || !currentManufacturer) continue;

    const modelName = decodeHtml(productMatch[2]);
    if (!modelName) continue;

    const sourceUrl = `${JS_EDUCATION_BASE_URL}${productMatch[1]}`;
    const key = `${currentManufacturer.toLowerCase()}::${sourceUrl.toLowerCase()}`;
    products.set(key, {
      manufacturer: currentManufacturer,
      modelName,
      sourceUrl,
      category: inferProductCategory(`${currentManufacturer} ${modelName}`),
    });
  }

  return Array.from(products.values());
}

export async function fetchJsEducationDocumentLinks(sourceUrl: string) {
  const html = await fetchText(sourceUrl);
  const links = Array.from(html.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({
      href: match[1].startsWith("http") ? match[1] : `${JS_EDUCATION_BASE_URL}${match[1]}`,
      title: decodeHtml(match[2]),
    }));

  const wiring = links.find((link) => /el\s*schema|elschema|wiring/i.test(link.title));
  const manual = links.find((link) => !wiring || link.href !== wiring.href);

  return {
    manualUrl: manual?.href,
    wiringDiagramUrl: wiring?.href,
    documentCount: links.length,
  };
}

export async function importJsEducationIndex(options: { enrichLimit?: number } = {}) {
  const robots = await getJsEducationRobotsStatus();
  if (!robots.allowed || !robots.referenceUse || !robots.searchAllowed) {
    throw new Error("Robots/content-signaler tillåter inte referensimport för sökindex.");
  }

  const products = await fetchJsEducationProductIndex();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errorDetails: string[] = [];

  const manufacturerNames = Array.from(new Set(products.map((product) => product.manufacturer))).sort((a, b) => a.localeCompare(b, "sv"));

  for (const manufacturerName of manufacturerNames) {
    try {
      await prisma.manufacturer.upsert({
        where: { name: manufacturerName },
        update: { website: `${JS_EDUCATION_BASE_URL}/brand/${manufacturerName.toLowerCase().replace(/\s+/g, "-")}` },
        create: {
          name: manufacturerName,
          website: `${JS_EDUCATION_BASE_URL}/brand/${manufacturerName.toLowerCase().replace(/\s+/g, "-")}`,
        },
      });
    } catch (error) {
      errorCount += 1;
      errorDetails.push(`${manufacturerName}: tillverkare kunde inte sparas (${error instanceof Error ? error.message : "okänt fel"})`);
    }
  }

  const manufacturers = await prisma.manufacturer.findMany({
    where: { name: { in: manufacturerNames } },
    select: { id: true, name: true },
  });
  const manufacturerByName = new Map(manufacturers.map((manufacturer) => [manufacturer.name, manufacturer]));
  const existingProducts = await prisma.productModel.findMany({
    where: { manufacturerId: { in: manufacturers.map((manufacturer) => manufacturer.id) } },
    select: { manufacturerId: true, category: true, modelName: true },
  });
  const existingKeys = new Set(existingProducts.map((product) => `${product.manufacturerId}::${product.category}::${product.modelName}`));
  const now = new Date();
  const createRows = products.flatMap((product) => {
    const manufacturer = manufacturerByName.get(product.manufacturer);
    if (!manufacturer) {
      skippedCount += 1;
      errorDetails.push(`${product.manufacturer} ${product.modelName}: saknar tillverkare efter import.`);
      return [];
    }

    const key = `${manufacturer.id}::${product.category}::${product.modelName}`;
    if (existingKeys.has(key)) {
      updatedCount += 1;
      return [];
    }

    existingKeys.add(key);
    return [{
      manufacturerId: manufacturer.id,
      category: product.category,
      modelName: product.modelName,
      sourceUrl: product.sourceUrl,
      dataQuality: "supplier_source" as const,
      lastVerifiedAt: now,
      active: true,
    }];
  });

  if (createRows.length) {
    try {
      const result = await prisma.productModel.createMany({
        data: createRows,
        skipDuplicates: true,
      });
      createdCount += result.count;
      skippedCount += createRows.length - result.count;
    } catch (error) {
      errorCount += 1;
      errorDetails.push(`Bulkimport kunde inte slutföras (${error instanceof Error ? error.message : "okänt fel"})`);
    }
  }

  const enrichLimit = options.enrichLimit ?? 40;
  if (enrichLimit > 0) {
    const missingDocs = await prisma.productModel.findMany({
      where: {
        sourceUrl: { startsWith: JS_EDUCATION_BASE_URL },
        OR: [{ manualUrl: null }, { wiringDiagramUrl: null }],
      },
      orderBy: { updatedAt: "desc" },
      take: enrichLimit,
    });

    for (const product of missingDocs) {
      if (!product.sourceUrl) continue;
      try {
        const links = await fetchJsEducationDocumentLinks(product.sourceUrl);
        await prisma.productModel.update({
          where: { id: product.id },
          data: {
            manualUrl: links.manualUrl ?? product.manualUrl,
            wiringDiagramUrl: links.wiringDiagramUrl ?? product.wiringDiagramUrl,
            lastVerifiedAt: new Date(),
          },
        });
        updatedCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 120));
      } catch (error) {
        skippedCount += 1;
        errorDetails.push(`${product.modelName}: dokumentlänkar kunde inte läsas (${error instanceof Error ? error.message : "okänt fel"})`);
      }
    }
  }

  return {
    foundCount: products.length,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount,
    errorDetails: errorDetails.slice(0, 80),
  };
}
