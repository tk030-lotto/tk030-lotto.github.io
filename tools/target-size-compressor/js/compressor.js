/**
 * TargetSize Compressor - コア画像圧縮エンジン (js/compressor.js)
 * 
 * [設計理由・Why]
 * 1. 二分探索 (O(log N)): 線形探索(0.01刻み100回)を避け、最大8反復(約0.4%精度)で高速に最高品質を算出。
 * 2. 世代劣化(Generation Loss)防止: 解像度縮小時は直前Canvasではなく常に元Imageから直接描画。
 * 3. 白背景合成: JPEG非対応のアルファ透過部が黒塗りになる事故を防ぐため描画前に #FFFFFF を充填。
 * 4. 安全マージン(0.99): 1KB=1000B換算の厳格な提出先チェッカーとの誤差による超過判定を防止。
 */

(function(root) {
// ==========================================================================
// 外部設定モジュール (js/config.js) の読み込み
// ==========================================================================
const Config = typeof require !== 'undefined'
  ? require('./config.js')
  : (typeof root !== 'undefined' && root.CompressorConfig ? root.CompressorConfig : {});

const MIN_QUALITY = Config.MIN_QUALITY !== undefined ? Config.MIN_QUALITY : 0.01;
const MAX_QUALITY = Config.MAX_QUALITY !== undefined ? Config.MAX_QUALITY : 1.00;
const MAX_SEARCH_ITERATIONS = Config.MAX_SEARCH_ITERATIONS !== undefined ? Config.MAX_SEARCH_ITERATIONS : 8;

const RESIZE_SCALE = Config.RESIZE_SCALE !== undefined ? Config.RESIZE_SCALE : 0.85;
const MAX_RESIZE_ATTEMPTS = Config.MAX_RESIZE_ATTEMPTS !== undefined ? Config.MAX_RESIZE_ATTEMPTS : 10;
const MIN_DIMENSION = Config.MIN_DIMENSION !== undefined ? Config.MIN_DIMENSION : 50;

const SAFETY_MARGIN = Config.SAFETY_MARGIN !== undefined ? Config.SAFETY_MARGIN : 0.99;

/**
 * File オブジェクトから非同期に Image オブジェクトを生成
 * メモリリーク防止のためロード完了時に createObjectURL を即時解放
 * @param {File|Blob} file 
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob)) {
      reject(new Error('有効な画像ファイルが指定されていません。'));
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像の読み込み・デコードに失敗しました。対応形式（JPEG/PNG/WebP）かご確認ください。'));
    };
    img.src = objectUrl;
  });
}

/**
 * Canvas を初期化し、白背景を充填した上で元画像を描画
 * [Why: 世代劣化防止] 常に元Imageから直接指定解像度で再サンプリング
 * [Why: 黒塗り防止] 透過PNGのアルファ値を白(#FFFFFF)に置換
 * @param {HTMLCanvasElement} canvas 
 * @param {HTMLImageElement|CanvasImageSource} originalImage 
 * @param {number} width 
 * @param {number} height 
 */
function setupCanvas(canvas, originalImage, width, height) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 透過部分の黒塗り防止
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  
  // 高品質リサンプリング描画
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(originalImage, 0, 0, width, height);
}

/**
 * Canvas の内容を JPEG Blob として非同期エンコード
 * @param {HTMLCanvasElement} canvas 
 * @param {number} quality (0.01〜1.00)
 * @returns {Promise<Blob>}
 */
function encodeJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('JPEGエンコード処理に失敗しました。'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

// ==========================================================================
// コア圧縮ロジック（二分探索 & 解像度フォールバック）
// ==========================================================================

/**
 * 単一の解像度において二分探索で目標容量以下の最大品質を探索
 * @param {HTMLCanvasElement} canvas 
 * @param {number} effectiveTargetBytes 安全マージン適用後の目標バイト数
 * @param {Function} [onProgress] 進捗通知コールバック ({ iteration, quality, currentSize })
 * @param {Function} [encodeFn] テスト用のエンコード差し替え関数（デフォルト: encodeJpeg）
 * @returns {Promise<{ blob: Blob, quality: number }|null>}
 */
async function searchBestQuality(canvas, effectiveTargetBytes, onProgress, encodeFn = encodeJpeg) {
  let minQ = MIN_QUALITY;
  let maxQ = MAX_QUALITY;
  let bestBlob = null;
  let bestQuality = null;

  for (let iter = 0; iter < MAX_SEARCH_ITERATIONS; iter++) {
    // ブラウザの品質マッピングに合わせて小数第2位に丸める
    const midQ = Math.round(((minQ + maxQ) / 2) * 100) / 100;

    // メインスレッドブロック回避（UIレンダリングの隙間を確保）
    await new Promise((r) => setTimeout(r, 0));

    const blob = await encodeFn(canvas, midQ);

    if (onProgress) {
      onProgress({
        iteration: iter + 1,
        maxIterations: MAX_SEARCH_ITERATIONS,
        quality: midQ,
        currentBytes: blob.size,
      });
    }

    if (blob.size <= effectiveTargetBytes) {
      // 目標容量以下：候補として保持し、より高品質側を探索
      bestBlob = blob;
      bestQuality = midQ;
      minQ = midQ;
    } else {
      // 目標容量超過：品質を下げる側を探索
      maxQ = midQ;
    }

    // 早期終了: 探索範囲が小数第2位の精度限界以下に収束した場合
    if (minQ >= maxQ || (bestBlob && Math.abs(maxQ - minQ) < 0.005)) {
      break;
    }
  }

  return bestBlob ? { blob: bestBlob, quality: bestQuality } : null;
}

/**
 * 目標容量以下になるよう二分探索と解像度フォールバックを統括実行
 * @param {HTMLImageElement} originalImage 
 * @param {number} originalFileSize 
 * @param {number} targetBytes 
 * @param {Function} [onProgress] ({ attempt, maxAttempts, iteration, maxIterations, quality, currentBytes, width, height })
 * @param {Object} [options] 内部・テスト用オプション
 * @returns {Promise<{ blob: Blob, quality: number, width: number, height: number, resizeCount: number, effectiveTargetBytes: number }>}
 */
async function compressImage(originalImage, originalFileSize, targetBytes, onProgress, options = {}) {
  if (!originalImage || !originalImage.naturalWidth || !originalImage.naturalHeight) {
    throw new Error('画像の読み込み情報が不正です。');
  }
  if (!targetBytes || targetBytes <= 0) {
    throw new Error('有効な目標容量（バイト数）を指定してください。');
  }

  const effectiveTarget = Math.floor(targetBytes * SAFETY_MARGIN);
  let currentWidth = originalImage.naturalWidth;
  let currentHeight = originalImage.naturalHeight;

  // Canvas要素の作成（Node.jsテスト環境では options.createCanvas を利用可能）
  const canvas = options.canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  const encodeFn = options.encodeFn || encodeJpeg;

  for (let attempt = 0; attempt < MAX_RESIZE_ATTEMPTS; attempt++) {
    // 1. 最小寸法チェック
    if (currentWidth < MIN_DIMENSION || currentHeight < MIN_DIMENSION) {
      throw new Error(`画像の解像度が下限（${MIN_DIMENSION}px）に達したため、これ以上縮小できませんでした。目標容量を増やしてください。`);
    }

    // 2. 白背景充填 + 元画像から直接描画
    if (canvas && options.setupCanvasFn) {
      options.setupCanvasFn(canvas, originalImage, currentWidth, currentHeight);
    } else if (canvas) {
      setupCanvas(canvas, originalImage, currentWidth, currentHeight);
    }

    // 3. 二分探索による最適品質探索
    const progressWrapper = (detail) => {
      if (onProgress) {
        onProgress({
          attempt: attempt + 1,
          maxAttempts: MAX_RESIZE_ATTEMPTS,
          width: currentWidth,
          height: currentHeight,
          ...detail,
        });
      }
    };

    const searchResult = await searchBestQuality(canvas, effectiveTarget, progressWrapper, encodeFn);

    // 4. 目標容量に収まるBlobが得られた場合は成功返却
    if (searchResult) {
      return {
        blob: searchResult.blob,
        quality: searchResult.quality,
        width: currentWidth,
        height: currentHeight,
        resizeCount: attempt,
        effectiveTargetBytes: effectiveTarget,
      };
    }

    // 5. 収まらない場合は解像度を0.85倍へ縮小して次試行へ
    currentWidth = Math.floor(currentWidth * RESIZE_SCALE);
    currentHeight = Math.floor(currentHeight * RESIZE_SCALE);
  }

  throw new Error(`最大試行回数（${MAX_RESIZE_ATTEMPTS}回）を超過しました。目標容量を大きく設定してください。`);
}

// ==========================================================================
// モジュールエクスポート（ブラウザ window / Node.js 双方対応）
// ==========================================================================
const Compressor = {
  ...Config,
  loadImage,
  setupCanvas,
  encodeJpeg,
  searchBestQuality,
  compressImage,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Compressor;
}
if (typeof root !== 'undefined') {
  root.Compressor = Compressor;
}
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
