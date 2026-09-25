# Panduan Dashboard Admin Google Apps Script Terpadu

Gunakan kode di bawah ini untuk membuat **Dashboard Admin Independen** langsung di Google Apps Script Anda. Dashboard ini memungkinkan Admin untuk mengunggah berkas draf peraturan (.pdf/.docx) ke Google Drive, merekamnya ke baris tabel draf aktif di Google Sheet secara otomatis, serta meninjau seluruh masukan kritik masyarakat dari satu pusat kendali yang aman.

---

## Langkah Instalasi (2 Menit)

1. Buka Google Sheet Anda.
2. Pilih menu **Extensions** ➔ **Apps Script**.
3. Di dalam editor Apps Script, buat dua file berikut:
   - File **Skrip (`Code.gs`)**: Tempelkan kode skrip di bawah.
   - File **HTML (`index.html`)**: Klik ikon `+` di sebelah tulisan Files ➔ pilih **HTML** ➔ beri nama `index` ➔ tempelkan kode HTML di bawah.
4. Jangan lupa untuk mengganti **`FOLDER_DRIVE_ID`** pada file `Code.gs` dengan ID folder Google Drive Anda (ID ini didapat dari URL folder Drive Anda).
5. Klik **Terapkan (Deploy)** ➔ **Penerapan Baru (New Deployment)**.
6. Pilih jenis **Aplikasi Web (Web App)**.
7. Set **Jalankan sebagai (Execute as)** ke **Saya (Me / Email Anda)**, dan **Siapa yang memiliki akses (Who has access)** ke **Siapa Saja (Anyone)**.
8. Klik Deploy, setujui otorisasi izin akses akun Google Anda, dan salin URL Web App yang dihasilkan.

---

### 1. File Skrip: `Code.gs`

```javascript
/**
 * GOOGLE APPS SCRIPT - CODE.GS
 * Pusat Kendali Webhook GET/POST & API Dashboard Admin
 */

// GANTI DENGAN ID FOLDER GOOGLE DRIVE ANDA UNTUK MENAMPUNG FILE UPLOAD
var FOLDER_DRIVE_ID = "MASUKKAN_ID_FOLDER_DRIVE_DI_SINI"; 

function doGet(e) {
  // Jika ada parameter untuk mengambil data json draf (untuk user publik)
  if (e && e.parameter && e.parameter.api === "true") {
    return getRegulationsJson();
  }
  
  // Secara default, tampilkan Dashboard Admin berbasis HTML
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle("Dashboard Admin - Portal Uji Publik")
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tulis ke Tab "Masukan Kritik"
    var sheet = ss.getSheetByName("Masukan Kritik");
    if (!sheet) {
      sheet = ss.insertSheet("Masukan Kritik");
    }
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "ID", "Timestamp", "Nama Pengirim", "Anonim?", "Profesi / Peran", 
        "Instansi / Organisasi", "Email", "No. WhatsApp", "Keahlian", 
        "Topik/Draf Peraturan", "Isi Kritik", "Solusi Alternatif"
      ]);
      sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#0F172A").setFontColor("#FFFFFF");
    }
    
    sheet.appendRow([
      data.id || "",
      data.timestamp || new Date().toISOString(),
      data.nama || "Masyarakat Anonim",
      data.isAnonymous || "Tidak",
      data.profesi || "",
      data.instansi || "",
      data.email || "",
      data.noHp || "",
      data.keahlian || "",
      data.pasal || "",
      data.kritik || "",
      data.rekomendasi || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Mengambil Data JSON draf aktif & referensi (Dipanggil oleh React & Dashboard Admin)
function getRegulationsJson() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Baca Tab "Draf Aktif"
    var draftSheet = ss.getSheetByName("Draf Aktif");
    var drafts = [];
    if (draftSheet) {
      var data = draftSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][1]) {
          drafts.push({
            id: data[i][0] || ("draft_" + i),
            no: data[i][1] || "",
            title: data[i][2] || "",
            desc: data[i][3] || "",
            category: data[i][4] || "",
            drivePdfUrl: data[i][5] || "",
            status: "Uji Publik Aktif"
          });
        }
      }
    }
    
    // Baca Tab "Peraturan Berlaku"
    var enactedSheet = ss.getSheetByName("Peraturan Berlaku");
    var enacted = [];
    if (enactedSheet) {
      var data2 = enactedSheet.getDataRange().getValues();
      for (var j = 1; j < data2.length; j++) {
        if (data2[j][1]) {
          enacted.push({
            id: data2[j][0] || ("law_" + j),
            no: data2[j][1] || "",
            title: data2[j][2] || "",
            year: data2[j][3].toString() || "",
            desc: data2[j][4] || "",
            status: data2[j][5] || "Sudah Berlaku"
          });
        }
      }
    }
    
    var result = {
      activeDrafts: drafts,
      enactedRegulations: enacted
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// API FUNGSI ADMIN: Mengunggah berkas draf dan menulis ke tab "Draf Aktif"
function uploadDraftAndSave(formObject) {
  try {
    var folder;
    if (FOLDER_DRIVE_ID && FOLDER_DRIVE_ID !== "MASUKKAN_ID_FOLDER_DRIVE_DI_SINI") {
      folder = DriveApp.getFolderById(FOLDER_DRIVE_ID);
    } else {
      folder = DriveApp.getRootFolder();
    }
    
    var fileUrl = "";
    
    // Jika ada file yang dikirim dari form admin
    if (formObject.fileData && formObject.fileName) {
      var contentType = formObject.fileData.substring(5, formObject.fileData.indexOf(';'));
      var bytes = Utilities.base64Decode(formObject.fileData.substring(formObject.fileData.indexOf(',') + 1));
      var blob = Utilities.newBlob(bytes, contentType, formObject.fileName);
      
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Draf Aktif");
    if (!sheet) {
      sheet = ss.insertSheet("Draf Aktif");
    }
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "No / Kode", "Judul Rancangan Regulasi", "Deskripsi Ringkas", "Bidang / Kategori", "Tautan Drive File"]);
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#1E293B").setFontColor("#FFFFFF");
    }
    
    var newId = "draft_" + Date.now();
    sheet.appendRow([
      newId,
      formObject.no || "",
      formObject.title || "",
      formObject.desc || "",
      formObject.category || "Umum",
      fileUrl
    ]);
    
    return { status: "success", message: "Berkas berhasil diupload dan draf peraturan tersimpan!" };
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}

// API FUNGSI ADMIN: Membaca daftar Masukan Kritik untuk Dashboard Admin
function getAdminMasukanKritik() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Masukan Kritik");
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      list.push({
        id: data[i][0] || "",
        timestamp: data[i][1] || "",
        nama: data[i][2] || "",
        isAnonymous: data[i][3] || "Tidak",
        profesi: data[i][4] || "",
        instansi: data[i][5] || "",
        email: data[i][6] || "",
        noHp: data[i][7] || "",
        keahlian: data[i][8] || "",
        pasal: data[i][9] || "",
        kritik: data[i][10] || "",
        rekomendasi: data[i][11] || ""
      });
    }
    return list;
  } catch (e) {
    return [];
  }
}

// API FUNGSI ADMIN: Membaca daftar Draf Aktif untuk Dashboard Admin
function getAdminDrafList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Draf Aktif");
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      list.push({
        id: data[i][0] || "",
        no: data[i][1] || "",
        title: data[i][2] || "",
        desc: data[i][3] || "",
        category: data[i][4] || "",
        drivePdfUrl: data[i][5] || ""
      });
    }
    return list;
  } catch (e) {
    return [];
  }
}
```

---

### 2. File HTML: `index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; background-color: #F8FAFC; }
    .bg-gradient-header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); }
  </style>
</head>
<body class="text-gray-800">

  <!-- Header Panel -->
  <div class="bg-gradient-header text-white shadow-md">
    <div class="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center space-x-3">
        <div class="bg-indigo-600 p-2.5 rounded-xl shadow-inner text-white">
          <i class="fas fa-gavel text-xl"></i>
        </div>
        <div>
          <h1 class="text-lg sm:text-xl font-bold tracking-tight">Sistem Dashboard Administrator</h1>
          <p class="text-xs text-indigo-300">Pusat Pengunggahan Draf Regulasi & Penelaahan Kritik Warga</p>
        </div>
      </div>
      <div class="flex items-center space-x-2 text-xs">
        <span class="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-emerald-500/20">
          <i class="fas fa-circle animate-pulse mr-1"></i> Drive & Sheet Terkoneksi
        </span>
      </div>
    </div>
  </div>

  <!-- Main Body Content -->
  <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">

    <!-- Tab Navigators -->
    <div class="flex space-x-2 border-b border-gray-200">
      <button onclick="switchTab('upload-tab')" id="btn-upload-tab" class="tab-btn py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 border-indigo-600 text-indigo-600">
        <i class="fas fa-upload mr-1.5"></i> Upload Draf Baru
      </button>
      <button onclick="switchTab('kritik-tab')" id="btn-kritik-tab" class="tab-btn py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-500 border-b-2 border-transparent hover:text-gray-700">
        <i class="fas fa-comments mr-1.5"></i> Kritik Warga Masuk
      </button>
      <button onclick="switchTab('draf-tab')" id="btn-draf-tab" class="tab-btn py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-500 border-b-2 border-transparent hover:text-gray-700">
        <i class="fas fa-file-alt mr-1.5"></i> Daftar Draf Aktif
      </button>
    </div>

    <!-- Alert Message Widget -->
    <div id="alert-box" class="hidden p-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2">
      <i id="alert-icon" class="fas"></i>
      <span id="alert-text"></span>
    </div>

    <!-- TAB 1: FORM UPLOAD DRAF BARU -->
    <div id="upload-tab" class="tab-content bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
      <div class="border-b border-gray-100 pb-3">
        <h3 class="font-bold text-gray-950 text-base">Tambah Topik & Upload File Draf</h3>
        <p class="text-xs text-gray-500 mt-1">Gunakan formulir ini untuk mengunggah draf PDF ke Google Drive dan menambah baris ke Google Sheet.</p>
      </div>

      <form id="uploadForm" onsubmit="submitForm(event)" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">No / Kode Regulasi</label>
            <input type="text" id="no" required placeholder="Contoh: RUU LHK No. 12/2026" class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Kategori / Sektor Bidang</label>
            <input type="text" id="category" required placeholder="Contoh: Lingkungan Hidup, Transportasi, Ekonomi" class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Judul Rancangan Regulasi</label>
          <input type="text" id="title" required placeholder="Contoh: Rancangan Undang-Undang Pengendalian Sampah Plastik" class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Deskripsi Ringkas</label>
          <textarea id="desc" required rows="3" placeholder="Uraikan isi dan pokok pengaturan draf regulasi..." class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"></textarea>
        </div>

        <!-- File Upload Area -->
        <div class="bg-indigo-50/50 p-4 rounded-xl border border-dashed border-indigo-200">
          <label class="block text-xs font-bold text-gray-700 mb-1">Pilih Berkas Draf Peraturan (.PDF / .DOCX)</label>
          <input type="file" id="fileInput" accept=".pdf,.doc,.docx" required class="text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer mt-1">
        </div>

        <button type="submit" id="submitBtn" class="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center space-x-2">
          <i class="fas fa-cloud-upload-alt"></i> <span>Unggah Berkas & Tambah Draf</span>
        </button>
      </form>
    </div>

    <!-- TAB 2: MASUKAN KRITIK WARGA -->
    <div id="kritik-tab" class="tab-content hidden bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <div class="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 class="font-bold text-gray-950 text-base">Aspirasi Kritik & Saran Warga</h3>
          <p class="text-xs text-gray-500 mt-0.5">Daftar naskah keberatan dan solusi alternatif yang masuk dari masyarakat umum, akademisi, dan praktisi.</p>
        </div>
        <button onclick="loadMasukanKritik()" class="p-2 text-xs font-bold border border-gray-200 bg-slate-50 rounded-lg hover:bg-gray-100">
          <i class="fas fa-sync-alt"></i> Segarkan Data
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-gray-100 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <th class="py-3 px-4">Nama Pengirim</th>
              <th class="py-3 px-4">Profesi / Keahlian</th>
              <th class="py-3 px-4">Topik Draf Target</th>
              <th class="py-3 px-4">Pokok Kritik & Solusi Perbaikan</th>
              <th class="py-3 px-4">Kontak Verifikasi</th>
            </tr>
          </thead>
          <tbody id="kritikTableBody" class="divide-y divide-gray-100">
            <tr>
              <td colspan="5" class="py-8 text-center text-gray-400">Sedang memuat masukan warga...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: DAFTAR DRAF AKTIF -->
    <div id="draf-tab" class="tab-content hidden bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <div class="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 class="font-bold text-gray-950 text-base">Daftar Draf Aktif Terunggah</h3>
          <p class="text-xs text-gray-500 mt-0.5">Daftar topik rancangan peraturan yang saat ini aktif terbuka untuk dikritisi masyarakat.</p>
        </div>
        <button onclick="loadActiveDrafts()" class="p-2 text-xs font-bold border border-gray-200 bg-slate-50 rounded-lg hover:bg-gray-100">
          <i class="fas fa-sync-alt"></i> Segarkan Daftar
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-gray-100 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <th class="py-3 px-4">No / Kode</th>
              <th class="py-3 px-4">Judul Rancangan Regulasi</th>
              <th class="py-3 px-4">Bidang</th>
              <th class="py-3 px-4">Berkas Drive Terkait</th>
            </tr>
          </thead>
          <tbody id="drafTableBody" class="divide-y divide-gray-100">
            <tr>
              <td colspan="4" class="py-8 text-center text-gray-400">Sedang memuat daftar draf aktif...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('border-indigo-600', 'text-indigo-600');
        el.classList.add('text-gray-500', 'border-transparent');
      });
      
      document.getElementById(tabId).classList.remove('hidden');
      document.getElementById('btn-' + tabId).classList.add('border-indigo-600', 'text-indigo-600');
      document.getElementById('btn-' + tabId).classList.remove('text-gray-500', 'border-transparent');

      if (tabId === 'kritik-tab') loadMasukanKritik();
      if (tabId === 'draf-tab') loadActiveDrafts();
    }

    function showAlert(text, isSuccess) {
      const box = document.getElementById('alert-box');
      const icon = document.getElementById('alert-icon');
      const txt = document.getElementById('alert-text');
      
      box.classList.remove('hidden', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-800', 'bg-rose-50', 'border-rose-200', 'text-rose-800');
      
      if (isSuccess) {
        box.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-800', 'border');
        icon.className = "fas fa-check-circle text-emerald-500 text-base flex-shrink-0";
      } else {
        box.classList.add('bg-rose-50', 'border-rose-200', 'text-rose-800', 'border');
        icon.className = "fas fa-exclamation-triangle text-rose-500 text-base flex-shrink-0";
      }
      
      txt.innerText = text;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function submitForm(event) {
      event.preventDefault();
      
      const fileInput = document.getElementById('fileInput');
      const submitBtn = document.getElementById('submitBtn');
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> <span>Sedang Mengunggah & Menyimpan...</span>';

      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const formObject = {
            no: document.getElementById('no').value,
            category: document.getElementById('category').value,
            title: document.getElementById('title').value,
            desc: document.getElementById('desc').value,
            fileName: file.name,
            fileData: e.target.result
          };
          
          google.script.run
            .withSuccessHandler(function(response) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span>Unggah Berkas & Tambah Draf</span>';
              
              if (response.status === "success") {
                showAlert(response.message, true);
                document.getElementById('uploadForm').reset();
              } else {
                showAlert(response.message, false);
              }
            })
            .withFailureHandler(function(error) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span>Unggah Berkas & Tambah Draf</span>';
              showAlert(error.toString(), false);
            })
            .uploadDraftAndSave(formObject);
        };
        reader.readAsDataURL(file);
      }
    }

    function loadMasukanKritik() {
      const body = document.getElementById('kritikTableBody');
      body.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400"><i class="fas fa-spinner animate-spin text-lg"></i> Membaca data masukan kritik...</td></tr>';
      
      google.script.run
        .withSuccessHandler(function(list) {
          if (list.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400">Belum ada kritik masyarakat yang masuk.</td></tr>';
            return;
          }
          
          let html = '';
          list.forEach(item => {
            html += `
              <tr class="hover:bg-gray-50">
                <td class="py-3.5 px-4">
                  <span class="font-bold text-gray-900 block">${item.nama}</span>
                  <span class="text-[10px] text-gray-400">${item.instansi || "Umum"}</span>
                </td>
                <td class="py-3.5 px-4">
                  <span class="font-semibold text-gray-800 block">${item.profesi}</span>
                  <span class="text-[10px] text-gray-400">Keahlian: ${item.keahlian || "Umum"}</span>
                </td>
                <td class="py-3.5 px-4 font-semibold text-indigo-700 leading-normal">${item.pasal}</td>
                <td class="py-3.5 px-4 space-y-2 max-w-sm">
                  <div class="p-2 bg-gray-50 border border-gray-100 rounded-md">
                    <span class="text-[9px] font-bold text-gray-400 uppercase block">Kritik:</span>
                    <p class="text-xs text-gray-700 leading-relaxed italic">"${item.kritik}"</p>
                  </div>
                  <div class="p-2 bg-emerald-50 border border-emerald-100 rounded-md">
                    <span class="text-[9px] font-bold text-emerald-600 uppercase block">Rekomendasi:</span>
                    <p class="text-xs text-gray-800 leading-relaxed">${item.rekomendasi}</p>
                  </div>
                </td>
                <td class="py-3.5 px-4 font-mono text-[11px] space-y-0.5">
                  <div class="flex items-center text-gray-600"><i class="fas fa-envelope mr-1 text-[10px]"></i> ${item.email || "-"}</div>
                  <div class="flex items-center text-gray-600"><i class="fab fa-whatsapp mr-1 text-[10px]"></i> ${item.noHp || "-"}</div>
                </td>
              </tr>
            `;
          });
          body.innerHTML = html;
        })
        .withFailureHandler(function(err) {
          body.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-500">Gagal memuat data: ${err.toString()}</td></tr>`;
        })
        .getAdminMasukanKritik();
    }

    function loadActiveDrafts() {
      const body = document.getElementById('drafTableBody');
      body.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-gray-400"><i class="fas fa-spinner animate-spin text-lg"></i> Membaca draf peraturan...</td></tr>';
      
      google.script.run
        .withSuccessHandler(function(list) {
          if (list.length === 0) {
            body.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-gray-400">Belum ada draf yang terunggah. Silakan gunakan tab pertama.</td></tr>';
            return;
          }
          
          let html = '';
          list.forEach(item => {
            html += `
              <tr class="hover:bg-gray-50">
                <td class="py-4 px-4 font-bold text-gray-900">${item.no}</td>
                <td class="py-4 px-4">
                  <span class="font-extrabold text-gray-950 block">${item.title}</span>
                  <span class="text-[11px] text-gray-500 block leading-relaxed max-w-md mt-1">${item.desc}</span>
                </td>
                <td class="py-4 px-4"><span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">${item.category}</span></td>
                <td class="py-4 px-4">
                  ${item.drivePdfUrl 
                    ? `<a href="${item.drivePdfUrl}" target="_blank" class="inline-flex items-center space-x-1.5 py-1 px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-bold text-xs"><i class="fab fa-google-drive"></i> <span>Buka File</span></a>`
                    : '<span class="text-gray-400 text-xs italic">Tanpa berkas</span>'
                  }
                </td>
              </tr>
            `;
          });
          body.innerHTML = html;
        })
        .withFailureHandler(function(err) {
          body.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-rose-500">Gagal memuat draf: ${err.toString()}</td></tr>`;
        })
        .getAdminDrafList();
    }
  </script>
</body>
</html>
```
