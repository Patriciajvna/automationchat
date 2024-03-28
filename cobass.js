const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

// Fungsi screenshoot
async function takeScreenshot(url, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.screenshot({ path: outputPath });
  await browser.close();
}

// Fungsi mengirim pesan gambar ke WhatsApp
async function sendMediaToWhatsApp(mediaPath, number, caption) {
  try {
    const imageData = fs.readFileSync(mediaPath);

    // Mengirim gambar ke WhatsApp menggunakan Axios
    const response = await axios.post('http://localhost:8001/send-media', {
      number: number,
      caption: caption,
      mediaPath: 'D:\\JS\\image\\screenshot.jpg' 
    });

    console.log('Pesan WhatsApp terkirim! Response:', response.data);

    // Tulis log pesan terkirim ke dalam file
    const logMessage = `[${new Date().toLocaleString()}] Pesan WhatsApp terkirim! "${caption}"\n`;
    fs.appendFileSync('message_log.txt', logMessage);

  } catch (error) {
    console.error('Gagal mengirim pesan WhatsApp:', error);
  }
}

// Main Function
async function main() {
  try {
    // Ambil waktu saat ini
    const currentTime = new Date().toLocaleString();

    // Ambil screenshot dari Google (example)
    const mediaPath = 'D:\\JS\\image\\screenshot.jpg'; // Path tempat menyimpan hasil screenshoot (temporary)
    const url = 'https://www.google.com'; // URL yang akan di capture
    await takeScreenshot(url, mediaPath);

    // Buat caption untuk pesan WhatsApp
    const caption = `Screenshot website pada ${currentTime}`;

    // Kirim gambar ke WhatsApp
    await sendMediaToWhatsApp(mediaPath, '+6289674235468', caption);

    console.log('Proses selesai!');

  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  }
}

// Panggil fungsi utama
main();