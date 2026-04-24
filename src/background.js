// Default config values:
// 7 days to expiry, 32 tabs max, wikipedia.org whitelisted
const DEFAULT_CONFIG = {
  timeToExpiry: 7,
  maxTabs: 32,
  whitelist: ["wikipedia.org"]
};

// config is the config saved in/to storage
// savedTabs is the list of saved tabs in/to storage
// storedVals is the local variable holding both returned from storage
let config = {};
let savedTabs = [];

// loading stored config/saved tabs
async function loadConfig() {
  const storedVals = await browser.storage.local.get(["config", "savedTabs"]);
  config = { ...DEFAULT_CONFIG, ...(storedVals.config || {}) };
  savedTabs = storedVals.savedTabs || [];
}

// saving local config and savedTabs to config and savedTabs respectively
async function saveConfig() {
  await browser.storage.local.set({ config, savedTabs });
}

// check if a new url is already whitelisted
// this determines if a tab can be saved with the right-click menu
function isWhitelisted(url) {
  try {
    const urlObj = new URL(url);
    return config.whitelist.some(domain => urlObj.hostname.endsWith(domain));
  } catch (e) {
    return false;
  }
}

// right-click menu item for saving tabs
async function saveTabContextMenu() {
  browser.contextMenus.removeAll(async () => {
    // get stored config
    await loadConfig();
    // "Ephemeral Save" option comes up with extension icon when you right-click
    // on the tab or the page. goated name fr fr
    browser.contextMenus.create({
      id: "ephemeral-save",
      title: "Ephemeral Save",
      contexts: ["page", "tab"]
    });
  });
}

// saving tabs when you click the menu item
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ephemeral-save") {
    // if its not a url being snatched, just exit
    if (!tab.url) return;
    // if the url is not whitelisted, just exit
    if (!isWhitelisted(tab.url)) {
      return;
    }
    // get stored config
    await loadConfig();
    // find if the tab was already saved; if not, add it
    const existingIndex = savedTabs.findIndex(t => t.url == tab.url);
    if (existingIndex != -1) {
      savedTabs.splice(existingIndex, 1);
    }
    const newSavedTab = {
      id: tab.id,
      // use "Untitled" if there is no tab.title
      title: tab.title || "Untitled",
      url: tab.url,
      timestamp: Date.now(),
      favicon: tab.favIconUrl
    };
    savedTabs.unshift(newSavedTab);
    // prune tabs in case the new tab exceeds the max tab limit
    pruneTabs();
    await saveConfig();
    // close the tab after saving it
    try {
      await browser.tabs.remove(tab.id);
    } catch (err) {
      console.error("Could not close tab, error: ", err);
    }
  }
});

// a check to see if tabs need to be pruned
function pruneTabs() {
  // calculate expiry time in milliseconds and return the existing tab count
  const expiryTimeMilliseconds = config.timeToExpiry * 24 * 60 * 60 * 1000;
  const unprunedTabCount = savedTabs.length;
  // prune expired tabs
  savedTabs = savedTabs.filter(tab => (Date.now() - tab.timestamp) < expiryTimeMilliseconds);
  // prune overwritten tabs (tabs replaced by new ones when max tab count is reached)
  if (savedTabs.length > config.maxTabs) {
    savedTabs = savedTabs.slice(0, config.maxTabs);
  }
  // return true if the tab counts are unequal (e.g., that pruning is needed)
  return savedTabs.length != unprunedTabCount;
}
// auto-check tabs for pruning every hour
async function pruneTabsAlarm() {
  await browser.alarms.create("pruneTabs", { periodInMinutes: 60 });
}
// prune tabs
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pruneTabs") {
    await loadConfig();
    // if true, prune tabs
    if (pruneTabs()) {
      await saveConfig();
      console.log("Expired tabs pruned.");
    }
  }
});

// when the browser storage is changed, check if it matters for the tab list
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    // by default, assume that changes in storage don't matter for the tab list
    let importantChange = false;
    // if the detected changes are for "config" or "savedTabs" though, they do matter
    if (changes.config) {
      config = { ...DEFAULT_CONFIG, ...(changes.config.newValue || {}) };
      importantChange = true;
    }
    if (changes.savedTabs) {
      savedTabs = changes.savedTabs.newValue || [];
      importantChange = true;
    }
    // if the changes matter, then check the tabs and prune them if need be
    if (importantChange) {
      const unprunedTabCount = savedTabs.length;
      pruneTabs();
      if (savedTabs.length != unprunedTabCount) {
        saveConfig();
      }
    }
  }
});

// init
loadConfig().then(() => {
  saveTabContextMenu();
  pruneTabsAlarm();
});