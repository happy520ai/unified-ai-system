export function shouldGenerateDomainChief(position) {
  return ["Engineering", "Security", "Product", "Design", "Operations", "Finance", "Legal", "Compliance", "Data"].includes(position?.industryDomain);
}

export function buildDomainChiefTitle(domain) {
  return `${domain} Chief`;
}

