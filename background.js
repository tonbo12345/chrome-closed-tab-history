// Background script for Closed Tab History extension

const DEFAULT_MAX_HISTORY = 1000;
const ABSOLUTE_MAX_HISTORY = 1000;

let maxHistoryItems = DEFAULT_MAX_HISTORY;

// Initialize storage on extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Closed Tab History extension started');
  await loadSettings();
  await loadExistingTabs();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Closed Tab History extension installed');
  // Initialize empty history and default settings if not exists
  const result = await chrome.storage.local.get(['closedTabs', 'settings']);
  if (!result.closedTabs) {
    await chrome.storage.local.set({ closedTabs: [] });
  }
  if (!result.settings) {
    await chrome.storage.local.set({
      settings: {
        displayCount: 20,
        maxHistory: DEFAULT_MAX_HISTORY
      }
    });
  }
  await loadSettings();
  await loadExistingTabs();
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings', 'closedTabs']);
    if (result.settings && result.settings.maxHistory) {
      maxHistoryItems = result.settings.maxHistory;
      console.log('Loaded max history setting:', maxHistoryItems);
    }

    // Trim existing history if it exceeds current limit
    let closedTabs = result.closedTabs || [];
    if (closedTabs.length > maxHistoryItems) {
      closedTabs = closedTabs.slice(0, maxHistoryItems);
      await chrome.storage.local.set({ closedTabs });
      console.log('Trimmed history on startup from', result.closedTabs.length, 'to', maxHistoryItems);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load all existing tabs into recentTabs cache on startup
async function loadExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    console.log('Loading', tabs.length, 'existing tabs into cache');

    for (const tab of tabs) {
      recentTabs.set(tab.id, {
        id: tab.id,
        url: tab.url || '',
        title: tab.title || '',
        favIconUrl: tab.favIconUrl || '',
        windowId: tab.windowId
      });
    }

    console.log('Loaded', recentTabs.size, 'tabs into recentTabs cache');
  } catch (error) {
    console.error('Error loading existing tabs:', error);
  }
}

// Listen for tab removal events
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Don't track tabs closed due to window closure
  if (removeInfo.isWindowClosing) {
    return;
  }
  
  // Get tab info before it's removed
  // Since the tab is already removed, we need to get the info from onBeforeUnload
  // But Chrome Extensions API doesn't provide direct access to tab info after removal
  // We'll use onUpdated to track active tabs and store recent tab info
});

// Track tab updates to maintain recent tab information
const recentTabs = new Map();

// Store tab info when created - store minimal info, will be updated later
chrome.tabs.onCreated.addListener((tab) => {
  console.log('Tab created:', tab.id, tab.url);
  recentTabs.set(tab.id, {
    id: tab.id,
    url: tab.url || '',
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || '',
    windowId: tab.windowId
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', tabId, 'changeInfo:', changeInfo);

  // Always update tab info when we have it
  const existingTab = recentTabs.get(tabId) || {};
  recentTabs.set(tabId, {
    id: tabId,
    url: tab.url || existingTab.url || '',
    title: tab.title || existingTab.title || tab.url || '',
    favIconUrl: tab.favIconUrl || existingTab.favIconUrl || '',
    windowId: tab.windowId
  });

  // Clean up old entries (keep only last 4000 tabs)
  if (recentTabs.size > 4000) {
    const oldestKey = recentTabs.keys().next().value;
    recentTabs.delete(oldestKey);
  }
});

// Queue to handle multiple tabs closing simultaneously
let saveQueue = Promise.resolve();

// Better approach: Listen for tab removal and use stored recent tab info
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Tab removed:', tabId, 'isWindowClosing:', removeInfo.isWindowClosing);

  if (removeInfo.isWindowClosing) {
    return;
  }

  const tabInfo = recentTabs.get(tabId);
  console.log('Tab info for removed tab:', tabInfo);

  if (!tabInfo || !tabInfo.url || tabInfo.url.startsWith('chrome://') || tabInfo.url === 'about:blank' || tabInfo.url === '') {
    console.log('Skipping tab - no valid URL');
    return;
  }

  // Remove from recent tabs
  recentTabs.delete(tabId);

  // Create closed tab entry
  const closedTab = {
    id: Date.now() + Math.random(), // Unique ID
    url: tabInfo.url,
    title: tabInfo.title || tabInfo.url,
    favIconUrl: tabInfo.favIconUrl || '',
    closedAt: Date.now(),
    windowId: tabInfo.windowId
  };

  // Queue the save operation to prevent race conditions
  saveQueue = saveQueue.then(async () => {
    // Get existing history
    const result = await chrome.storage.local.get(['closedTabs']);
    let closedTabs = result.closedTabs || [];

    // Add new tab to beginning (most recent first)
    closedTabs.unshift(closedTab);

    // Keep only maxHistoryItems
    if (closedTabs.length > maxHistoryItems) {
      closedTabs = closedTabs.slice(0, maxHistoryItems);
    }

    // Save updated history
    await chrome.storage.local.set({ closedTabs });

    console.log('Saved closed tab:', closedTab.title, '(total:', closedTabs.length, ')');
  });
});

// Listen for messages from popup to update settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateMaxHistory') {
    maxHistoryItems = message.maxHistory;
    console.log('Updated max history to:', maxHistoryItems);

    // Trim existing history if needed
    chrome.storage.local.get(['closedTabs'], (result) => {
      let closedTabs = result.closedTabs || [];
      if (closedTabs.length > maxHistoryItems) {
        closedTabs = closedTabs.slice(0, maxHistoryItems);
        chrome.storage.local.set({ closedTabs });
        console.log('Trimmed history to:', maxHistoryItems);
      }
    });
  }
});

// Clean up recent tabs when windows are removed
chrome.windows.onRemoved.addListener((windowId) => {
  for (const [tabId, tabInfo] of recentTabs.entries()) {
    if (tabInfo.windowId === windowId) {
      recentTabs.delete(tabId);
    }
  }
});