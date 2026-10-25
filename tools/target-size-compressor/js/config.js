/**
 * TargetSize Compressor - 共通設定定数 & ユーティリティ (js/config.js)
 * 
 * [設計理由・Why]
 * 1. 1ファイル1責務: 画像圧縮エンジン(compressor.js)から設定定数およびUIフォーマット処理を分離。
 * 2. 拡張性・ヘッドルーム確保: プリセット変更や単位追加の際にコアアルゴリズムへ影響を及ぼさない。
 * 3. マルチ環境互換: ブラウザ(window)およびNode.js(module.exports)の双方で動作。
 */

(function(root) {
  // ==========================================================================
  // 1. アルゴリズム・リサイズ設定定数
  // ==========================================================================
  const MIN_QUALITY = 0.01;
  const MAX_QUALITY = 1.00;
  const MAX_SEARCH_ITERATIONS = 8;

  const RESIZE_SCALE = 0.85;
  const MAX_RESIZE_ATTEMPTS = 10;
  const MIN_DIMENSION = 50; // 幅・高さの最小ピクセル数下限

  const SAFETY_MARGIN = 0.99; // 目標容量に対する安全マージン係数

  const PRESET_TARGETS = {
    '200KB': 200 * 1024,
    '500KB': 500 * 1024,
    '1MB': 1 * 1024 * 1024,
    '2MB': 2 * 1024 * 1024,
  };

  // ==========================================================================
  // 2. 汎用ユーティリティ関数
  // ==========================================================================

  /**
   * バイト数を人が読みやすい単位（Bytes, KB, MB）にフォーマット
   * @param {number} bytes 
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * 削減率（%）を算出（小数第1位丸め）
   * @param {number} originalBytes 
   * @param {number} resultBytes 
   * @returns {number} 0以上の削減率(%)
   */
  function calculateReductionRate(originalBytes, resultBytes) {
    if (!originalBytes || originalBytes <= 0 || !resultBytes || resultBytes <= 0) return 0;
    if (resultBytes >= originalBytes) return 0;
    const rate = ((originalBytes - resultBytes) / originalBytes) * 100;
    return Math.round(rate * 10) / 10;
  }

  // ==========================================================================
  // 3. モジュールエクスポート（ブラウザ window / Node.js 双方対応）
  // ==========================================================================
  const CompressorConfig = {
    MIN_QUALITY,
    MAX_QUALITY,
    MAX_SEARCH_ITERATIONS,
    RESIZE_SCALE,
    MAX_RESIZE_ATTEMPTS,
    MIN_DIMENSION,
    SAFETY_MARGIN,
    PRESET_TARGETS,
    formatFileSize,
    calculateReductionRate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompressorConfig;
  }
  if (typeof root !== 'undefined') {
    root.CompressorConfig = CompressorConfig;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
