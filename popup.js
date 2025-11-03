// Popup script for Closed Tab History extension

let allClosedTabs = [];
let filteredTabs = [];
let currentPage = 1;
let settings = {
  displayCount: 20,
  maxHistory: 1000
};

// DOM elements
let searchInput;
let displayCountSelect;
let maxHistorySlider;
let maxHistoryValue;
let historyList;
let statusElement;
let emptyState;
let prevButton;
let nextButton;
let paginationSection;
let totalCountElement;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  await loadSettings();
  await loadClosedTabs();
  setupEventListeners();
  updateDisplay();
});

function initializeElements() {
  searchInput = document.getElementById('searchInput');
  displayCountSelect = document.getElementById('displayCount');
  maxHistorySlider = document.getElementById('maxHistorySlider');
  maxHistoryValue = document.getElementById('maxHistoryValue');
  historyList = document.getElementById('historyList');
  statusElement = document.getElementById('status');
  emptyState = document.getElementById('emptyState');
  prevButton = document.getElementById('prevPage');
  nextButton = document.getElementById('nextPage');
  paginationSection = document.getElementById('pagination');
  totalCountElement = document.getElementById('totalCount');
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) {
      settings = { ...settings, ...result.settings };
    }

    // Apply settings to UI
    displayCountSelect.value = settings.displayCount;
    maxHistorySlider.value = settings.maxHistory;
    maxHistoryValue.textContent = settings.maxHistory;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

async function loadClosedTabs() {
  try {
    statusElement.textContent = 'Loading history...';
    statusElement.style.display = 'block';

    const result = await chrome.storage.local.get(['closedTabs']);
    allClosedTabs = result.closedTabs || [];
    filteredTabs = [...allClosedTabs];

    statusElement.style.display = 'none';
    updateTotalCount();
    console.log(`Loaded ${allClosedTabs.length} closed tabs`);
  } catch (error) {
    console.error('Error loading closed tabs:', error);
    statusElement.textContent = 'Failed to load history';
  }
}

function updateTotalCount() {
  if (totalCountElement) {
    const count = allClosedTabs.length;
    totalCountElement.textContent = `${count} tab${count !== 1 ? 's' : ''}`;
  }
}

function setupEventListeners() {
  // Search functionality
  searchInput.addEventListener('input', handleSearch);

  // Settings
  displayCountSelect.addEventListener('change', handleDisplayCountChange);
  maxHistorySlider.addEventListener('input', handleMaxHistoryChange);

  // Support button
  const supportButton = document.getElementById('supportButton');
  if (supportButton) {
    supportButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://ko-fi.com/tonbo3751' });
    });
  }

  // Clear history button
  const clearHistoryButton = document.getElementById('clearHistoryButton');
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', handleClearHistory);
  }

  // Pagination
  if (prevButton && nextButton) {
    prevButton.addEventListener('click', handlePrevPage);
    nextButton.addEventListener('click', handleNextPage);
  }
}

function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();

  if (!query) {
    filteredTabs = [...allClosedTabs];
  } else {
    filteredTabs = allClosedTabs.filter(tab =>
      tab.title.toLowerCase().includes(query)
    );
  }

  currentPage = 1; // Reset to first page on search
  updateDisplay();
}

function handleDisplayCountChange() {
  settings.displayCount = parseInt(displayCountSelect.value);
  saveSettings();
  currentPage = 1; // Reset to first page when changing display count
  updateDisplay();
}

function handleMaxHistoryChange() {
  let value = parseInt(maxHistorySlider.value);

  // Update display
  maxHistoryValue.textContent = value;

  // Update settings
  settings.maxHistory = value;
  saveSettings();

  // Notify background script to apply new limit
  chrome.runtime.sendMessage({
    action: 'updateMaxHistory',
    maxHistory: value
  });
}

function handlePrevPage() {
  if (currentPage > 1) {
    currentPage--;
    updateDisplay();
  }
}

function handleNextPage() {
  const totalPages = Math.ceil(filteredTabs.length / settings.displayCount);
  if (currentPage < totalPages) {
    currentPage++;
    updateDisplay();
  }
}

function updateDisplay() {
  if (filteredTabs.length === 0) {
    showEmptyState();
    hidePagination();
    return;
  }

  hideEmptyState();
  renderHistoryList();
  updatePagination();
}

function showEmptyState() {
  historyList.style.display = 'none';
  emptyState.style.display = 'block';

  if (searchInput.value.trim()) {
    emptyState.innerHTML = '<p>No results found</p>';
  } else {
    emptyState.innerHTML = '<p>No closed tabs</p>';
  }
}

function hideEmptyState() {
  historyList.style.display = 'block';
  emptyState.style.display = 'none';
}

function updatePagination() {
  if (!paginationSection || !prevButton || !nextButton) {
    return;
  }

  const totalPages = Math.ceil(filteredTabs.length / settings.displayCount);

  if (totalPages <= 1) {
    hidePagination();
    return;
  }

  showPagination();
  prevButton.disabled = currentPage === 1;
  nextButton.disabled = currentPage === totalPages;
}

function showPagination() {
  if (paginationSection) {
    paginationSection.style.display = 'flex';
  }
}

function hidePagination() {
  if (paginationSection) {
    paginationSection.style.display = 'none';
  }
}

function renderHistoryList() {
  historyList.innerHTML = '';

  const startIndex = (currentPage - 1) * settings.displayCount;
  const endIndex = startIndex + settings.displayCount;
  const itemsToShow = filteredTabs.slice(startIndex, endIndex);

  itemsToShow.forEach(tab => {
    const listItem = createHistoryItem(tab);
    historyList.appendChild(listItem);
  });
}

function createHistoryItem(tab) {
  const li = document.createElement('li');
  li.className = 'history-item';
  li.setAttribute('data-tab-id', tab.id);

  const timeAgo = formatTimeAgo(tab.closedAt);
  const displayUrl = shortenUrl(tab.url);

  li.innerHTML = `
    <div class="item-content">
      <div class="item-header">
        <div class="favicon-container"></div>
        <div class="item-info">
          <div class="item-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>
          <div class="item-url" title="${escapeHtml(tab.url)}">${escapeHtml(displayUrl)}</div>
        </div>
        <div class="item-time">${timeAgo}</div>
      </div>
    </div>
  `;

  // Add favicon with proper error handling
  const faviconContainer = li.querySelector('.favicon-container');
  if (tab.favIconUrl) {
    const img = document.createElement('img');
    img.src = tab.favIconUrl;
    img.alt = '';
    img.className = 'favicon';
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
    faviconContainer.appendChild(img);
  } else {
    faviconContainer.innerHTML = '<div class="favicon-placeholder">🌐</div>';
  }

  li.addEventListener('click', () => restoreTab(tab));

  return li;
}

async function restoreTab(tab) {
  try {
    await chrome.tabs.create({
      url: tab.url,
      active: true
    });
  } catch (error) {
    console.error('Error restoring tab:', error);
  }
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}

function shortenUrl(url) {
  try {
    const urlObj = new URL(url);
    let shortened = urlObj.hostname;
    
    if (urlObj.pathname !== '/') {
      shortened += urlObj.pathname;
    }
    
    if (shortened.length > 50) {
      shortened = shortened.substring(0, 47) + '...';
    }
    
    return shortened;
  } catch {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function handleClearHistory() {
  // Show confirmation dialog
  const confirmed = confirm(
    'Are you sure you want to clear all history?\n\n' +
    `This will permanently delete ${allClosedTabs.length} closed tab${allClosedTabs.length !== 1 ? 's' : ''} from the history.\n\n` +
    'This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }

  try {
    // Clear from storage
    await chrome.storage.local.set({ closedTabs: [] });

    // Update local state
    allClosedTabs = [];
    filteredTabs = [];
    currentPage = 1;

    // Update UI
    updateTotalCount();
    updateDisplay();

    console.log('History cleared successfully');
  } catch (error) {
    console.error('Error clearing history:', error);
    alert('Failed to clear history. Please try again.');
  }
}