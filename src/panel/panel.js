document.addEventListener('DOMContentLoaded', async () => {
  const tabList = document.getElementById('tabList');
  const reopenAllButton = document.getElementById('reopenAll');
  const clearAllButton = document.getElementById('clearAll');
  const tabCountElement = document.getElementById('tabCount');
  
  // reopenAllButton
  reopenAllButton.addEventListener("click", async () => {
    // in case tabs aren't pruned in time with the hourly background prune, when
    // this is clicked, we check again
    // return current tabs
    let tabs = (await browser.storage.local.get("savedTabs")).savedTabs || [];
    // return expiry config, if something is wrong use 7 days as the default
    const config = (await browser.storage.local.get("config")).config || {timeToExpiry: 7};
    // calculate expiry time in milliseconds
    const expiryTimeMilliseconds = config.timeToExpiry * (24 * 60 * 60 * 1000);
    // prune expired tabs
    tabs = tabs.filter(tab => (Date.now() - tab.timestamp) < expiryTimeMilliseconds);
    if (tabs.length > 1) {
      for (const tab of tabs) {
        await browser.tabs.create({ url: tab.url });
      }
      window.close();
    }
  });

  // clearAllButton
  clearAllButton.addEventListener("click", async () => {
    // here we don't have to worry about if tabs are expired, because we are
    // deleting them all
    await browser.storage.local.set({ savedTabs: [] });
    window.close();
  });

  // tabList
  async function renderList() {
    // function to produce the list of saved tabs
    // return current tabs
    let tabs = (await browser.storage.local.get("savedTabs")).savedTabs || [];
    // return expiry config, if something is wrong use 7 days as the default
    const config = (await browser.storage.local.get("config")).config || {timeToExpiry: 7};
    // calculate expiry time in milliseconds
    const expiryTimeMilliseconds = config.timeToExpiry * (24 * 60 * 60 * 1000);
    // prune expired tabs
    tabs = tabs.filter(tab => (Date.now() - tab.timestamp) < expiryTimeMilliseconds);
    // if there are no tabs, put a filler message. otherwise, present the tabs alone
    tabList.innerHTML = "";
    if (tabs.length == 0) {
      tabList.innerHTML = "<p>Save Something! (Right-click on a tab and click \"Ephemeral Save\")</p>";
      reopenAllButton.style.display = "none";
      clearAllButton.style.display = "none";
      return;
    }
    // Presenting each tab ordered by age where first (tabs[0]) is oldest
    tabs.forEach((tab, index) => {
      // create an individual list item for the saved tab
      // "listItem" as in "li" ... I think that's what it stands for
      const listItem = document.createElement("li");
      // get the favicon for the site tab, if there is none, then display none
      const listItemFavicon = document.createElement("img");
      listItemFavicon.src = tab.favicon || "https://www.google.com/s2/favicons?domain=" + tab.url;
      listItemFavicon.onerror = () => {listItemFavicon.style.display = "none"; };
      // the div for the tab
      // this will contain the tab title (link) and metadata
      const listItemContentDiv = document.createElement("div");
      listItemContentDiv.style.flex = "1";
      // the link that the tab directs to
      const listItemTitleLink = document.createElement("a");
      listItemTitleLink.textContent = tab.title;
      // calculate time remaining to expiry in milliseconds
      const timeRemainingMilliseconds = (tab.timestamp + expiryTimeMilliseconds) - Date.now();
      // present the time remaining for the tab, if none remains it is just pruned elsewhere
      // this is the tab "metadata" with expiry-meta class in the css
      let timeRemainingString = "";
      if (timeRemainingMilliseconds > 0) {
        // calculate time remaining in days and hours and minutes (for putting together the string)
        // find hours less than 1 full extra day and minutes less than 1 full extra hour remaining
        const timeRemainingDays = Math.floor(timeRemainingMilliseconds / (24 * 60 * 60 * 1000));
        const timeRemainingHours = Math.floor((timeRemainingMilliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        if (timeRemainingDays > 0) {
          timeRemainingString = `${timeRemainingDays}d ${timeRemainingHours}h left`;
        } else if (timeRemainingHours > 0) {
          timeRemainingString = `${timeRemainingHours}h left`;
        } else {
          const timeRemainingMinutes = Math.floor((timeRemainingMilliseconds % (60 * 60 * 1000)) / (60 * 1000));
          timeRemainingString = `${timeRemainingMinutes}m left`;
        }
      } else {
        timeRemainingString = "Expired";
      }
      // time remaining metadata class
      const listItemMeta = document.createElement("span");
      listItemMeta.className = "expiry-meta";
      listItemMeta.innerHTML = `${timeRemainingString}`;
      // putting together the tab item
      listItem.appendChild(listItemFavicon);
      listItemContentDiv.appendChild(listItemTitleLink);
      listItemContentDiv.appendChild(listItemMeta);
      listItem.appendChild(listItemContentDiv);
      // adding a delete button to remove individual tabs
      const listItemDeleteButton = document.createElement("span");
      listItemDeleteButton.textContent = "×";
      listItemDeleteButton.className = "delete-button";
      listItemDeleteButton.title = "Unsave Tab";
      listItemDeleteButton.addEventListener("click", async (e) => {
        if (index != -1) {
          tabs.splice(index, 1);
          await browser.storage.local.set({ savedTabs: tabs });
          renderList();
        }
      });
      // putting the delete button in the tab item
      listItem.appendChild(listItemDeleteButton);
      // when clicking on the tab, if you aren't clicking the delete button,
      // it will open the link
      listItem.addEventListener("click", (e) => {
        if (e.target != listItemDeleteButton) {
          browser.tabs.create({ url: tab.url });
        }
      });
      // add the complete tab item to the list
      tabList.appendChild(listItem);
    });
    // Buttons (e.g., reopen/clear all)
    // if the tab list has 2 or more items (>1), display these buttons
    if (tabs.length > 1) {
      tabCountElement.textContent = tabs.length;
      reopenAllButton.style.display = "block";
      clearAllButton.style.display = "block";
    } else {
      reopenAllButton.style.display = "none";
      clearAllButton.style.display = "none";
    }
  }

  await renderList();
});
