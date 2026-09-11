import { ONET_31_0_SOURCE } from "./officialOnetImporter.ts";

export const officialOccupationSources = Object.freeze([
  {
    sourceId: "onet",
    name: "O*NET® 31.0 Database",
    steward: "U.S. Department of Labor / National Center for O*NET Development",
    scope: "U.S. occupation codes, titles and descriptions from the pinned 31.0 Occupation Data table only",
    importMode: "pinned_local_occupation_data",
    networkImportAllowed: false,
    sourceRefRequired: true,
    licenseReviewRequired: false,
    pinnedArtifact: ONET_31_0_SOURCE,
  },
  {
    sourceId: "soc",
    name: "SOC",
    steward: "U.S. Bureau of Labor Statistics",
    scope: "U.S. Standard Occupational Classification hierarchy",
    importMode: "manifest_only",
    networkImportAllowed: false,
    sourceRefRequired: true,
    licenseReviewRequired: true,
  },
  {
    sourceId: "isco",
    name: "ISCO",
    steward: "International Labour Organization",
    scope: "International Standard Classification of Occupations major groups",
    importMode: "manifest_only",
    networkImportAllowed: false,
    sourceRefRequired: true,
    licenseReviewRequired: true,
  },
  {
    sourceId: "esco",
    name: "ESCO",
    steward: "European Commission",
    scope: "European skills, competences, qualifications, and occupations",
    importMode: "manifest_only",
    networkImportAllowed: false,
    sourceRefRequired: true,
    licenseReviewRequired: true,
  },
]);

export function getOfficialSource(sourceId) {
  return officialOccupationSources.find((source) => source.sourceId === sourceId) || null;
}

export function listOfficialSourceIds() {
  return officialOccupationSources.map((source) => source.sourceId);
}
