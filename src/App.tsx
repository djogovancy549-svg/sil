import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  UserCheck,
  Users,
  FileText,
  BookmarkCheck,
  ExternalLink,
  History,
  FileSpreadsheet,
  BookOpen,
  BarChart3,
  TrendingUp,
  PieChart,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import bgWatermark from './assets/images/legal_green_watermark_1790310008588.jpg';

// Hardcoded Google Sheet & Webhook Apps Script URLs embedded directly into the coding
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1CHwIRAvR7M3Sd3TdxgPYBYsdhUUqdGvFs_MzOVaMt3s/edit?usp=sharing";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjdpnRP594490VM3AofTJPox_v0v8JSJ23P7OxnTV9dQKExvMH-8NqRr0iFLQEs72RDw/exec";

interface ActiveDraft {
  id: string;
  no: string;
  title: string;
  desc: string;
  category: string;
  drivePdfUrl?: string; // Embedded Drive PDF URL read from Google Sheet!
  status: string;
}

interface EnactedRegulation {
  id: string;
  no: string;
  title: string;
  year: string;
  desc: string;
  drivePdfUrl?: string;
  status: string;
}

export default function App() {
  // State
  const [activeDrafts, setActiveDrafts] = useState<ActiveDraft[]>([]);
  const [enactedRegulations, setEnactedRegulations] = useState<EnactedRegulation[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Selected draft row details
  const [selectedDraft, setSelectedDraft] = useState<ActiveDraft | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    isAnonymous: false,
    profesi: 'Masyarakat Umum',
    instansi: '',
    email: '',
    noHp: '',
    keahlian: '',
    pasal: '', // Becomes selected Topic Name
    kritik: '',
    rekomendasi: '',
    agreed: false
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isFetchedFromSheet, setIsFetchedFromSheet] = useState<boolean>(false);

  // Fetch regulations from Google Sheets Webhook or server endpoint
  const fetchData = async () => {
    try {
      setLoading(true);
      
      let fetchedDrafts: ActiveDraft[] = [];
      let fetchedEnacted: EnactedRegulation[] = [];

      // 1. Coba ambil langsung dari Google Apps Script Webhook (Untuk Hosting Cloudflare Pages)
      try {
        const scriptRes = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?api=true`, {
          method: 'GET',
          redirect: 'follow',
        });
        if (scriptRes.ok) {
          const scriptData = await scriptRes.json();
          if (scriptData.activeDrafts && scriptData.activeDrafts.length > 0) {
            fetchedDrafts = scriptData.activeDrafts;
            fetchedEnacted = scriptData.enactedRegulations || [];
            setIsFetchedFromSheet(true);
          }
        }
      } catch (scriptErr) {
        console.warn("Direct Apps Script fetch failed (CORS or network), checking fallback server API...");
      }

      // 2. Jika di Cloudflare gagal karena CORS atau saat dev lokal, gunakan server API
      if (fetchedDrafts.length === 0) {
        try {
          const regsRes = await fetch('/api/regulations');
          if (regsRes.ok) {
            const regsData = await regsRes.json();
            fetchedDrafts = regsData.activeDrafts || [];
            fetchedEnacted = regsData.enactedRegulations || [];
            setIsFetchedFromSheet(fetchedDrafts.length > 0);
          }
        } catch (err) {
          console.warn("Error fetching regulations from /api:", err);
        }
      }

      // 3. Hitung Kuota Pengirim (Bisa dari server atau local storage jika di Cloudflare)
      try {
        const subsRes = await fetch('/api/submissions');
        if (subsRes.ok) {
          const subsData = await subsRes.json();
          setTotalCount(subsData.count);
        } else {
          // Fallback kuota untuk Cloudflare Pages murni
          const localCount = parseInt(localStorage.getItem('ujipublik_submission_count') || '0', 10);
          setTotalCount(localCount);
        }
      } catch (err) {
        const localCount = parseInt(localStorage.getItem('ujipublik_submission_count') || '0', 10);
        setTotalCount(localCount);
      }

      setActiveDrafts(fetchedDrafts);
      setEnactedRegulations(fetchedEnacted);

      // Auto-select first draft row as selected if available
      if (fetchedDrafts.length > 0) {
        const defaultDraft = fetchedDrafts[0];
        setSelectedDraft(defaultDraft);
        setFormData(prev => ({
          ...prev,
          pasal: `${defaultDraft.no} - ${defaultDraft.title}`
        }));
      }

    } catch (error) {
      console.error("Error loading application resources:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectDraft = (draft: ActiveDraft) => {
    setSelectedDraft(draft);
    setFormData(prev => ({
      ...prev,
      pasal: `${draft.no} - ${draft.title}`
    }));
    
    // Smooth scroll on mobile to the form card
    if (window.innerWidth < 1024) {
      const formElement = document.getElementById('aspirasi-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validation
    if (totalCount >= 100) {
      setFormError("Mohon maaf, batas kuota pendaftaran 100 pengkritik telah penuh.");
      return;
    }
    if (!formData.isAnonymous && !formData.nama.trim()) {
      setFormError("Silakan isi nama lengkap Anda atau aktifkan opsi 'Kirim sebagai Anonim'.");
      return;
    }
    if (!formData.pasal.trim()) {
      setFormError("Silakan pilih draf regulasi pada tabel sebelah kiri.");
      return;
    }
    if (!formData.kritik.trim()) {
      setFormError("Deskripsi kritik atau keberatan Anda tidak boleh kosong.");
      return;
    }
    if (!formData.rekomendasi.trim()) {
      setFormError("Silakan berikan alternatif solusi atau rekomendasi perbaikan konkret.");
      return;
    }
    if (!formData.agreed) {
      setFormError("Anda wajib menyetujui pernyataan pertanggungjawaban publik.");
      return;
    }

    setSubmitting(true);
    try {
      let submissionSuccess = false;
      let successMessage = "Kritik dan aspirasi Anda berhasil tersimpan dalam uji publik!";

      // 1. Coba kirim via server lokal/proxy terlebih dahulu
      try {
        const response = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const result = await response.json();
          successMessage = result.message || successMessage;
          submissionSuccess = true;
        }
      } catch (proxyErr) {
        console.warn("Backend proxy submission failed, trying direct Google Apps Script for Cloudflare...");
      }

      // 2. Jika di Cloudflare Pages (tanpa server backend), kirim langsung ke Webhook Google Apps Script
      if (!submissionSuccess && GOOGLE_APPS_SCRIPT_URL) {
        try {
          const directPayload = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
            timestamp: new Date().toISOString(),
            nama: formData.isAnonymous ? "Masyarakat Anonim" : formData.nama,
            isAnonymous: formData.isAnonymous ? "Ya" : "Tidak",
            profesi: formData.profesi,
            instansi: formData.isAnonymous ? "" : (formData.instansi || ""),
            email: formData.email || "",
            noHp: formData.noHp || "",
            keahlian: formData.keahlian || "Umum",
            pasal: formData.pasal,
            kritik: formData.kritik,
            rekomendasi: formData.rekomendasi
          };

          // Menggunakan fetch direct dengan mode text / no-cors agar lolos di Cloudflare tanpa terblokir browser
          await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(directPayload)
          });

          // Catat kuota lokal di browser
          const curr = parseInt(localStorage.getItem('ujipublik_submission_count') || '0', 10);
          localStorage.setItem('ujipublik_submission_count', (curr + 1).toString());
          setTotalCount(curr + 1);

          submissionSuccess = true;
        } catch (directErr) {
          console.error("Direct Apps Script submission error:", directErr);
        }
      }

      if (submissionSuccess) {
        setFormSuccess(successMessage);
        
        // Reset form inputs (preserve current topic)
        setFormData(prev => ({
          ...prev,
          nama: '',
          isAnonymous: false,
          instansi: '',
          email: '',
          noHp: '',
          keahlian: '',
          kritik: '',
          rekomendasi: '',
          agreed: false
        }));

        fetchData();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setFormError("Gagal mengirimkan kritik. Silakan periksa koneksi internet Anda.");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setFormError("Terjadi gangguan koneksi. Kritik Anda belum tersimpan.");
    } finally {
      setSubmitting(false);
    }
  };

  const getQuotaColor = () => {
    if (totalCount >= 100) return 'bg-rose-600';
    if (totalCount >= 85) return 'bg-amber-500';
    return 'bg-emerald-600';
  };

  const getQuotaBgColor = () => {
    if (totalCount >= 100) return 'bg-rose-50 border-rose-200 text-rose-800';
    if (totalCount >= 85) return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  };

  return (
    <div 
      className="min-h-screen text-slate-800 font-sans antialiased flex flex-col relative"
      style={{ 
        backgroundImage: `linear-gradient(rgba(248, 250, 252, 0.95), rgba(248, 250, 252, 0.95)), url(${bgWatermark})`,
        backgroundSize: '360px',
        backgroundRepeat: 'repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Decorative Gradient Accent Line */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-700 via-sky-500 to-emerald-500 w-full" />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-xs py-3.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Logo / Brand Name */}
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl shadow-md flex items-center justify-center text-white flex-shrink-0">
              <Scale className="h-5 sm:h-5.5 w-5 sm:w-5.5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start space-x-2">
                <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-indigo-700 uppercase bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-xs">
                  Sistem Informasi Legislatif
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-emerald-700 uppercase bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-xs animate-pulse">
                  {isFetchedFromSheet ? "Live Google Sheet" : "Database Terpadu"}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight mt-0.5">
                Portal Transparansi & Uji Publik Peraturan NKRI
              </h1>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center space-x-1.5 bg-emerald-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-100 text-[10px] sm:text-xs font-bold text-emerald-800 shadow-3xs">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Formulir Terbuka</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 lg:py-10 flex-1 w-full space-y-6">
        
        {/* Info header about Google Sheet real-time synchronization */}
        <div className="bg-slate-900 text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.06),transparent_60%)]" />
          <div className="relative z-10 max-w-xl">
            <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-300 font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-emerald-500/20 inline-block mb-1.5">
              Integrasi Google Sheets Penuh
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-white leading-snug">
              Semua Draf & Formulir Terhubung ke Google Sheet
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
              Sistem membaca data draf peraturan langsung dari lembar kerja Google Sheet dan mengalirkan masukan kritik publik ke sana melalui Webhook Apps Script secara instan.
            </p>
          </div>

          {/* Sync status indicator */}
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg flex-shrink-0 text-xs space-y-1 relative z-10 w-full md:w-auto">
            <div className="flex justify-between md:justify-start gap-4">
              <span className="text-slate-400">Sheet ID:</span>
              <span className="font-mono text-emerald-400 text-[10px]">1CHwIRAvR7M3...</span>
            </div>
            <div className="flex justify-between md:justify-start gap-4">
              <span className="text-slate-400">Sinkronisasi:</span>
              <span className="font-bold text-slate-100 flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block mr-1" />
                <span>Otomatis / Real-Time</span>
              </span>
            </div>
          </div>
        </div>

        {/* STATISTIK & GRAFIK PARTISIPASI PUBLIK */}
        {!loading && (
          <div className="space-y-4">
            {/* 4 Key Performance Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Draf Uji Publik</span>
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">{activeDrafts.length}</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
                  Terbuka untuk Dikritisi
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs hover:border-sky-300 transition-all">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">UU Pembanding</span>
                  <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
                    <History className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">{enactedRegulations.length}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-1">Dasar Acuan Konstitusi</div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs hover:border-emerald-300 transition-all">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Kritik Masuk</span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">{totalCount} <span className="text-xs text-slate-400 font-normal">/ 100</span></div>
                <div className="text-[10px] text-indigo-600 font-semibold mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  Tercatat Real-time
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-3xs hover:border-amber-300 transition-all">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Sisa Kuota Uji</span>
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">{Math.max(0, 100 - totalCount)}</div>
                <div className="text-[10px] text-amber-600 font-semibold mt-1">Slot Publik Tersedia</div>
              </div>
            </div>

            {/* VISUAL GRAFIK PARTISIPASI & PROGRESS BAR */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Progress Bar Kuota Masukan */}
              <div className="md:col-span-7 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900 flex items-center">
                    <BarChart3 className="h-4 w-4 mr-1.5 text-indigo-600" />
                    Tingkat Keterisian Kuota Partisipasi Publik
                  </span>
                  <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                    {Math.min(100, Math.round((totalCount / 100) * 100))}% Terisi
                  </span>
                </div>
                
                {/* Visual Multi-Segment Progress Bar */}
                <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 flex">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-600 rounded-full transition-all duration-700 relative shadow-inner"
                    style={{ width: `${Math.min(100, Math.max(4, totalCount))}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                  <span>0 Aspirasi</span>
                  <span>50 Target Paruh</span>
                  <span>100 Kuota Batas</span>
                </div>
              </div>

              {/* Status Validitas & Keamanan Data */}
              <div className="md:col-span-5 bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center space-x-3.5">
                <div className="p-2.5 bg-white text-emerald-600 rounded-xl border border-slate-200 shadow-3xs flex-shrink-0">
                  <PieChart className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Uji Publik Akuntabel</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Setiap kritik diverifikasi dan diarsipkan ke lembar Google Sheet resmi untuk rekapitulasi naskah akademik.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-3xs">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
            <span className="text-xs font-bold text-slate-600">Mengunduh draf peraturan dan status kuota langsung dari Google Sheets...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: ACTIVE DRAFTS & ENACTED LAWS TABLES (7 of 12) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* TABLE 1: ACTIVE DRAFTS UNDER CONSULTATION */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-900 text-white">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-indigo-400" />
                    <h3 className="font-extrabold text-xs sm:text-sm">
                      1. Pilih Topik Draf Peraturan (Uji Publik Aktif)
                    </h3>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                    Daftar di bawah ini dibaca langsung dari Google Sheet. Klik salah satu draf untuk membukanya, membaca berkas Google Drive-nya, dan mengirimkan masukan kritik.
                  </p>
                </div>

                {/* Table with horizontal scroll support */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
                        <th className="py-3 px-4">No / Kode</th>
                        <th className="py-3 px-4">Judul Rancangan Regulasi</th>
                        <th className="py-3 px-4">Bidang</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeDrafts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 px-4 text-center text-slate-400">
                            <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-600 text-xs">Belum ada draf yang dipublikasikan</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Draf peraturan yang telah disetujui 'Publik' oleh Admin akan otomatis muncul di sini.</p>
                          </td>
                        </tr>
                      ) : (
                        activeDrafts.map((draft) => {
                        const isSelected = selectedDraft?.id === draft.id;
                        return (
                          <tr 
                            key={draft.id}
                            onClick={() => selectDraft(draft)}
                            className={`cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' 
                                : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                              {draft.no}
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-extrabold text-slate-950 block text-xs sm:text-sm">
                                {draft.title}
                              </span>
                              <span className="text-[11px] text-slate-500 block mt-1 leading-relaxed line-clamp-2 md:line-clamp-none">
                                {draft.desc}
                              </span>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                {draft.category}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center space-x-1 font-bold text-[9px] px-2.5 py-1 rounded-full ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white shadow-3xs' 
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              }`}>
                                <span className={`h-1.2 w-1.2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`} />
                                <span>{isSelected ? "Terpilih" : "Pilih draf"}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE 2: ENACTED REGULATIONS */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-100 text-slate-800">
                  <div className="flex items-center space-x-2">
                    <History className="h-5 w-5 text-slate-600" />
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      2. Regulasi & UU Referensi (Sudah Berlaku)
                    </h3>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-1 leading-relaxed">
                    Daftar undang-undang pembanding sah di Indonesia untuk membantu Anda menyusun naskah perbandingan hukum yang berlandaskan konstitusi.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
                        <th className="py-3 px-4">No Regulasi</th>
                        <th className="py-3 px-4">Judul Peraturan</th>
                        <th className="py-3 px-4">Tahun Sah</th>
                        <th className="py-3 px-4 text-center">Naskah PDF</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {enactedRegulations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-4 text-center text-slate-400">
                            <History className="h-7 w-7 mx-auto text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-600 text-xs">Belum ada daftar undang-undang referensi di Sheet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Tambahkan baris pada tab sheet 'Peraturan Berlaku' untuk menampilkan undang-undang acuan di sini.</p>
                          </td>
                        </tr>
                      ) : (
                        enactedRegulations.map((law) => (
                        <tr key={law.id} className="hover:bg-slate-50/50">
                          <td className="py-4 px-4 font-bold text-slate-800 whitespace-nowrap">
                            {law.no}
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-bold text-slate-900 block text-xs">
                              {law.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5 leading-normal">
                              {law.desc}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-700 whitespace-nowrap">
                            {law.year}
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {law.drivePdfUrl ? (
                              <a
                                href={law.drivePdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-bold text-[10px] border border-indigo-200 transition-all shadow-3xs"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Buka PDF</span>
                              </a>
                            ) : (
                              <span className="text-slate-300 text-[10px] italic">Tanpa berkas</span>
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                              {law.status}
                            </span>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: THE INPUT FORM & CHOSEN DRIVE LINK (5 of 12) */}
            <div id="aspirasi-form" className="lg:col-span-5 lg:sticky lg:top-8 space-y-4">
              
              {/* DISPLAY DRAFT COMPANION FILE FROM THE SELECTED ROW */}
              {selectedDraft && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-3xs space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-700">
                    <BookOpen className="h-4.5 w-4.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Berkas Draf Terpilih</span>
                  </div>
                  
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 leading-snug">
                      {selectedDraft.no}
                    </h4>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 leading-normal">
                      {selectedDraft.title}
                    </p>
                  </div>

                  {/* Drive file trigger button dynamically updated from Google Sheet row */}
                  {selectedDraft.drivePdfUrl ? (
                    <a 
                      href={selectedDraft.drivePdfUrl}
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-3xs transition-all"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Buka File Draf di Google Drive</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 text-slate-400 text-[10px] text-center rounded-lg italic">
                      Berkas draf PDF di Google Drive tidak ditautkan di baris baris Google Sheet untuk draf ini.
                    </div>
                  )}
                </div>
              )}

              {totalCount >= 100 ? (
                /* QUOTA LOCKED SCREEN */
                <div className="bg-slate-950 text-white rounded-2xl p-6 text-center border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-32 w-32 bg-rose-500/10 rounded-full -mr-10 -mt-10 -z-10" />
                  
                  <div className="mx-auto bg-rose-500/20 text-rose-400 p-3 rounded-xl border border-rose-500/30 w-12 h-12 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6" />
                  </div>

                  <h3 className="text-base sm:text-lg font-bold mb-1">Formulir Uji Publik Ditutup</h3>
                  <p className="text-indigo-200 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-4">KUOTA TERPENUHI: 100 / 100 PENGKRITIK</p>
                  
                  <p className="text-slate-300 text-xs leading-relaxed max-w-sm mx-auto mb-4">
                    Batas kuota pendaftaran uji publik ini telah mencapai batas maksimal 100 naskah kritik dari masyarakat.
                  </p>
                  
                  <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed max-w-md mx-auto bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    Seluruh 100 masukan yang masuk tersimpan aman di Google Sheets dan sedang disinkronisasikan oleh Tim Perumus Regulasi. Terima kasih atas kontribusi demokrasi Anda!
                  </p>
                </div>
              ) : (
                /* ACTIVE FORM CARD */
                <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-3xs">
                  
                  {/* Form header */}
                  <div className="border-b border-slate-100 pb-3 mb-4">
                    <h3 className="text-slate-900 font-extrabold text-xs sm:text-sm md:text-base flex items-center space-x-2">
                      <UserCheck className="h-4.5 sm:h-5 w-4.5 sm:w-5 text-indigo-600 flex-shrink-0" />
                      <span>3. Kirim Kritik & Rekomendasi</span>
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                      Kirimkan aspirasi kritis Anda secara langsung ke baris lembar kerja Google Sheets.
                    </p>
                  </div>

                  {/* Quota Progress Tracker mini */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600">Sisa Kuota Uji Publik:</span>
                    <span className={`${totalCount >= 85 ? 'text-rose-600' : 'text-indigo-600'} flex items-center space-x-1`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping inline-block" />
                      <span>{100 - totalCount} dari 100 Slot</span>
                    </span>
                  </div>

                  {/* Display active form error alert */}
                  {formError && (
                    <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[10px] sm:text-xs font-semibold flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    
                    {/* Selected Draft Display (Locks automatically from Google Sheet row click) */}
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-bold text-indigo-700 tracking-wide uppercase mb-1">
                        Draf Target Kritik (Pilih Dari Tabel Kiri)
                      </label>
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-extrabold text-slate-900 flex items-center justify-between shadow-3xs">
                        <span className="truncate max-w-[240px]">
                          {formData.pasal || "Pilih salah satu draf di kiri"}
                        </span>
                        <BookmarkCheck className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                      </div>
                      <input type="hidden" name="pasal" value={formData.pasal} />
                    </div>

                    {/* Identity Segment */}
                    <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                      <div className="flex items-center justify-between border-b border-slate-200/40 pb-1.5">
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-900 uppercase tracking-wider">Identitas Pengirim</span>
                        <label className="inline-flex items-center space-x-1.5 cursor-pointer bg-white hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition-all text-[9px] sm:text-[10px] font-bold text-slate-700 shadow-3xs">
                          <input 
                            type="checkbox"
                            name="isAnonymous"
                            checked={formData.isAnonymous}
                            onChange={handleCheckboxChange}
                            className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded-xs cursor-pointer"
                          />
                          <span>Kirim Anonim</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Nama Lengkap</label>
                          <input 
                            type="text"
                            name="nama"
                            disabled={formData.isAnonymous}
                            value={formData.nama}
                            onChange={handleInputChange}
                            placeholder={formData.isAnonymous ? "Identitas dirahasiakan" : "Prof. Dr. Irwan Siregar"}
                            className="w-full text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Instansi / Lembaga</label>
                          <input 
                            type="text"
                            name="instansi"
                            disabled={formData.isAnonymous}
                            value={formData.instansi}
                            onChange={handleInputChange}
                            placeholder={formData.isAnonymous ? "Identitas dirahasiakan" : "Universitas Indonesia"}
                            className="w-full text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Kategori Peran</label>
                          <select
                            name="profesi"
                            value={formData.profesi}
                            onChange={handleInputChange}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="Masyarakat Umum">Masyarakat Umum</option>
                            <option value="Tokoh Masyarakat / Adat">Tokoh Masyarakat / Agama / Adat</option>
                            <option value="Praktisi Hukum / Advokat">Praktisi Hukum / Advokat</option>
                            <option value="Akademisi / Peneliti">Akademisi / Peneliti / Dosen</option>
                            <option value="Pelaku Usaha / UMKM">Pelaku Usaha / UMKM</option>
                            <option value="LSM / Aktivis">LSM / Aktivis</option>
                            <option value="Mahasiswa / Pelajar">Mahasiswa / Pelajar</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Bidang Keahlian</label>
                          <input 
                            type="text"
                            name="keahlian"
                            value={formData.keahlian}
                            onChange={handleInputChange}
                            placeholder="Hukum, Ritel, dll"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Kontak Verifikasi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(Rahasia)</span></label>
                          <input 
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="nama@email.com"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">No. WhatsApp <span className="text-slate-400 font-normal">(Rahasia)</span></label>
                          <input 
                            type="text"
                            name="noHp"
                            value={formData.noHp}
                            onChange={handleInputChange}
                            placeholder="08xxxxxxxxxx"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pokok Kritik & Saran */}
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Uraian Kritik & Dampak Negatif <span className="text-rose-500">*</span></label>
                        <textarea 
                          name="kritik"
                          rows={3}
                          value={formData.kritik}
                          onChange={handleInputChange}
                          placeholder="Uraikan kelemahan, potensi ketimpangan hukum, atau kerugian publik..."
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold text-slate-700 mb-1">Rekomendasi / Solusi Alternatif <span className="text-rose-500">*</span></label>
                        <textarea 
                          name="rekomendasi"
                          rows={3}
                          value={formData.rekomendasi}
                          onChange={handleInputChange}
                          placeholder="Tuliskan saran konkret mengenai pasal baru, pengecualian, atau masa transisi..."
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Integritas Checkbox */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <label className="flex items-start space-x-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          name="agreed"
                          checked={formData.agreed}
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded-xs mt-0.5 flex-shrink-0"
                        />
                        <span className="text-[9px] sm:text-[10px] text-slate-600 leading-relaxed font-medium">
                          Saya menyatakan masukan ini diajukan secara jujur demi kepentingan umum dan didasari objektivitas. <span className="text-rose-500 font-bold">*</span>
                        </span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 px-4 bg-slate-900 text-white font-bold text-xs rounded-lg sm:rounded-xl tracking-wider uppercase hover:bg-slate-800 active:bg-slate-950 transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer disabled:bg-slate-400"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Mengirim ke Google Sheets...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 text-emerald-400" />
                          <span>Submit Kritik & Solusi</span>
                        </>
                      )}
                    </button>

                  </form>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-[10px] sm:text-xs">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="text-slate-300">&copy; {new Date().getFullYear()} Aplikasi Uji Publik Draft Peraturan.</p>
          <p className="text-slate-500">Sistem Pengumpulan Aspirasi Berbasis Sinkronisasi Google Sheets.</p>
        </div>
      </footer>
    </div>
  );
}
