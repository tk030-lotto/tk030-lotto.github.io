/**
 * TargetSize Compressor - UI統合制御 (js/app.js)
 * 
 * [設計理由・Why]
 * 1. 300行ルール遵守: DOMイベントハンドリング・状態管理に専念し、画像処理は compressor.js に委任。
 * 2. メモリリーク防止: Object URL は不要になった時点で即座に revokeObjectURL を実行。
 * 3. 命名規則厳守: ダウンロードファイル名は `[元ファイル名]_[実容量]KB.jpg` とする。
 */

(() => {
  'use strict';

  // State
  let selectedFile = null;
  let decodedImage = null;
  let currentThumbnailUrl = null;
  let resultBlob = null;
  let resultBlobUrl = null;
  let isProcessing = false;

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const selectedFileCard = document.getElementById('selected-file-card');
  const thumbnailPreview = document.getElementById('thumbnail-preview');
  const fileMetaName = document.getElementById('file-meta-name');
  const fileMetaDetails = document.getElementById('file-meta-details');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const presetButtons = document.querySelectorAll('.btn-preset');
  const customSizeInput = document.getElementById('custom-size-input');
  const customUnitSelect = document.getElementById('custom-unit-select');
  const btnCompress = document.getElementById('btn-compress');
  const progressBox = document.getElementById('progress-box');
  const progressText = document.getElementById('progress-text');
  const resultCard = document.getElementById('result-card');
  const metricOriginalSize = document.getElementById('metric-original-size');
  const metricResultSize = document.getElementById('metric-result-size');
  const metricReductionRate = document.getElementById('metric-reduction-rate');
  const metricQualityInfo = document.getElementById('metric-quality-info');
  const resultPreviewImg = document.getElementById('result-preview-img');
  const btnDownload = document.getElementById('btn-download');
  const btnDownloadText = document.getElementById('btn-download-text');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  let toastTimer = null;

  // --------------------------------------------------------------------------
  // UI Helpers
  // --------------------------------------------------------------------------
  function showToast(message, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, 3500);
  }

  function getTargetBytes() {
    const val = parseFloat(customSizeInput.value);
    if (isNaN(val) || val <= 0) return 0;
    const unit = customUnitSelect.value;
    return unit === 'MB' ? Math.round(val * 1024 * 1024) : Math.round(val * 1024);
  }

  function updateActionState() {
    const targetBytes = getTargetBytes();
    btnCompress.disabled = !selectedFile || !decodedImage || isProcessing || targetBytes <= 0;
  }

  // --------------------------------------------------------------------------
  // File Handling & Memory Cleanup
  // --------------------------------------------------------------------------
  function clearResult() {
    if (resultBlobUrl) {
      URL.revokeObjectURL(resultBlobUrl);
      resultBlobUrl = null;
    }
    resultBlob = null;
    resultCard.style.display = 'none';
    resultPreviewImg.src = '';
  }

  function resetFileSelection() {
    if (currentThumbnailUrl) {
      URL.revokeObjectURL(currentThumbnailUrl);
      currentThumbnailUrl = null;
    }
    selectedFile = null;
    decodedImage = null;
    fileInput.value = '';
    selectedFileCard.style.display = 'none';
    dropzone.style.display = 'block';
    clearResult();
    updateActionState();
  }

  async function handleFile(file) {
    if (!file || isProcessing) return;

    // 非対応フォーマット検出 (HEIC等のチェック)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      showToast('この形式は直接読み込めません。JPEG/PNG/WebP画像を選択してください。', true);
      return;
    }

    clearResult();
    if (currentThumbnailUrl) URL.revokeObjectURL(currentThumbnailUrl);

    try {
      progressText.textContent = '画像読み込み中...';
      const img = await Compressor.loadImage(file);
      selectedFile = file;
      decodedImage = img;

      // サムネイル表示
      currentThumbnailUrl = URL.createObjectURL(file);
      thumbnailPreview.src = currentThumbnailUrl;
      fileMetaName.textContent = file.name;
      fileMetaDetails.textContent = `${img.naturalWidth} × ${img.naturalHeight} px | ${Compressor.formatFileSize(file.size)}`;

      dropzone.style.display = 'none';
      selectedFileCard.style.display = 'flex';
      updateActionState();

      // 目標容量と比較して案内
      const targetBytes = getTargetBytes();
      if (file.size <= targetBytes * Compressor.SAFETY_MARGIN) {
        showToast(`この画像はすでに目標容量（${Compressor.formatFileSize(targetBytes)}）以下です。`, false);
      }
    } catch (err) {
      showToast(err.message, true);
      resetFileSelection();
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners (Dropzone & Presets) - QA-001: isProcessing ガード配置
  // --------------------------------------------------------------------------
  dropzone.addEventListener('click', () => { if (!isProcessing) fileInput.click(); });
  fileInput.addEventListener('change', (e) => {
    if (!isProcessing && e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isProcessing) dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (!isProcessing && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  btnRemoveFile.addEventListener('click', () => { if (!isProcessing) resetFileSelection(); });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      customSizeInput.value = btn.dataset.size;
      customUnitSelect.value = btn.dataset.unit;
      updateActionState();
    });
  });

  customSizeInput.addEventListener('input', () => {
    presetButtons.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
    updateActionState();
  });

  customUnitSelect.addEventListener('change', () => {
    presetButtons.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
    updateActionState();
  });

  // --------------------------------------------------------------------------
  // Compression Execution (QA-002: すでに目標容量以下の場合の保護・選択肢)
  // --------------------------------------------------------------------------
  btnCompress.addEventListener('click', async () => {
    if (!selectedFile || !decodedImage || isProcessing) return;

    const targetBytes = getTargetBytes();
    if (targetBytes <= 0) {
      showToast('有効な目標容量を入力してください。', true);
      return;
    }

    // QA-002: すでに目標容量以下の場合はスキップ/再圧縮の選択肢を提供
    if (selectedFile.size <= targetBytes) {
      const proceed = window.confirm(
        `この画像はすでに目標容量（${Compressor.formatFileSize(targetBytes)}）以下です（現在: ${Compressor.formatFileSize(selectedFile.size)}）。\n\n` +
        `【OK】: 画質低下を許容してさらに圧縮を実行\n` +
        `【キャンセル】: 再圧縮をスキップし、元画像をそのままダウンロード`
      );
      if (!proceed) {
        clearResult();
        resultBlob = selectedFile;
        resultBlobUrl = URL.createObjectURL(selectedFile);
        metricOriginalSize.textContent = Compressor.formatFileSize(selectedFile.size);
        metricResultSize.textContent = Compressor.formatFileSize(selectedFile.size);
        metricReductionRate.textContent = '0.0% (維持)';
        metricQualityInfo.textContent = '元画像そのまま (100%)';
        resultPreviewImg.src = resultBlobUrl;
        const resultKb = Math.max(1, Math.round(selectedFile.size / 1024));
        btnDownloadText.textContent = `元画像をダウンロード (${resultKb} KB)`;
        resultCard.style.display = 'block';
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('再圧縮をスキップし、元画像をセットしました。');
        return;
      }
    }

    isProcessing = true;
    updateActionState();
    progressBox.style.display = 'flex';
    clearResult();

    try {
      const result = await Compressor.compressImage(
        decodedImage,
        selectedFile.size,
        targetBytes,
        (p) => {
          const attemptText = p.attempt > 1 ? ` (縮小再試行: ${p.attempt}/${p.maxAttempts}回)` : '';
          progressText.textContent = `品質探索中: ${p.iteration}/${p.maxIterations}回 (品質: ${Math.round(p.quality * 100)}%)${attemptText}`;
        }
      );

      resultBlob = result.blob;
      resultBlobUrl = URL.createObjectURL(result.blob);

      metricOriginalSize.textContent = Compressor.formatFileSize(selectedFile.size);
      metricResultSize.textContent = Compressor.formatFileSize(result.blob.size);
      const reduction = Compressor.calculateReductionRate(selectedFile.size, result.blob.size);
      metricReductionRate.textContent = `${reduction}% 削減`;
      const resizeInfo = result.resizeCount > 0 ? ` (${result.width}×${result.height})` : '';
      metricQualityInfo.textContent = `品質: ${Math.round(result.quality * 100)}%${resizeInfo}`;

      resultPreviewImg.src = resultBlobUrl;
      const resultKb = Math.max(1, Math.round(result.blob.size / 1024));
      btnDownloadText.textContent = `画像をダウンロード (${resultKb} KB)`;

      resultCard.style.display = 'block';
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast('目標容量以下への圧縮が完了しました！');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      isProcessing = false;
      progressBox.style.display = 'none';
      updateActionState();
    }
  });

  // --------------------------------------------------------------------------
  // Download Handling
  // --------------------------------------------------------------------------
  btnDownload.addEventListener('click', () => {
    if (!resultBlob || !resultBlobUrl || !selectedFile) return;

    // 不正文字（/ \ : * ? " < > | および制御文字）をサニタイズ
    const rawBase = selectedFile.name.replace(/\.[^/.]+$/, '');
    const baseName = rawBase.replace(/[\/\\:*?"<>|\x00-\x1f\x7f]/g, '_').trim() || 'image';
    const ext = resultBlob === selectedFile ? (selectedFile.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') : 'jpg';
    const resultKb = Math.max(1, Math.round(resultBlob.size / 1024));
    const downloadFilename = `${baseName}_${resultKb}KB.${ext}`;

    const a = document.createElement('a');
    a.href = resultBlobUrl;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast(`「${downloadFilename}」をダウンロードしました`);
  });

  // Initial setup
  updateActionState();
})();
