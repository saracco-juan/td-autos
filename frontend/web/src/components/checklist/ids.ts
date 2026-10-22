// Ids that tie a step tab to its panel (aria-controls / aria-labelledby). The prefix keeps two checklists apart.
export const stepTabId = (idPrefix: string, numero: number) => `${idPrefix}-tab-${numero}`
export const stepPanelId = (idPrefix: string, numero: number) => `${idPrefix}-panel-${numero}`
