export const SIDEBAR_COLLAPSED_STORAGE_KEY = "bbs:sidebar-navigation-collapsed"

export function getSidebarNavigationInitScript() {
  return `
    try {
      var collapsed = window.localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_STORAGE_KEY)}) === "1";
      document.documentElement.dataset.sidebarCollapsed = collapsed ? "true" : "false";
    } catch (_error) {
      document.documentElement.dataset.sidebarCollapsed = "false";
    }
  `
}
