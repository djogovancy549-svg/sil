import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Ensure data folder and files exist
const DATA_DIR = path.resolve(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const REGULATIONS_FILE = path.join(DATA_DIR, 'regulations.json');

async function ensureDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {}

  try {
    await fs.access(CONFIG_FILE);
  } catch {
    const defaultConfig = {
      regulationTitle: "Sistem Informasi Legislatif & Uji Publik Nasional",
      regulationDesc: "Pusat partisipasi masyarakat untuk memberikan kritik, saran, dan draf redaksi alternatif terhadap rancangan peraturan aktif.",
      drivePdfUrl: "",
      googleSheetUrl: "https://docs.google.com/spreadsheets/d/1Zt-Y0hW5c_M7fA3mG6V4rS0gHw2eP0_C3G2U-E7R6u4/edit?usp=sharing",
      googleSheetEmbedUrl: "",
      googleSheetAppsScriptUrl: "https://script.google.com/macros/s/AKfycbw2qQD6Z4UK2B2gwol_xqZrxZ6TxPnErE5Z5dRCWCRhchbrfejH7ng7bTNCt7P_F1RPxg/exec",
      adminPasscode: "publik2026"
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }

  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch {
    await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  try {
    await fs.access(REGULATIONS_FILE);
  } catch {
    const defaultRegulations = {
      activeDrafts: [],
      enactedRegulations: []
    };
    await fs.writeFile(REGULATIONS_FILE, JSON.stringify(defaultRegulations, null, 2), 'utf-8');
  }
}

async function startServer() {
  await ensureDataFiles();

  const app = express();
  app.use(express.json());

  // API Endpoints
  app.get('/api/config', async (req, res) => {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      const { adminPasscode, ...publicConfig } = config;
      res.json(publicConfig);
    } catch (error) {
      res.status(500).json({ error: 'Failed to read configuration.' });
    }
  });

  // Fetch all regulations (Active Drafts & Enacted ones)
  app.get('/api/regulations', async (req, res) => {
    try {
      const data = await fs.readFile(REGULATIONS_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(500).json({ error: 'Failed to read regulations list.' });
    }
  });

  app.get('/api/submissions', async (req, res) => {
    try {
      const data = await fs.readFile(SUBMISSIONS_FILE, 'utf-8');
      const submissions = JSON.parse(data);
      res.json({
        count: submissions.length,
        quota: 100,
        submissions: submissions.map((sub: any) => ({
          id: sub.id,
          timestamp: sub.timestamp,
          nama: sub.isAnonymous ? 'Masyarakat Anonim' : sub.nama,
          isAnonymous: sub.isAnonymous,
          profesi: sub.profesi,
          instansi: sub.isAnonymous ? '' : sub.instansi,
          keahlian: sub.keahlian,
          pasal: sub.pasal,
          kritik: sub.kritik,
          rekomendasi: sub.rekomendasi
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to read submissions.' });
    }
  });

  app.post('/api/submissions', async (req, res) => {
    try {
      const { nama, isAnonymous, profesi, instansi, email, noHp, ...rest } = req.body;
      const kritik = req.body.kritik;
      const rekomendasi = req.body.rekomendasi;
      const pasal = req.body.pasal;

      if (!profesi || !pasal || !kritik || !rekomendasi) {
        return res.status(400).json({ error: 'Mohon lengkapi kolom profesi, draf peraturan, kritik, dan rekomendasi.' });
      }
      if (!isAnonymous && !nama) {
        return res.status(400).json({ error: 'Mohon isi nama lengkap Anda atau centang kirim sebagai anonim.' });
      }

      const subsData = await fs.readFile(SUBMISSIONS_FILE, 'utf-8');
      const submissions = JSON.parse(subsData);

      if (submissions.length >= 100) {
        return res.status(400).json({ error: 'Batas kuota 100 pengkritik telah terpenuhi. Formulir pendaftaran kritik ditutup.' });
      }

      const newSubmission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        nama: isAnonymous ? 'Masyarakat Anonim' : nama,
        isAnonymous: !!isAnonymous,
        profesi,
        instansi: isAnonymous ? '' : (instansi || ''),
        email: email || '',
        noHp: noHp || '',
        keahlian: req.body.keahlian || 'Umum',
        pasal,
        kritik,
        rekomendasi
      };

      submissions.push(newSubmission);
      await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');

      // Forward to Google Sheets webhook if configured
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);

      // We read the webhook target directly from the configuration file
      const webhookUrl = config.googleSheetAppsScriptUrl;

      if (webhookUrl) {
        try {
          const payload = {
            id: newSubmission.id,
            timestamp: newSubmission.timestamp,
            nama: newSubmission.nama,
            isAnonymous: newSubmission.isAnonymous ? "Ya" : "Tidak",
            profesi: newSubmission.profesi,
            instansi: newSubmission.instansi,
            email: newSubmission.email,
            noHp: newSubmission.noHp,
            keahlian: newSubmission.keahlian,
            pasal: newSubmission.pasal,
            kritik: newSubmission.kritik,
            rekomendasi: newSubmission.rekomendasi
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          fetch(webhookUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          }).then((res) => {
            clearTimeout(timeoutId);
            console.log('Forward to Sheets Status:', res.status);
          }).catch((err) => {
            clearTimeout(timeoutId);
            console.error('Apps Script forwarding failed:', err.message);
          });
        } catch (err: any) {
          console.error('Failed to trigger AppScript fetch:', err.message);
        }
      }

      res.status(201).json({
        message: 'Kritik dan saran Anda berhasil direkam dalam uji publik!',
        submission: {
          id: newSubmission.id,
          timestamp: newSubmission.timestamp,
          nama: newSubmission.nama,
          isAnonymous: newSubmission.isAnonymous,
          profesi: newSubmission.profesi,
          keahlian: newSubmission.keahlian,
          pasal: newSubmission.pasal,
          kritik: newSubmission.kritik,
          rekomendasi: newSubmission.rekomendasi
        },
        currentCount: submissions.length
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Terjadi kesalahan server saat menyimpan kritik.' });
    }
  });

  // Mount Vite Dev Server in dev mode, or serve static folder in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use('*', async (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server is running in ${isProd ? 'production' : 'development'} mode on http://localhost:${PORT}`);
  });
}

startServer();
