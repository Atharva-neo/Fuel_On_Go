const QRCode = require('qrcode');

/**
 * Generate a QR code data URL for a booking token.
 */
async function generateQR(data) {
  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(data), {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    });
    return qrDataUrl;
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
}

module.exports = { generateQR };
