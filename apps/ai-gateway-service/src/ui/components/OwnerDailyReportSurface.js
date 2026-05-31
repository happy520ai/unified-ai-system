function renderList(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

export function renderOwnerDailyReportSurface(copy) {
  const bossDailyReportLine = copy.ownerAutomationFileActionResult?.bossDailyReportLine;
  const dailyReportItems = bossDailyReportLine
    ? [...copy.dailyReportItems, bossDailyReportLine]
    : copy.dailyReportItems;

  return `
                <section class="owner-daily-report-panel" id="owner-daily-report-panel" data-owner-daily-report-surface="true">
                  <strong>${copy.dailyReportTitle}</strong>
                  <p class="owner-report-note">${copy.dailyReportIntro}</p>
                  <ul>${renderList(dailyReportItems)}</ul>
                </section>`;
}


