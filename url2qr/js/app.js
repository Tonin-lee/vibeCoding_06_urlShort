/**
 * QR Code Generator Application
 * Smooth animation, Glassmorphism UI, High-quality JPG export
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const btnClear = document.getElementById('btnClear');
  const btnSubmit = document.getElementById('btnSubmit');
  const qrcodeContainer = document.getElementById('qrcode');
  const qrCard = document.getElementById('qrCard');
  const qrTargetUrl = document.getElementById('qrTargetUrl');
  const btnDownloadJpg = document.getElementById('btnDownloadJpg');
  const btnCopyUrl = document.getElementById('btnCopyUrl');
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  const inputGlowWrapper = document.querySelector('.input-glow-wrapper');

  let currentQrCodeInstance = null;
  let currentUrl = '';
  let toastTimeout = null;

  // --------------------------------------------------------------------------
  // Interactive Cursor-following Gradient Engine
  // --------------------------------------------------------------------------
  // 공통 gradient.js에서 배경 효과를 처리합니다.

  // --------------------------------------------------------------------------
  // Helper: Toast Notification
  // --------------------------------------------------------------------------
  function showToast(message, duration = 2600) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toastMessage.textContent = message;
    toastNotification.classList.add('show');

    toastTimeout = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, duration);
  }

  // --------------------------------------------------------------------------
  // Helper: Format & Clean URL
  // --------------------------------------------------------------------------
  function formatUrl(rawInput) {
    let trimmed = rawInput.trim();
    if (!trimmed) return '';

    // If it looks like a domain without protocol (e.g. naver.com, www.naver.com), prepend https://
    const hasProtocol = /^[a-zA-Z]+:\/\//i.test(trimmed);
    if (!hasProtocol && /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  // --------------------------------------------------------------------------
  // Helper: Trigger Shake Animation on Error
  // --------------------------------------------------------------------------
  function triggerInputError() {
    if (inputGlowWrapper) {
      inputGlowWrapper.classList.remove('input-shake');
      void inputGlowWrapper.offsetWidth; // trigger reflow
      inputGlowWrapper.classList.add('input-shake');
    }
    urlInput.focus();
  }

  // --------------------------------------------------------------------------
  // Core: Generate QR Code
  // --------------------------------------------------------------------------
  function generateQRCode(text) {
    if (!text) {
      triggerInputError();
      return;
    }

    try {
      // Clear previous QR elements
      qrcodeContainer.innerHTML = '';

      // Calculate responsive QR size
      const isMobile = window.innerWidth <= 640;
      const qrSize = isMobile ? 220 : 260;

      // Check if QRCode library is available
      if (typeof QRCode !== 'undefined') {
        currentQrCodeInstance = new QRCode(qrcodeContainer, {
          text: text,
          width: qrSize,
          height: qrSize,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : 2
        });
      } else {
        // Fallback: Using Image element via QR Server
        const fallbackImg = document.createElement('img');
        fallbackImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(text)}&margin=0`;
        fallbackImg.alt = "QR Code";
        fallbackImg.crossOrigin = "anonymous";
        qrcodeContainer.appendChild(fallbackImg);
      }

      currentUrl = text;
      qrTargetUrl.textContent = text;
      qrTargetUrl.title = text;

      // Trigger animation: move input bar to bottom dock and show QR in center
      document.body.classList.add('has-qr');
    } catch (err) {
      console.error('QR Generation failed:', err);
      showToast('QR 코드 생성 중 오류가 발생했습니다.');
    }
  }

  // --------------------------------------------------------------------------
  // Core: Export QR Code to High-Quality JPG File
  // --------------------------------------------------------------------------
  function downloadQrAsJpg() {
    if (!currentUrl) {
      showToast('생성된 QR 코드가 없습니다.');
      return;
    }

    try {
      // Find rendered canvas or image element inside qrcodeContainer
      let sourceCanvas = qrcodeContainer.querySelector('canvas');
      let sourceImg = qrcodeContainer.querySelector('img');

      // Create a high-res offscreen canvas for crisp JPG rendering with clean white padding
      const exportCanvas = document.createElement('canvas');
      const exportCtx = exportCanvas.getContext('2d');
      const targetSize = 600; // 600x600 high-res
      const padding = 50;
      const innerSize = targetSize - padding * 2;

      exportCanvas.width = targetSize;
      exportCanvas.height = targetSize;

      // Fill pure white background (essential for JPG since it has no transparency)
      exportCtx.fillStyle = '#FFFFFF';
      exportCtx.fillRect(0, 0, targetSize, targetSize);

      if (sourceCanvas && sourceCanvas.width > 0) {
        // Draw directly from existing canvas
        exportCtx.drawImage(sourceCanvas, padding, padding, innerSize, innerSize);
        triggerDownload(exportCanvas);
      } else if (sourceImg && sourceImg.src) {
        // Draw from img element
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = () => {
          exportCtx.drawImage(tempImg, padding, padding, innerSize, innerSize);
          triggerDownload(exportCanvas);
        };
        tempImg.onerror = () => {
          showToast('이미지 변환 중 오류가 발생했습니다.');
        };
        tempImg.src = sourceImg.src;
      } else {
        showToast('QR 코드 이미지를 준비하는 중입니다. 다시 클릭해 주세요.');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('다운로드 중 문제가 발생했습니다.');
    }
  }

  function triggerDownload(canvas) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const fileName = `qrcode_${dateStr}_${timeStr}.jpg`;

    // Convert to JPG data URL with 0.95 quality
    const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Create a virtual download link
    const downloadLink = document.createElement('a');
    downloadLink.href = jpgUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    showToast('✨ JPG 파일로 다운로드되었습니다!');
  }

  // --------------------------------------------------------------------------
  // Main Action: Trigger Generation
  // --------------------------------------------------------------------------
  function handleGenerateAction() {
    const rawValue = urlInput.value.trim();
    if (!rawValue) {
      triggerInputError();
      return;
    }
    const targetUrl = formatUrl(rawValue);
    generateQRCode(targetUrl);
  }

  // --------------------------------------------------------------------------
  // Event Bindings
  // --------------------------------------------------------------------------

  // 1. Submit Button Click
  btnSubmit.addEventListener('click', (e) => {
    e.preventDefault();
    handleGenerateAction();
  });

  // 2. Form Submission (Enter key inside input)
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleGenerateAction();
  });

  // 3. Input Keydown (Direct Enter key handling)
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGenerateAction();
    }
  });

  // 4. Input Text Changes & Clear button visibility
  urlInput.addEventListener('input', () => {
    btnClear.style.display = urlInput.value.length > 0 ? 'flex' : 'none';
  });

  btnClear.addEventListener('click', () => {
    urlInput.value = '';
    btnClear.style.display = 'none';
    urlInput.focus();
  });

  // 5. Click on QR Card to download JPG
  qrCard.addEventListener('click', (e) => {
    e.preventDefault();
    downloadQrAsJpg();
  });

  // 6. Download JPG button click
  btnDownloadJpg.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadQrAsJpg();
  });

  // 7. Copy URL button click
  btnCopyUrl.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentUrl) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = currentUrl;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
      }
      showToast('📋 링크가 클립보드에 복사되었습니다.');
    } catch (err) {
      showToast('링크 복사에 실패했습니다.');
    }
  });

  // 8. Click Logo to Reset to Initial State
  const logoContainer = document.getElementById('logoContainer');
  if (logoContainer) {
    logoContainer.addEventListener('click', () => {
      document.body.classList.remove('has-qr');
      urlInput.value = '';
      btnClear.style.display = 'none';
      setTimeout(() => {
        urlInput.focus();
      }, 300);
    });
  }

  // 9. Keyboard shortcut: Escape to refocus input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      urlInput.focus();
      urlInput.select();
    }
  });
});
