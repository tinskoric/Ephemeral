// Default config values:
// 7 days to expiry, 32 tabs max, wikipedia.org whitelisted
const DEFAULT_CONFIG = {
  timeToExpiry: 7,
  maxTabs: 32,
  whitelist: ["wikipedia.org"]
};

document.addEventListener("DOMContentLoaded", async () => {
  const config = (await browser.storage.local.get("config")).config || DEFAULT_CONFIG;
  const timeToExpiryInput = document.getElementById("timeToExpiryInput");
  const maxTabsInput = document.getElementById("maxTabsInput");
  const whitelistInput = document.getElementById("whitelistInput");
  timeToExpiryInput.value = config.timeToExpiry;
  maxTabsInput.value = config.maxTabs;
  whitelistInput.value = config.whitelist.join(", ");
  
  // displaying config input values in the options panel
  document.getElementById("expiryValue").textContent = config.timeToExpiry;
  document.getElementById("maxValue").textContent = config.maxTabs;
  timeToExpiryInput.addEventListener("input", (e) => {
    document.getElementById("expiryValue").textContent = e.target.value;
  });
  maxTabsInput.addEventListener("input", (e) => {
    document.getElementById("maxValue").textContent = e.target.value;
  });
  
  // save config changes to storage
  document.getElementById("saveButton").addEventListener("click", async () => {
    // when save is clicked, create a new config
    const newConfig = {
      timeToExpiry: parseInt(timeToExpiryInput.value),
      maxTabs: parseInt(maxTabsInput.value),
      whitelist: whitelistInput.value.split(",").map(s => s.trim()).filter(s => s.length > 0)
    };
    // try to push the new config to storage, and display a status
    // the status is just the "Changes Saved!" text in the html file, and it
    // will show if the save works. it just wont show up otherwise
    try {
      await browser.storage.local.set({ config: newConfig });
      // "status" element in the css file
      const configChangeStatus = document.getElementById("status");
      configChangeStatus.style.display = "block";
      // wait for a moment to give time to write to storage
      setTimeout(() => {configChangeStatus.style.display = "none"; }, 999);
    } catch (err) {
      // if it didnt write correctly, write out the error
      console.error("Error saving new config:", err);
      alert("Failed to save new config, check your browser console.");
    }
  });
});
