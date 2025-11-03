// Background script for Closed Tab History extension
// 改善版: Service Worker再起動対応 + フォールバック機構

const DEFAULT_MAX_HISTORY = 1000;
const ABSOLUTE_MAX_HISTORY = 10000;

let maxHistoryItems = DEFAULT_MAX_HISTORY;

// Initialize storage on extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Closed Tab History extension started');
  await loadSettings();
  await loadExistingTabs();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Closed Tab History extension installed');
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

// Track tab updates to maintain recent tab information
const recentTabs = new Map();

// 【改善1】recentTabsを定期的にストレージにバックアップ
const CACHE_BACKUP_KEY = 'recentTabsBackup';
const BACKUP_INTERVAL = 10000; // 10秒

// バックアップを読み込む
async function loadCacheBackup() {
  try {
    const result = await chrome.storage.local.get([CACHE_BACKUP_KEY]);
    if (result[CACHE_BACKUP_KEY]) {
      const backup = result[CACHE_BACKUP_KEY];
      console.log('Loading cache backup:', backup.length, 'entries');
      backup.forEach(tab => {
        recentTabs.set(tab.id, tab);
      });
    }
  } catch (error) {
    console.error('Error loading cache backup:', error);
  }
}

// バックアップを保存
async function saveCacheBackup() {
  try {
    const backup = Array.from(recentTabs.values());
    await chrome.storage.local.set({ [CACHE_BACKUP_KEY]: backup });
    console.log('Saved cache backup:', backup.length, 'entries');
  } catch (error) {
    console.error('Error saving cache backup:', error);
  }
}

// 定期的にバックアップ
setInterval(saveCacheBackup, BACKUP_INTERVAL);

// Load all existing tabs into recentTabs cache on startup
async function loadExistingTabs() {
  try {
    // まずバックアップから復元
    await loadCacheBackup();

    // 現在のタブを取得して更新
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

// Refresh all tabs periodically
setInterval(async () => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      const existingTab = recentTabs.get(tab.id) || {};
      recentTabs.set(tab.id, {
        id: tab.id,
        url: tab.url || existingTab.url || '',
        title: tab.title || existingTab.title || tab.url || '',
        favIconUrl: tab.favIconUrl || existingTab.favIconUrl || '',
        windowId: tab.windowId
      });
    }
    console.log('Refreshed', tabs.length, 'tabs in cache');
  } catch (error) {
    console.error('Error refreshing tabs:', error);
  }
}, 60000);

// Store tab info when created
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

  const existingTab = recentTabs.get(tabId) || {};
  recentTabs.set(tabId, {
    id: tabId,
    url: tab.url || existingTab.url || '',
    title: tab.title || existingTab.title || tab.url || '',
    favIconUrl: tab.favIconUrl || existingTab.favIconUrl || '',
    windowId: tab.windowId
  });

  if (recentTabs.size > 4000) {
    const oldestKey = recentTabs.keys().next().value;
    recentTabs.delete(oldestKey);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const existingTab = recentTabs.get(tab.id) || {};
    recentTabs.set(tab.id, {
      id: tab.id,
      url: tab.url || existingTab.url || '',
      title: tab.title || existingTab.title || tab.url || '',
      favIconUrl: tab.favIconUrl || existingTab.favIconUrl || '',
      windowId: tab.windowId
    });
    console.log('Tab activated and cached:', tab.id, tab.url);
  } catch (error) {
    console.error('Error tracking activated tab:', error);
  }
});

// Queue to handle multiple tabs closing simultaneously
let saveQueue = Promise.resolve();

// 【改善2】フォールバック機構付きの削除ハンドラ
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Tab removed:', tabId, 'isWindowClosing:', removeInfo.isWindowClosing);

  if (removeInfo.isWindowClosing) {
    return;
  }

  let tabInfo = recentTabs.get(tabId);
  console.log('Tab info from cache:', tabInfo);

  // 【改善3】キャッシュに情報がない場合、バックアップから探す
  if (!tabInfo || !tabInfo.url || tabInfo.url === '') {
    console.log('Cache miss, trying backup...');
    const result = await chrome.storage.local.get([CACHE_BACKUP_KEY]);
    if (result[CACHE_BACKUP_KEY]) {
      const backup = result[CACHE_BACKUP_KEY];
      tabInfo = backup.find(t => t.id === tabId);
      console.log('Found in backup:', tabInfo);
    }
  }

  // 【改善4】それでもダメなら、chrome.tabs.query で探す（削除直後なので見つからないが念のため）
  if (!tabInfo || !tabInfo.url || tabInfo.url === '') {
    console.log('Still no info, querying all tabs...');
    try {
      const allTabs = await chrome.tabs.query({});
      const foundTab = allTabs.find(t => t.id === tabId);
      if (foundTab) {
        tabInfo = {
          id: foundTab.id,
          url: foundTab.url,
          title: foundTab.title,
          favIconUrl: foundTab.favIconUrl,
          windowId: foundTab.windowId
        };
        console.log('Found via query:', tabInfo);
      }
    } catch (err) {
      console.error('Query failed:', err);
    }
  }

  // 【改善5】最後の手段: chrome.history API（要権限追加）
  // ※ この機能は manifest.json に "history" 権限が必要
  /*
  if (!tabInfo || !tabInfo.url || tabInfo.url === '') {
    console.log('Trying chrome.history as last resort...');
    try {
      const historyItems = await chrome.history.search({
        text: '',
        startTime: Date.now() - 5000,
        maxResults: 1
      });
      if (historyItems.length > 0) {
        tabInfo = {
          id: tabId,
          url: historyItems[0].url,
          title: historyItems[0].title,
          favIconUrl: `chrome://favicon/${historyItems[0].url}`,
          windowId: removeInfo.windowId
        };
        console.log('Found via history:', tabInfo);
      }
    } catch (err) {
      console.error('History search failed:', err);
    }
  }
  */

  // バリデーション
  if (!tabInfo || !tabInfo.url || tabInfo.url.startsWith('chrome://') || tabInfo.url === 'about:blank' || tabInfo.url === '') {
    console.log('Skipping tab - no valid URL after all attempts');
    console.log('Final tabInfo:', tabInfo);
    return;
  }

  recentTabs.delete(tabId);

  const closedTab = {
    id: Date.now() + Math.random(),
    url: tabInfo.url,
    title: tabInfo.title || tabInfo.url,
    favIconUrl: tabInfo.favIconUrl || '',
    closedAt: Date.now(),
    windowId: tabInfo.windowId
  };

  saveQueue = saveQueue.then(async () => {
    try {
      const result = await chrome.storage.local.get(['closedTabs']);
      let closedTabs = result.closedTabs || [];

      closedTabs.unshift(closedTab);

      if (closedTabs.length > maxHistoryItems) {
        closedTabs = closedTabs.slice(0, maxHistoryItems);
      }

      await chrome.storage.local.set({ closedTabs });

      console.log('Saved closed tab:', closedTab.title, '(total:', closedTabs.length, ')');
    } catch (error) {
      console.error('Error saving closed tab:', error, closedTab);
    }
  }).catch(err => {
    console.error('Queue error:', err);
    return Promise.resolve();
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateMaxHistory') {
    maxHistoryItems = message.maxHistory;
    console.log('Updated max history to:', maxHistoryItems);

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

chrome.windows.onRemoved.addListener((windowId) => {
  for (const [tabId, tabInfo] of recentTabs.entries()) {
    if (tabInfo.windowId === windowId) {
      recentTabs.delete(tabId);
    }
  }
});
