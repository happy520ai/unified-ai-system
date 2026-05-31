export const occupationSources = Object.freeze([
  {
    source: "SOC",
    title: "Standard Occupational Classification",
    sourceRef: "https://www.bls.gov/soc/",
    importStatus: "seeded",
    role: "US occupation major group reference",
  },
  {
    source: "ISCO",
    title: "International Standard Classification of Occupations",
    sourceRef: "https://ilostat.ilo.org/methods/concepts-and-definitions/classification-occupation/",
    importStatus: "seeded",
    role: "international occupation major group reference",
  },
  {
    source: "ONET",
    title: "O*NET occupational data manifest",
    sourceRef: "https://www.onetcenter.org/database.html",
    importStatus: "manifest_only",
    role: "future source-backed import manifest",
  },
  {
    source: "ESCO",
    title: "European Skills, Competences, Qualifications and Occupations",
    sourceRef: "https://esco.ec.europa.eu/",
    importStatus: "manifest_only",
    role: "future occupation and skills source manifest",
  },
]);

export const sourceBackedPositionLibrary = true;
export const allWorldJobsClaimed = false;
