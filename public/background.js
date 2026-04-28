const DEBUG = true;
const CHROME_URLS = [
  "chrome://about",
  "chrome://accessibility",
  "chrome://app-service-internals",
  "chrome://app-settings",
  "chrome://apps",
  "chrome://attribution-internals",
  "chrome://autofill-internals",
  "chrome://blob-internals",
  "chrome://bluetooth-internals",
  "chrome://bookmarks",
  "chrome://chrome-urls",
  "chrome://components",
  "chrome://connectors-internals",
  "chrome://crashes",
  "chrome://credits",
  "chrome://device-log",
  "chrome://dino",
  "chrome://discards",
  "chrome://download-internals",
  "chrome://downloads",
  "chrome://extensions",
  "chrome://extensions-internals",
  "chrome://flags",
  "chrome://gcm-internals",
  "chrome://gpu",
  "chrome://help",
  "chrome://histograms",
  "chrome://history",
  "chrome://history-clusters-internals",
  "chrome://indexeddb-internals",
  "chrome://inspect",
  "chrome://interstitials",
  "chrome://invalidations",
  "chrome://local-state",
  "chrome://management",
  "chrome://media-engagement",
  "chrome://media-internals",
  "chrome://metrics-internals",
  "chrome://net-export",
  "chrome://net-internals",
  "chrome://network-errors",
  "chrome://new-tab-page",
  "chrome://new-tab-page-third-party",
  "chrome://newtab",
  "chrome://ntp-tiles-internals",
  "chrome://omnibox",
  "chrome://optimization-guide-internals",
  "chrome://password-manager",
  "chrome://password-manager-internals",
  "chrome://policy",
  "chrome://predictors",
  "chrome://prefs-internals",
  "chrome://print",
  "chrome://private-aggregation-internals",
  "chrome://process-internals",
  "chrome://profile-internals",
  "chrome://quota-internals",
  "chrome://safe-browsing",
  "chrome://serviceworker-internals",
  "chrome://settings",
  "chrome://signin-internals",
  "chrome://site-engagement",
  "chrome://sync-internals",
  "chrome://system",
  "chrome://terms",
  "chrome://topics-internals",
  "chrome://tracing",
  "chrome://translate-internals",
  "chrome://ukm",
  "chrome://usb-internals",
  "chrome://user-actions",
  "chrome://version",
  "chrome://web-app-internals",
  "chrome://webrtc-internals",
  "chrome://webrtc-logs",
  "chrome://whats-new",
  "chrome://internals/session-service",
];

// Constants for common states/values
const TAB_STATES = {
  IDLE: 'idle',
  ACTIVE: 'active',
  LOCKED: 'locked'
};

const EMPTY_TAB = {
  id: null,
  url: 'newtab',
  title: null,
  startTime: null,
  endTime: null
};

const MAX_SESSION_DURATION = 24 * 60 * 60 * 1000;

const storage = {
  _getEndOfDay(date) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  },

  _getStartOfNextDay(date) {
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  },

  _getWeekBoundaries(date) {
    const startweek = new Date(date);
    startweek.setDate(date.getDate() - date.getDay()); // sunday
    startweek.setHours(0, 0, 0, 0);

    const endweek = new Date(startweek);
    endweek.setDate(startweek.getDate() + 6); // saturday
    endweek.setHours(23, 59, 59, 999);

    return { start: startweek.getTime(), end: endweek.getTime() };
  },

  async _resetWeekData(newWeekBoundaries) {
    log("NEW WEEK: updating curweek in storage & reseting all data");
    
    const promises = [
      this.set("limitify_curweek", newWeekBoundaries),
      this.set("data_0", {}),
      this.set("data_1", {}),
      this.set("data_2", {}),
      this.set("data_3", {}),
      this.set("data_4", {}),
      this.set("data_5", {}),
      this.set("data_6", {})
    ];
    
    await Promise.all(promises);
  },

  async _addToDay(url, dayOfWeek, durationSeconds) {
    const dayData = await this.get(`data_${dayOfWeek}`);
    
    dayData[url] = (dayData[url] || 0) + durationSeconds;
    dayData.total = (dayData.total || 0) + durationSeconds;
    
    log(`+${durationSeconds.toFixed(1)} seconds to ${url} on day ${dayOfWeek}`);
    
    await this.set(`data_${dayOfWeek}`, dayData);
  },

  async add(value) {
    let startDate = new Date(value.startTime);
    let endDate = new Date(value.endTime);
    const url = value.url;

    const curweek = await this.get("limitify_curweek");
    const curweekend = new Date(curweek.end);

    if (startDate > curweekend) {
      const newWeekBoundaries = this._getWeekBoundaries(startDate);
      await this._resetWeekData(newWeekBoundaries);
    }

    // split session into daily chunks
    while (startDate < endDate) {
      const endOfCurrentDay = this._getEndOfDay(startDate);
      const chunkEnd = (endDate <= endOfCurrentDay) ? endDate : endOfCurrentDay;
      
      const durationSeconds = (chunkEnd.getTime() - startDate.getTime()) / 1000;
      const dayOfWeek = startDate.getDay();
      
      await this._addToDay(url, dayOfWeek, durationSeconds);

      if (endDate > endOfCurrentDay) {
        startDate = this._getStartOfNextDay(startDate);
        
        const updatedWeek = await this.get("limitify_curweek");
        const weekEnd = new Date(updatedWeek.end);
        
        if (startDate > weekEnd) {
          const newWeekBoundaries = this._getWeekBoundaries(startDate);
          await this._resetWeekData(newWeekBoundaries);
        }
      } else {
        break;
      }
    }
  },

  set(key, value) {
    return new Promise((resolve) => {
      const data = { [key]: value };
      chrome.storage.sync.set(data, () => {
        resolve();
      });
    });
  },

  set_local(key, value) {
    return new Promise((resolve) => {
      const data = { [key]: value };
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  },

  get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        resolve(result[key] || {});
      });
    });
  },

  get_local(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || []);
      });
    });
  },
};

chrome.runtime.onInstalled.addListener(() => {
  const currentdate = new Date();
  const startweek = new Date(currentdate);
  startweek.setDate(currentdate.getDate() - currentdate.getDay());
  startweek.setHours(0, 0, 0, 0);
  log("startweek set to: " + startweek.toString());

  const endweek = new Date(startweek);
  endweek.setDate(startweek.getDate() + 6);
  endweek.setHours(23, 59, 59, 999);
  log("endweek set to: " + endweek.toString());
  
  scheduleNextWeekReset();

  Promise.all([
    storage.get("data_0"),
    storage.get("data_1"),
    storage.get("data_2"),
    storage.get("data_3"),
    storage.get("data_4"),
    storage.get("data_5"),
    storage.get("data_6"),

    storage.get("limitify_blocked"),
    storage.get("limitify_curweek"),
    storage.get_local("limitify_curtab"),
  ])
    .then(
      ([
        data0,
        data1,
        data2,
        data3,
        data4,
        data5,
        data6,
        limitifyBlocked,
        limitifyCurweek,
        limitifyCurtab,
      ]) => {
        log("sunday: " + JSON.stringify(data0));
        log("monday: " + JSON.stringify(data1));
        log("tuesday: " + JSON.stringify(data2));
        log("wednesday: " + JSON.stringify(data3));
        log("thursday: " + JSON.stringify(data4));
        log("friday: " + JSON.stringify(data5));
        log("saturday: " + JSON.stringify(data6));
        log("limitifyBlocked: " + JSON.stringify(limitifyBlocked));
        log("limitifyCurweek: " + JSON.stringify(limitifyCurweek));
        log("limitifyCurtab: " + JSON.stringify(limitifyCurtab));

        storage.set("limitify_data", {});
        Object.keys(limitifyBlocked).length === 0
          ? storage.set("limitify_blocked", {})
          : null;

        Object.keys(limitifyCurweek).length === 0
          ? storage.set("limitify_curweek", {
              start: startweek.getTime(),
              end: endweek.getTime(),
            })
          : null;

        storage.set_local("active_sessions", {});

        log("Initialized storage.");
        
        checkAndResetWeekIfNeeded();
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            log("Browser started - beginning tracking for active tab");
            updateCurrentTab(tabs[0].id, tabs[0]);
          }
        });
      }
    )
    .catch((error) => {
      log("ERROR: Failed to initialize storage: " + error);
    });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'weeklyReset') {
    log("Weekly reset alarm triggered at Sunday midnight");
    
    const newWeekBoundaries = storage._getWeekBoundaries(new Date());
    await storage._resetWeekData(newWeekBoundaries);
    
    scheduleNextWeekReset();
  }
});

function log(message) {
  if (DEBUG) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
  }
}

function getNextSundayMidnight() {
  const now = new Date();
  const nextSunday = new Date(now);
  
  const daysUntilSunday = (7 - now.getDay()) % 7;
  
  if (daysUntilSunday === 0 && now.getHours() === 0 && now.getMinutes() === 0) {
    nextSunday.setDate(now.getDate() + 7);
  } else if (daysUntilSunday === 0) {
    nextSunday.setDate(now.getDate() + 7);
  } else {
    nextSunday.setDate(now.getDate() + daysUntilSunday);
  }
  
  nextSunday.setHours(0, 0, 0, 0);
  return nextSunday;
}

function scheduleNextWeekReset() {
  const nextSunday = getNextSundayMidnight();
  const when = nextSunday.getTime();
  
  chrome.alarms.create('weeklyReset', { when });
  log(`Weekly reset scheduled for: ${nextSunday.toString()}`);
}

async function checkAndResetWeekIfNeeded() {
  try {
    const curweek = await storage.get("limitify_curweek");
    if (!curweek || !curweek.end) {
      log("No curweek data found, skipping week check");
      return;
    }
    
    const now = Date.now();
    const curweekend = curweek.end;
    
    if (now > curweekend) {
      log("Week boundary crossed - resetting weekly data");
      const newWeekBoundaries = storage._getWeekBoundaries(new Date(now));
      await storage._resetWeekData(newWeekBoundaries);
      
      scheduleNextWeekReset();
    }
  } catch (error) {
    log(`Error checking week reset: ${error}`);
  }
}

function getCurrentTab() {
  return new Promise((resolve, reject) => {
    const queryOptions = { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, ([tab]) => {
      tab ? resolve(tab) : reject(new Error('Unable to retrieve current tab'));
    });
  });
}

function getUrlHostname(tab) {
  try {
    const url = tab.url || 'chrome://newtab/';
    if (tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('file:')) {
      return 'newtab';
    }
    return new URL(url).hostname;
  } catch (e) {
    return 'newtab';
  }
}

async function saveTabSession(tab) {
  if (!tab?.startTime) return;
  
  const endTime = Date.now();
  const duration = endTime - tab.startTime;
  
  // sanity check: reject sessions longer than 24 hours
  // this catches stale/corrupted startTime values before processing
  if (duration > MAX_SESSION_DURATION) {
    log(`Session duration too long (${Math.floor(duration / 1000 / 60)} minutes), likely stale startTime. Skipping save.`);
    return;
  }
  
  // Don't filter out short sessions - they add up!
  // Even 100ms sessions are valid if user is rapidly switching tabs
  
  tab.endTime = endTime;
  try {
    await storage.add(tab);
    log(`Saved session for ${tab.url}: ${Math.floor(duration / 1000)} seconds`);
  } catch (error) {
    log(`Failed to save tab session: ${error}`);
  }
}

async function updateCurrentTab(tabId, tab) {
  const sessions = await storage.get_local('active_sessions') || {};
  const hostname = getUrlHostname(tab);

  // Cleanup: Check existing sessions to see if they should stop
  for (const id in sessions) {
    const trackedTabId = parseInt(id);

    // Skip the tab we are currently switching to/updating
    if (trackedTabId === tabId) continue;

    try {
      const otherSession = sessions[id];
      const isSameSite = otherSession.url === hostname;
      const t = await chrome.tabs.get(trackedTabId);
      
      // Stop tracking if:
      // - Tab is inactive AND not audible
      // - OR it's the SAME website we just focused (deduplication)
      if ((!t.active && !t.audible) || isSameSite) {
        log(`Stopping ${isSameSite ? 'duplicate' : 'inactive'} session for ${otherSession.url}`);
        await saveTabSession(otherSession);
        delete sessions[id];
      }
    } catch (e) {
      delete sessions[id];
    }
  }

  // If we switch to a Chrome internal page, stop tracking this specific tab
  if (CHROME_URLS.includes(`chrome://${hostname}`)) {
    if (sessions[tabId]) {
      await saveTabSession(sessions[tabId]);
      delete sessions[tabId];
    }
  } else {
    // If this tab isn't already being tracked, or the URL changed, start a new session
    if (!sessions[tabId] || sessions[tabId].url !== hostname) {
      // If there was a different URL in this same tab ID, save the old one first
      if (sessions[tabId]) await saveTabSession(sessions[tabId]);

      sessions[tabId] = {
        id: tabId,
        url: hostname,
        title: tab.title,
        startTime: Date.now(),
        endTime: null
      };
      log(`Started tracking: ${hostname}`);
    }
  }

  await storage.set_local('active_sessions', sessions);
  // Check if site should be blocked
  const blockedSites = await storage.get('limitify_blocked');
  if (blockedSites[hostname]) {
    setTimeout(() => {
      try {
        chrome.tabs.remove(tabId);
        // Clean up session if removed
        delete sessions[tabId];
        storage.set_local('active_sessions', sessions);
      } catch (e) {
        log(`Error removing blocked tab: ${e}`);
      }
    }, 1000);
  }
}

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const sessions = await storage.get_local('active_sessions') || {};

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    log('WINDOW_LOST_FOCUS: All browser windows lost focus');
    // Save all sessions that aren't playing audio
    for (const id in sessions) {
      const tabInfo = await chrome.tabs.get(parseInt(id)).catch(() => null);
      if (!tabInfo?.audible) {
        await saveTabSession(sessions[id]);
        delete sessions[id];
      }
    }
    await storage.set_local('active_sessions', sessions);
  } else {
    log('SWITCHED_WINDOWS: Focused a browser window');
    try {
      const tab = await getCurrentTab();
      if (tab) await updateCurrentTab(tab.id, tab);
    } catch (error) {
      log(`Failed to handle window focus: ${error}`);
    }
  }
});

// track current idle state globally
let isIdle = false;

chrome.idle.onStateChanged.addListener(async (newState) => {
  log(`CHANGED STATE TO: ${newState}`);
  let sessions = await storage.get_local('active_sessions') || {};

  //TODO: DONT TRACK ON LOCKED
  if (newState === TAB_STATES.IDLE || newState === TAB_STATES.LOCKED) {
    isIdle = (newState === TAB_STATES.IDLE);

    for (const id in sessions) {
      const tabId = parseInt(id);
      const tabInfo = await chrome.tabs.get(tabId).catch(() => null);
      
      // Stop session if: Computer is LOCKED OR (User is IDLE and no audio is playing)
      if (newState === TAB_STATES.LOCKED || !tabInfo?.audible) {
        log(`Stopping session for ${sessions[id].url} due to inactivity.`);
        await saveTabSession(sessions[id]);
        delete sessions[id];
      }
    }
    await storage.set_local('active_sessions', sessions);

  } else if (newState === TAB_STATES.ACTIVE) {
    isIdle = false;
    log(`User active, resuming focused tab tracking`);
    try{
      const tab = await getCurrentTab();
      if (tab) await updateCurrentTab(tab.id, tab);
    } catch (error) {
      log(`Failed to get tab: ${error}`);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateCurrentTab(tabId, tab);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateCurrentTab(tab.id, tab);
  });
});

// CRITICAL: Save time when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  let sessions = await storage.get_local('active_sessions') || {};
  
  if (sessions[tabId]) {
    log(`Tab ${tabId} closed, saving session for ${sessions[tabId].url}`);
    await saveTabSession(sessions[tabId]);
    delete sessions[tabId];
    await storage.set_local('active_sessions', sessions);
  }
});

// Handle tab replacement (e.g., when exiting fullscreen on some sites)
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  chrome.tabs.get(addedTabId, (tab) => {
    if (tab) {
      log(`Tab replaced: ${removedTabId} -> ${addedTabId}`);
      updateCurrentTab(addedTabId, tab);
    }
  });
});

// Additional listener for tab visibility changes
// This catches cases where onActivated doesn't fire (e.g., fullscreen mode)
chrome.tabs.onHighlighted.addListener((highlightInfo) => {
  if (highlightInfo.tabIds.length > 0) {
    const tabId = highlightInfo.tabIds[0];
    chrome.tabs.get(tabId, (tab) => {
      if (tab) {
        log(`Tab highlighted: ${tabId}`);
        updateCurrentTab(tabId, tab);
      }
    });
  }
});

chrome.runtime.setUninstallURL(
  "https://forms.gle/3f8MTHYmVVpL9jCK9"
)

