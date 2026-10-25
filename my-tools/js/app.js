/**
 * My Tools — Public Catalog Application Logic
 * Zero-Dependency Vanilla JavaScript
 */

(function () {
  'use strict';

  // State
  let toolsData = [];
  let currentCategory = 'ALL';
  let searchQuery = '';
  let currentSort = 'newest';

  // DOM Elements
  const toolGrid = document.getElementById('toolGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const categoryTabs = document.getElementById('categoryTabs');
  const sortSelect = document.getElementById('sortSelect');
  const visibleCountEl = document.getElementById('visibleCount');
  const totalCountEl = document.getElementById('totalCount');
  const resetFilterBtn = document.getElementById('resetFilterBtn');

  // Modal Elements
  const detailModal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  // Category counts
  const countAll = document.getElementById('count-all');
  const countAi = document.getElementById('count-ai');
  const countDev = document.getElementById('count-dev');
  const countFile = document.getElementById('count-file');
  const countOther = document.getElementById('count-other');

  /**
   * Initialize App
   */
  async function init() {
    setupEventListeners();
    await loadToolsData();
    updateCounts();
    render();
  }

  /**
   * Load tools.json
   */
  async function loadToolsData() {
    try {
      const res = await fetch('data/tools.json');
      if (!res.ok) {
        throw new Error(`Failed to load tools.json: ${res.status}`);
      }
      toolsData = await res.json();
    } catch (err) {
      console.error('Data load error:', err);
      toolGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>データの読み込みに失敗しました</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }

  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      searchClearBtn.style.display = searchQuery ? 'block' : 'none';
      render();
    });

    // Search clear button
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      render();
    });

    // Category tabs
    categoryTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentCategory = btn.getAttribute('data-category');
      render();
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      render();
    });

    // Reset button
    resetFilterBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.style.display = 'none';
      currentCategory = 'ALL';

      document.querySelectorAll('.tab-btn').forEach(b => {
        const isAll = b.getAttribute('data-category') === 'ALL';
        b.classList.toggle('active', isAll);
        b.setAttribute('aria-selected', isAll ? 'true' : 'false');
      });

      render();
    });

    // Tool grid event delegation for detail modal
    toolGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="detail"]');
      if (!btn) return;
      const toolId = btn.getAttribute('data-id');
      if (toolId) {
        showToolDetail(toolId);
      }
    });

    // Modal close events
    modalCloseBtn.addEventListener('click', closeModal);
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && detailModal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  /**
   * Update category badge counters
   */
  function updateCounts() {
    totalCountEl.textContent = toolsData.length;
    countAll.textContent = toolsData.length;

    let aiCount = 0;
    let devCount = 0;
    let fileCount = 0;
    let otherCount = 0;

    toolsData.forEach(t => {
      if (t.category === 'AI開発') aiCount++;
      else if (t.category === '開発支援') devCount++;
      else if (t.category === 'ファイル・PC') fileCount++;
      else otherCount++;
    });

    countAi.textContent = aiCount;
    countDev.textContent = devCount;
    countFile.textContent = fileCount;
    countOther.textContent = otherCount;
  }

  /**
   * Get category class helper
   */
  function getCategoryClass(category) {
    switch (category) {
      case 'AI開発': return 'cat-ai';
      case '開発支援': return 'cat-dev';
      case 'ファイル・PC': return 'cat-file';
      default: return 'cat-other';
    }
  }

  /**
   * Filter and Sort tools
   */
  function getFilteredTools() {
    return toolsData
      .filter(item => {
        // Category match
        if (currentCategory !== 'ALL' && item.category !== currentCategory) {
          return false;
        }

        // Search query match
        if (searchQuery) {
          const matchTarget = [
            item.name || '',
            item.subtitle || '',
            item.description || '',
            item.why || '',
            ...(item.features || []),
            ...(item.tags || [])
          ].join(' ').toLowerCase();

          return matchTarget.includes(searchQuery);
        }

        return true;
      })
      .sort((a, b) => {
        if (currentSort === 'newest') {
          const dateA = a.release_date || '1970-01-01';
          const dateB = b.release_date || '1970-01-01';
          return dateB.localeCompare(dateA);
        } else if (currentSort === 'name') {
          return (a.name || '').localeCompare(b.name || '', 'ja');
        }
        return 0;
      });
  }

  /**
   * Render Compact Cards
   */
  function render() {
    const filtered = getFilteredTools();
    visibleCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
      toolGrid.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    toolGrid.innerHTML = filtered.map(tool => {
      const catClass = getCategoryClass(tool.category);
      const safeGithubUrl = sanitizeUrl(tool.github_url);
      const safeNoteUrl = sanitizeUrl(tool.note_url);
      const safeWebUrl = sanitizeUrl(tool.web_url);
      const hasWeb = !!safeWebUrl;

      // Tags HTML (show top 2-3 tags for brevity)
      const tagsHtml = (tool.tags || [])
        .slice(0, 3)
        .map(t => `<span class="tag-badge">#${escapeHtml(t)}</span>`)
        .join('');

      return `
        <article class="tool-card" data-id="${escapeHtml(tool.id)}">
          <div class="card-top-bar">
            <span class="badge-category ${catClass}">${escapeHtml(tool.category)}</span>
            <button class="btn-detail-text" data-action="detail" data-id="${escapeHtml(tool.id)}" aria-label="${escapeHtml(tool.name)}の詳細を見る">
              <span>詳細・解説</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div class="card-title-group">
            <h2 class="card-title">${escapeHtml(tool.name)}</h2>
            ${tool.subtitle ? `<span class="card-subtitle">${escapeHtml(tool.subtitle)}</span>` : ''}
          </div>

          <p class="card-description">${escapeHtml(tool.description)}</p>

          <div class="card-tags">
            ${tagsHtml}
          </div>

          <div class="card-actions">
            ${safeGithubUrl ? `
              <a href="${escapeHtml(safeGithubUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link btn-github" title="ソースコード (GitHub)">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                <span>GitHub</span>
              </a>
            ` : ''}

            ${safeNoteUrl ? `
              <a href="${escapeHtml(safeNoteUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link btn-note" title="解説記事 (note)">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <span>note</span>
              </a>
            ` : ''}

            ${hasWeb ? `
              <a href="${escapeHtml(safeWebUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link btn-web" title="Webアプリを開く">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span>Web版</span>
              </a>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  /**
   * Show Tool Detail Modal
   */
  function showToolDetail(toolId) {
    const tool = toolsData.find(t => t.id === toolId);
    if (!tool) return;

    const catClass = getCategoryClass(tool.category);
    const featuresList = (tool.features || [])
      .map(f => `<li>${escapeHtml(f)}</li>`)
      .join('');

    const tagsHtml = (tool.tags || [])
      .map(t => `<span class="tag-badge">#${escapeHtml(t)}</span>`)
      .join('');

    const safeWebUrl = sanitizeUrl(tool.web_url);
    const safeGithubUrl = sanitizeUrl(tool.github_url);
    const safeNoteUrl = sanitizeUrl(tool.note_url);
    const safeEyecatch = sanitizeUrl(tool.eyecatch);

    const mediaHtml = safeEyecatch ? `
      <div class="modal-media">
        <img src="${escapeHtml(safeEyecatch)}" alt="${escapeHtml(tool.name)}" loading="lazy">
      </div>
    ` : '';

    modalBody.innerHTML = `
      ${mediaHtml}
      <div class="modal-header-section">
        <div>
          <span class="badge-category ${catClass}">${escapeHtml(tool.category)}</span>
          ${tool.release_date ? `<span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">公開日: ${escapeHtml(tool.release_date)}</span>` : ''}
        </div>
        <h2 id="modalTitle" class="modal-tool-title">${escapeHtml(tool.name)}</h2>
        ${tool.subtitle ? `<span style="color: var(--accent-blue); font-size: 0.9rem; font-weight: 500;">${escapeHtml(tool.subtitle)}</span>` : ''}
      </div>

      <div class="modal-section">
        <div class="modal-section-title">① 何のツールか (What)</div>
        <p class="modal-section-text">${escapeHtml(tool.description)}</p>
      </div>

      ${tool.why ? `
        <div class="modal-section">
          <div class="modal-section-title">② なぜ作ったか (Why)</div>
          <p class="modal-section-text">${escapeHtml(tool.why)}</p>
        </div>
      ` : ''}

      ${featuresList ? `
        <div class="modal-section">
          <div class="modal-section-title">③ 何ができるか (Features)</div>
          <ul class="modal-features-list">
            ${featuresList}
          </ul>
        </div>
      ` : ''}

      <div class="modal-section">
        <div class="modal-section-title">タグ</div>
        <div class="card-tags" style="margin-top: 0.2rem;">
          ${tagsHtml}
        </div>
      </div>

      <div class="modal-actions">
        ${safeWebUrl ? `
          <a href="${escapeHtml(safeWebUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link btn-web" style="flex: 1;">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>Web版を開く</span>
          </a>
        ` : ''}
        ${safeGithubUrl ? `
          <a href="${escapeHtml(safeGithubUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link btn-github" style="flex: 1;">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span>GitHub</span>
          </a>
        ` : ''}
        ${safeNoteUrl ? `
          <a href="${escapeHtml(safeNoteUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link btn-note" style="flex: 1;">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <span>note記事</span>
          </a>
        ` : ''}
      </div>
    `;

    detailModal.classList.add('active');
    detailModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Backward compatibility
  window.showToolDetail = showToolDetail;

  /**
   * Close Modal
   */
  function closeModal() {
    detailModal.classList.remove('active');
    detailModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /**
   * Escape HTML utility
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Sanitize URL to prevent XSS (only http:// or https:// allowed)
   */
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  // Start app
  init();
})();
