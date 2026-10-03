// ===== Kost Manager - 46 kamar (LT1: 8, LT2-4: 13) =====
const LANTAI = [
  { nama: "Lantai 1 (LT1)", mulai: 101, jumlah: 8 },
  { nama: "Lantai 2 (LT2)", mulai: 201, jumlah: 13 },
  { nama: "Lantai 3 (LT3)", mulai: 301, jumlah: 13 },
  { nama: "Lantai 4 (LT4)", mulai: 401, jumlah: 13 },
];
const ALL_KAMAR = LANTAI.flatMap(l => Array.from({ length: l.jumlah }, (_, i) => l.mulai + i));
const KEY = "kostData_v1";
const HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const now = new Date();
let bulanTagihan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const labelBulan = ym => { const [y, m] = ym.split("-"); return `${BULAN[+m - 1]} ${y}`; };

function dataAwal() {
  const rooms = {};
  ALL_KAMAR.forEach(no => rooms[no] = { status: "kosong", nama: "", wa: "", harga: 0, masuk: "", tempo: "", catatan: "", bayar: [] });
  rooms[105] = { status: "gudang", nama: "", wa: "", harga: 0, masuk: "", tempo: "", catatan: "", bayar: [] };
  return { pin: "0021", rooms, mutasi: [], pengeluaran: [] };
}
let D = muat();
function muat() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return dataAwal();
    const d = JSON.parse(raw);
    const base = dataAwal();
    ALL_KAMAR.forEach(no => { d.rooms[no] = Object.assign(base.rooms[no], d.rooms[no] || {}); });
    d.pin = d.pin || "0021";
    d.mutasi = Array.isArray(d.mutasi) ? d.mutasi : [];
    d.pengeluaran = Array.isArray(d.pengeluaran) ? d.pengeluaran : [];
    return d;
  } catch { return dataAwal(); }
}
const API_KOST = "https://solene-copy-808ddc96.base44.app/functions/kostApi";
async function apiKost(action, payload) {
  const r = await fetch(API_KOST, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
  return r.json();
}
let dirty = false, syncBusy = false, syncTimer = null, pinGantiLama = null;
function setDot(cls, spin) {
  const d = document.getElementById("sync-dot");
  if (!d) return;
  d.className = "sync-dot " + (cls || "");
  if (spin) d.classList.add("spin");
  const info = document.getElementById("sync-info");
  if (info) info.textContent = dirty ? "Ada perubahan belum tersinkron." : ("Tersinkron " + new Date().toLocaleTimeString("id-ID"));
}
async function sinkronNow(manual) {
  if (syncBusy) return;
  if (!dirty) { if (manual) toast("✓ Data sudah tersinkron"); return; }
  syncBusy = true; setDot("", true);
  try {
    const r = await apiKost("save", { pin: D.pin, pinLama: pinGantiLama || undefined, data: JSON.stringify(D) });
    if (r.success) { dirty = false; pinGantiLama = null; setDot("ok"); if (manual) toast("✓ Tersinkron ke server"); }
    else { setDot("warn"); if (manual) toast("⚠ " + (r.message || "Gagal sinkron") + " — coba lagi"); }
  } catch { setDot("warn"); if (manual) toast("⚠ Koneksi server gagal — perubahan tetap aman di HP ini"); }
  syncBusy = false;
}
async function muatUlang() {
  if (!confirm("Ambil data terbaru dari server? Perubahan yang belum tersinkron di perangkat ini akan tertimpa.")) return;
  try {
    const r = await apiKost("login", { pin: D.pin });
    if (r.success && r.data) { terapkanData(r.data); localStorage.setItem(KEY, JSON.stringify(D)); render(); dirty = false; setDot("ok"); toast("✓ Data dimuat dari server"); }
    else toast("⚠ " + (r.message || "Tidak ada data di server"));
  } catch { toast("⚠ Koneksi server gagal"); }
}
function simpan() {
  localStorage.setItem(KEY, JSON.stringify(D));
  dirty = true; setDot("warn");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sinkronNow(false), 3000);
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add("hidden"), 2200);
}
const rupiah = n => "Rp" + (Number(n) || 0).toLocaleString("id-ID");
const stLabel = { kosong: "Kosong", terisi: "Terisi", booking: "Booking", perbaikan: "Perbaikan", gudang: "Gudang" };
const lunasBulan = (no, ym) => (D.rooms[no].bayar || []).includes(ym);

const todayISO = () => new Date().toISOString().slice(0, 10);
function catatMasuk(no, nama, harga) {
  D.mutasi.push({ kamar: no, nama, harga: harga || 0, masuk: D.rooms[no].masuk || todayISO(), keluar: "" });
}
function catatKeluar(no, nama) {
  const m = D.mutasi.find(x => x.kamar === no && x.nama === nama && !x.keluar);
  if (m) m.keluar = todayISO();
  else D.mutasi.push({ kamar: no, nama, harga: 0, masuk: "", keluar: todayISO() });
}

// ===== LOGIN =====
function terapkanData(d) {
  const base = dataAwal();
  d.rooms = d.rooms || {};
  ALL_KAMAR.forEach(no => { base.rooms[no] = Object.assign(base.rooms[no], d.rooms[no] || {}); });
  d.mutasi = Array.isArray(d.mutasi) ? d.mutasi : [];
  d.pengeluaran = Array.isArray(d.pengeluaran) ? d.pengeluaran : [];
  d.pin = d.pin || base.pin;
  D = d;
}
async function login() {
  const v = document.getElementById("pin-input").value.trim();
  const err = document.getElementById("pin-err");
  if (!v) { err.textContent = "Isi PIN dulu"; return; }
  err.textContent = "⏳ Memeriksa...";
  try {
    const r = await apiKost("login", { pin: v });
    if (r.baru) {
      // pertama kali online: pakai data lokal lalu unggah
      if (v === D.pin) {
        dirty = true; sinkronNow(false);
        masukApp();
      } else err.textContent = "❌ PIN salah";
    } else if (r.success && r.data) {
      terapkanData(r.data);
      simpan(); // localStorage mirror
      masukApp();
    } else err.textContent = "❌ " + (r.message || "PIN salah");
  } catch {
    // server tak terjangkau: mode offline dengan data lokal
    if (v === D.pin) { masukApp(); toast("⚠ Mode offline: perubahan hanya tersimpan di perangkat ini"); }
    else err.textContent = "❌ PIN salah (server tak terjangkau)";
  }
}
function masukApp() {
  document.getElementById("pin-gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  render();
}
function logout() { document.getElementById("app").classList.add("hidden"); document.getElementById("pin-gate").classList.remove("hidden"); document.getElementById("pin-input").value = ""; }

// ===== TABS =====
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  document.querySelectorAll(".tab-page").forEach(p => p.classList.add("hidden"));
  document.getElementById("tab-" + b.dataset.tab).classList.remove("hidden");
  render();
}));

function render() {
  const rooms = D.rooms;
  let isi = 0, kosong = 0, booking = 0, perbaikan = 0, gudang = 0, omzet = 0;
  ALL_KAMAR.forEach(no => {
    const r = rooms[no];
    if (r.status === "terisi") { isi++; omzet += +r.harga || 0; }
    else if (r.status === "kosong") kosong++;
    else if (r.status === "booking") booking++;
    else if (r.status === "gudang") gudang++;
    else perbaikan++;
  });
  document.getElementById("st-total").textContent = ALL_KAMAR.length;
  document.getElementById("st-isi").textContent = isi;
  document.getElementById("st-kosong").textContent = kosong;
  document.getElementById("st-booking").textContent = booking;
  document.getElementById("st-perbaikan").textContent = perbaikan;
  document.getElementById("st-gudang").textContent = gudang;
  document.getElementById("st-omzet").textContent = rupiah(omzet);

  // lantai bars
  document.getElementById("lantai-bars").innerHTML = LANTAI.map(l => {
    const nos = Array.from({ length: l.jumlah }, (_, i) => l.mulai + i);
    const t = nos.filter(no => rooms[no].status === "terisi").length;
    const pct = Math.round(t / nos.length * 100);
    return `<div class="lbar"><div class="lbar-top"><span>${l.nama}</span><span>${t}/${nos.length} terisi (${pct}%)</span></div>
      <div class="lbar-track"><div class="lbar-fill" style="width:${pct}%"></div></div></div>`;
  }).join("");

  // bill summary bulan ini
  const ym = bulanTagihan;
  document.getElementById("bln-ini").textContent = labelBulan(ym);
  let belum = 0, sudah = 0, totalBelum = 0, totalSudah = 0;
  ALL_KAMAR.forEach(no => {
    const r = rooms[no];
    if (r.status !== "terisi") return;
    if (lunasBulan(no, ym)) { sudah++; totalSudah += +r.harga || 0; }
    else { belum++; totalBelum += +r.harga || 0; }
  });
  document.getElementById("bill-summary").innerHTML = `
    <div><span>Sudah bayar</span><b style="color:var(--green)">${sudah} kamar • ${rupiah(totalSudah)}</b></div>
    <div><span>Belum bayar</span><b style="color:var(--red)">${belum} kamar • ${rupiah(totalBelum)}</b></div>
    <div class="total"><span>Total tagihan bulan ${labelBulan(ym)}</span><b>${rupiah(totalSudah + totalBelum)}</b></div>`;

  renderKamar();
  renderPenghuni();
  renderTagihan();
  renderInput();
  renderPengeluaran();
}

// ===== PETA KAMAR =====
function renderKamar() {
  document.getElementById("lantai-wrap").innerHTML = LANTAI.map(l =>
    `<div class="lantai-box"><div class="lantai-title">${l.nama} — ${l.jumlah} kamar (No. ${l.mulai}–${l.mulai + l.jumlah - 1})</div>
    <div class="kamar-grid">` +
    Array.from({ length: l.jumlah }, (_, i) => l.mulai + i).map(no => {
      const r = D.rooms[no];
      return `<div class="kamar ${r.status}" onclick="bukaKamar(${no})">
        <div class="no">${no}</div><div class="st">${stLabel[r.status]}</div></div>`;
    }).join("") + "</div></div>").join("");
}

function bukaKamar(no) {
  const r = D.rooms[no];
  const ym = bulanTagihan;
  const sudahBayar = r.status === "terisi" ? lunasBulan(no, ym) : false;
  const hariTempo = r.tempo ? ` (jatuh tempo: ${new Date(r.tempo + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })})` : "";
  document.getElementById("modal").innerHTML = `
    <h3>Kamar ${no}</h3>
    <p class="m-sub">Status saat ini: <b>${stLabel[r.status]}</b>${hariTempo}</p>
    ${r.status === "terisi" ? `<div class="m-stats"><span>Bulan ${labelBulan(ym)}</span><b style="color:${sudahBayar ? "var(--green)" : "var(--red)"}">${sudahBayar ? "LUNAS ✓" : "BELUM BAYAR"}</b></div>` : ""}
    <label>Status Kamar</label>
    <select id="m-status">
      ${Object.keys(stLabel).map(s => `<option value="${s}" ${r.status === s ? "selected" : ""}>${stLabel[s]}</option>`).join("")}
    </select>
    <label>Nama Penyewa</label><input id="m-nama" value="${r.nama || ""}" placeholder="Nama penghuni">
    <label>No. WhatsApp</label><input id="m-wa" value="${r.wa || ""}" placeholder="08xxxxxxxxxx">
    <label>Harga Sewa / bulan (Rp)</label><input id="m-harga" type="number" value="${r.harga || ""}" placeholder="contoh: 800000">
    <label>Tanggal Masuk</label><input id="m-masuk" type="date" value="${r.masuk || ""}">
    <label>Tanggal Jatuh Tempo Bulanan</label><input id="m-tempo" type="date" value="${r.tempo || ""}">
    <label>Catatan</label><textarea id="m-catatan" rows="2" placeholder="contoh: bayar listrik terpisah">${r.catatan || ""}</textarea>
    <div class="m-actions">
      <button class="btn" onclick="simpanKamar(${no})">💾 Simpan</button>
      ${r.status === "terisi" ? `<button class="btn ${sudahBayar ? "gray" : ""}" onclick="toggleBayar(${no})">${sudahBayar ? "↩ Batalkan Lunas" : "✓ Tandai Lunas " + labelBulan(ym)}</button>` : ""}
      ${r.nama ? `<button class="btn danger" onclick="kosongkanKamar(${no})">🗑 Kosongkan</button>` : ""}
    </div>
    <button class="btn gray" style="width:100%;margin-top:8px" onclick="tutupModal()">Tutup</button>`;
  document.getElementById("overlay").classList.remove("hidden");
}
function tutupModal() { document.getElementById("overlay").classList.add("hidden"); }

function simpanKamar(no) {
  const r = D.rooms[no];
  const oldNama = r.nama;
  const status = document.getElementById("m-status").value;
  const nama = document.getElementById("m-nama").value.trim();
  r.status = status;
  r.nama = nama;
  r.wa = document.getElementById("m-wa").value.trim();
  r.harga = +document.getElementById("m-harga").value || 0;
  r.masuk = document.getElementById("m-masuk").value;
  r.tempo = document.getElementById("m-tempo").value;
  r.catatan = document.getElementById("m-catatan").value.trim();
  if (status === "terisi" && !nama) { toast("⚠ Isi nama penyewa untuk kamar terisi"); return; }
  if (oldNama && nama !== oldNama) catatKeluar(no, oldNama);
  if (nama && nama !== oldNama) catatMasuk(no, nama, r.harga);
  if (status !== "terisi") r.nama = "";
  if (!r.nama && oldNama) catatKeluar(no, oldNama);
  simpan(); tutupModal(); render(); toast(`✓ Kamar ${no} disimpan`);
}
function toggleBayar(no) {
  const ym = bulanTagihan;
  const r = D.rooms[no];
  r.bayar = r.bayar || [];
  if (lunasBulan(no, ym)) r.bayar = r.bayar.filter(x => x !== ym);
  else r.bayar.push(ym);
  simpan(); bukaKamar(no); render();
}
function kosongkanKamar(no) {
  if (!confirm(`Kosongkan kamar ${no}? Data penyewa & riwayat bayar dihapus.`)) return;
  const rk = D.rooms[no];
  if (rk.nama) catatKeluar(no, rk.nama);
  D.rooms[no] = { status: "kosong", nama: "", wa: "", harga: D.rooms[no].harga, masuk: "", tempo: "", catatan: "", bayar: [] };
  simpan(); tutupModal(); render(); toast(`Kamar ${no} dikosongkan`);
}

// ===== PENGHUNI =====
function renderPenghuni() {
  const isi = ALL_KAMAR.filter(no => D.rooms[no].status === "terisi");
  document.getElementById("penghuni-list").innerHTML = isi.length ? isi.map(no => {
    const r = D.rooms[no];
    const wa = r.wa ? `<a class="btn gray" style="text-decoration:none" href="https://wa.me/62${r.wa.replace(/^0/, "").replace(/\D/g, "")}" target="_blank">💬 WA</a>` : "";
    return `<div class="row">
      <div class="info"><div class="r-name">${r.nama}</div>
      <div class="r-sub">Kamar ${no} • ${rupiah(r.harga)}/bln • masuk ${r.masuk || "-"}${r.tempo ? " • tempo tgl " + r.tempo.split("-")[2] : ""}</div></div>
      ${wa}
      <button class="btn" onclick="bukaKamar(${no})">Detail</button>
    </div>`;
  }).join("") : `<p class="empty">Belum ada penghuni.</p>`;
}

// ===== TAGIHAN =====
function ubahBulan(delta) {
  const [y, m] = bulanTagihan.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  bulanTagihan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  render();
}
function renderTagihan() {
  const ym = bulanTagihan;
  document.getElementById("tagihan-bulan").textContent = labelBulan(ym);
  const isi = ALL_KAMAR.filter(no => D.rooms[no].status === "terisi");
  document.getElementById("tagihan-list").innerHTML = isi.length ? isi.map(no => {
    const r = D.rooms[no];
    const ok = lunasBulan(no, ym);
    return `<div class="row">
      <div class="info"><div class="r-name">${r.nama} — Kamar ${no}</div>
      <div class="r-sub">${rupiah(r.harga)}${r.wa ? " • " + r.wa : ""}</div></div>
      <span class="pill ${ok ? "ok" : "late"}">${ok ? "LUNAS" : "BELUM"}</span>
      ${!ok ? `<button class="btn wa" onclick="kirimTagihanWA(${no})">💬 Tagihan WA</button>` : ""}
      <button class="btn ${ok ? "gray" : ""}" onclick="bayarDariList(${no})">${ok ? "↩ Batal" : "✓ Lunas"}</button>
    </div>`;
  }).join("") : `<p class="empty">Tidak ada kamar terisi.</p>`;
}
function bayarDariList(no) { toggleBayar(no); }

// ===== KIRIM TAGIHAN VIA WHATSAPP =====
function kirimTagihanWA(no) {
  const r = D.rooms[no];
  if (!r.wa) { toast("❌ Nomor WA kamar " + no + " belum diisi (isi di menu Input)"); return; }
  const ym = bulanTagihan;
  const wa62 = "62" + r.wa.replace(/^0/, "").replace(/\D/g, "");
  const tempoTxt = r.tempo ? new Date(r.tempo + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "akhir bulan";
  const msg = `Selamat pagi/siang 🙏

Saya admin *Kost Kelinci Bunder*.

Tagihan sewa kamar *${no}* untuk bulan *${labelBulan(ym)}*:
💰 ${rupiah(r.harga)}

Mohon pembayaran sebelum *${tempoTxt}*. Jika sudah membayar, abaikan pesan ini ya.

Terima kasih 🙏`;
  window.open(`https://wa.me/${wa62}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ===== INPUT CEPAT =====
function renderInput() {
  const sel = document.getElementById("in-kamar");
  sel.innerHTML = ALL_KAMAR.map(no => {
    const r = D.rooms[no];
    return `<option value="${no}">Kamar ${no}${r.status !== "kosong" ? " • " + stLabel[r.status] + (r.nama ? " (" + r.nama + ")" : "") : r.harga ? " • " + rupiah(r.harga) : ""}</option>`;
  }).join("");
  const ml = document.getElementById("massal-lantai");
  ml.innerHTML = LANTAI.map((l, i) => `<option value="${i}">${l.nama}</option>`).join("");
}
function isiDariKamar() {
  const no = +document.getElementById("in-kamar").value;
  const r = D.rooms[no];
  document.getElementById("in-nama").value = r.nama || "";
  document.getElementById("in-wa").value = r.wa || "";
  document.getElementById("in-harga").value = r.harga || "";
  document.getElementById("in-masuk").value = r.masuk || "";
  document.getElementById("in-tempo").value = r.tempo || "";
  document.getElementById("in-catatan").value = r.catatan || "";
}
function simpanInput() {
  const no = +document.getElementById("in-kamar").value;
  const hint = document.getElementById("input-hint");
  const nama = document.getElementById("in-nama").value.trim();
  const harga = +document.getElementById("in-harga").value || 0;
  if (!nama) { hint.className = "input-hint err"; hint.textContent = "❌ Nama penyewa wajib diisi"; return; }
  if (!harga) { hint.className = "input-hint err"; hint.textContent = "❌ Harga sewa wajib diisi"; return; }
  const r = D.rooms[no];
  const oldNama = r.nama;
  r.nama = nama;
  r.harga = harga;
  r.wa = document.getElementById("in-wa").value.trim();
  r.masuk = document.getElementById("in-masuk").value;
  r.tempo = document.getElementById("in-tempo").value;
  r.catatan = document.getElementById("in-catatan").value.trim();
  if (r.status === "kosong") r.status = "terisi";
  if (r.status === "gudang") { hint.className = "input-hint err"; hint.textContent = "❌ Kamar " + no + " adalah gudang, tidak bisa diisi"; return; }
  if (oldNama && nama !== oldNama) catatKeluar(no, oldNama);
  if (nama && nama !== oldNama) catatMasuk(no, nama, harga);
  simpan(); render();
  hint.className = "input-hint ok";
  hint.textContent = `✓ Kamar ${no}: ${nama} tersimpan (${rupiah(harga)}/bln)`;
  toast(`✓ Kamar ${no} tersimpan`);
}
function setHargaMassal() {
  const li = +document.getElementById("massal-lantai").value;
  const harga = +document.getElementById("massal-harga").value || 0;
  if (!harga) { toast("❌ Isi harga dulu"); return; }
  const l = LANTAI[li];
  const nos = Array.from({ length: l.jumlah }, (_, i) => l.mulai + i).filter(no => D.rooms[no].status === "kosong");
  if (!nos.length) { toast("Tidak ada kamar kosong di " + l.nama); return; }
  if (!confirm(`Set harga ${rupiah(harga)} ke ${nos.length} kamar kosong di ${l.nama}?`)) return;
  nos.forEach(no => D.rooms[no].harga = harga);
  simpan(); render(); toast(`✓ ${nos.length} kamar di ${l.nama} diset ${rupiah(harga)}`);
}

// ===== SETELAN =====
function exportData() {
  const blob = new Blob([JSON.stringify(D, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kost-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
document.getElementById("import-file").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d.rooms) throw 0;
      D = d; simpan(); render(); toast("✓ Data berhasil direstore");
    } catch { toast("❌ File backup tidak valid"); }
  };
  rd.readAsText(f);
});
function gantiPin() {
  const lama = document.getElementById("pin-lama").value.trim();
  const baru = document.getElementById("pin-baru").value.trim();
  if (lama !== D.pin) { toast("❌ PIN lama salah"); return; }
  if (!/^\d{4,8}$/.test(baru)) { toast("❌ PIN baru 4-8 angka"); return; }
  D.pin = baru; pinGantiLama = lama; simpan(); toast("✓ PIN berhasil diganti & disinkron");
  document.getElementById("pin-lama").value = ""; document.getElementById("pin-baru").value = "";
}
function resetData() {
  if (!confirm("Yakin hapus SEMUA data penyewa & pembayaran? Tidak bisa dibatalkan (backup dulu!).")) return;
  const pin = D.pin;
  D = dataAwal(); D.pin = pin;
  simpan(); render(); toast("Semua data direset");
}

// enter untuk login
document.getElementById("pin-input").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
// listener input sekali saja
document.getElementById("in-kamar").addEventListener("change", isiDariKamar);

// ===== PENGELUARAN =====
const ymDari = tgl => (tgl || "").slice(0, 7);
function renderPengeluaran() {
  const ym = bulanTagihan;
  document.getElementById("pengeluaran-bulan").textContent = labelBulan(ym);
  let masuk = 0;
  ALL_KAMAR.forEach(no => { const r = D.rooms[no]; if (r.status === "terisi" && lunasBulan(no, ym)) masuk += +r.harga || 0; });
  const bulanIni = (D.pengeluaran || []).filter(x => ymDari(x.tanggal) === ym);
  const keluar = bulanIni.reduce((s, x) => s + (+x.jumlah || 0), 0);
  document.getElementById("pl-masuk").textContent = rupiah(masuk);
  document.getElementById("pl-keluar").textContent = rupiah(keluar);
  document.getElementById("pl-saldo").textContent = rupiah(masuk - keluar);
  document.getElementById("pengeluaran-list").innerHTML = bulanIni.length
    ? bulanIni.slice().sort((x, y) => String(y.tanggal).localeCompare(String(x.tanggal))).map(x => `
      <div class="row">
        <div class="info"><div class="r-name">${x.kategori}${x.ket ? " — " + x.ket : ""}</div>
        <div class="r-sub">${x.tanggal || "-"} • ${rupiah(x.jumlah)}</div></div>
        <button class="btn danger" onclick="hapusPengeluaran('${x.id}')">🗑</button>
      </div>`).join("")
    : `<p class="empty">Belum ada pengeluaran bulan ${labelBulan(ym)}.</p>`;
}
function simpanPengeluaran() {
  const tanggal = document.getElementById("pl-tanggal").value || todayISO();
  const kategori = document.getElementById("pl-kategori").value;
  const ket = document.getElementById("pl-ket").value.trim();
  const jumlah = +document.getElementById("pl-jumlah").value || 0;
  if (!jumlah) { toast("❌ Isi jumlah pengeluaran"); return; }
  D.pengeluaran.push({ id: "p" + Date.now(), tanggal, kategori, ket, jumlah });
  simpan(); render();
  document.getElementById("pl-ket").value = "";
  document.getElementById("pl-jumlah").value = "";
  toast("✓ Pengeluaran " + rupiah(jumlah) + " dicatat");
}
function hapusPengeluaran(id) {
  if (!confirm("Hapus catatan pengeluaran ini?")) return;
  D.pengeluaran = D.pengeluaran.filter(x => x.id !== id);
  simpan(); render(); toast("Pengeluaran dihapus");
}

// ===== EKSPOR PDF =====
function cekJspdf() {
  if (window.jspdf && window.jspdf.jsPDF) return true;
  toast("❌ Library PDF belum termuat (cek koneksi), memakai mode cetak...");
  return false;
}
function buatDoc() {
  const { jsPDF } = window.jspdf;
  return { doc: new jsPDF({ unit: "mm", format: "a4" }) };
}
function headerPdf(doc, judul, sub) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("KOST KELINCI BUNDER", 105, 14, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(judul + " — " + sub, 105, 21, { align: "center" });
  doc.setFontSize(7.5); doc.setTextColor(110);
  doc.text("Dicetak: " + new Date().toLocaleString("id-ID"), 196, 14, { align: "right" });
  doc.setTextColor(0);
  doc.setDrawColor(180); doc.line(14, 25, 196, 25);
}
function tabel(doc, y, cols, rows) {
  const x0 = 14, hH = 7, hR = 7;
  const gambarHeader = yy => {
    doc.setFillColor(226, 232, 240); doc.rect(x0, yy, cols.reduce((s, c) => s + c.w, 0), hH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    let x = x0;
    cols.forEach(c => { doc.text(String(c.t).slice(0, 30), x + 2, yy + 4.8); x += c.w; });
    return yy + hH;
  };
  let x = x0;
  doc.setDrawColor(200);
  cols.forEach(c => { doc.line(x, y, x + c.w, y); x += c.w; });
  y = gambarHeader(y);
  doc.setFont("helvetica", "normal");
  rows.forEach((r, idx) => {
    if (y > 272) { doc.addPage(); y = gambarHeader(16); }
    if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(x0, y, cols.reduce((s, c) => s + c.w, 0), hR, "F"); }
    let xx = x0;
    cols.forEach(c => { doc.text(String(r[c.k] ?? "-").slice(0, c.max || 40), xx + 2, y + 4.8); xx += c.w; });
    doc.setDrawColor(220);
    x = x0;
    cols.forEach(c => { doc.line(x, y + hR, x + c.w, y + hR); x += c.w; });
    y += hR;
  });
  return y;
}

function pdfPembayaran() {
  const ym = bulanTagihan;
  const isi = ALL_KAMAR.filter(no => D.rooms[no].status === "terisi");
  if (!isi.length) { toast("Tidak ada kamar terisi"); return; }
  if (!cekJspdf()) return cetakPembayaran();
  const { doc } = buatDoc();
  headerPdf(doc, "LAPORAN PEMBAYARAN", labelBulan(ym));
  let lunas = 0, belum = 0, tL = 0, tB = 0;
  const rows = isi.map(no => {
    const r = D.rooms[no];
    const ok = lunasBulan(no, ym);
    if (ok) { lunas++; tL += +r.harga || 0; } else { belum++; tB += +r.harga || 0; }
    return { no: no, nama: r.nama, harga: rupiah(r.harga), status: ok ? "LUNAS" : "BELUM" };
  });
  const y = tabel(doc, 30, [
    { k: "no", t: "Kamar", w: 18, max: 6 },
    { k: "nama", t: "Nama Penyewa", w: 66, max: 38 },
    { k: "harga", t: "Harga/Bulan", w: 36, max: 14 },
    { k: "status", t: "Status", w: 30, max: 10 },
  ], rows);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
  doc.text("Sudah bayar: " + lunas + " kamar — " + rupiah(tL), 14, y + 8);
  doc.text("Belum bayar: " + belum + " kamar — " + rupiah(tB), 14, y + 14);
  doc.setFontSize(11);
  doc.text("TOTAL TAGIHAN BULAN INI: " + rupiah(tL + tB), 14, y + 22);
  const plg = (D.pengeluaran || []).filter(x => String(x.tanggal).slice(0, 7) === ym);
  const totPlg = plg.reduce((s, x) => s + (+x.jumlah || 0), 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Pengeluaran kost bulan ini: " + rupiah(totPlg) + " (" + plg.length + " catatan)", 14, y + 30);
  doc.setFont("helvetica", "bold");
  doc.text("SALDO BERSIH (MASUK - KELUAR): " + rupiah(tL - totPlg), 14, y + 37);
  doc.save("Laporan-Pembayaran-" + ym + ".pdf");
  toast("✓ PDF laporan pembayaran dibuat");
}

function pdfMutasi() {
  if (!D.mutasi.length) { toast("Belum ada riwayat penyewa masuk/keluar"); return; }
  if (!cekJspdf()) return cetakMutasi();
  const { doc } = buatDoc();
  headerPdf(doc, "LAPORAN IN / OUT PENYEWA", "Semua Periode");
  const rows = D.mutasi.slice().sort((a, b) => String(a.masuk).localeCompare(String(b.masuk))).map(m => ({
    kamar: m.kamar, nama: m.nama, masuk: m.masuk || "-", keluar: m.keluar || "-",
    harga: rupiah(m.harga), status: m.keluar ? "KELUAR" : "AKTIF",
  }));
  tabel(doc, 30, [
    { k: "kamar", t: "Kamar", w: 16, max: 5 },
    { k: "nama", t: "Nama Penyewa", w: 54, max: 30 },
    { k: "masuk", t: "Masuk", w: 26, max: 10 },
    { k: "keluar", t: "Keluar", w: 26, max: 10 },
    { k: "harga", t: "Harga", w: 30, max: 12 },
    { k: "status", t: "Status", w: 20, max: 7 },
  ], rows);
  doc.save("Laporan-In-Out-Penyewa-" + todayISO() + ".pdf");
  toast("✓ PDF laporan in/out dibuat");
}

// fallback: mode cetak browser (Save as PDF)
function cetakHtml(judul, rowsHtml) {
  const w = window.open("", "_blank");
  if (!w) { toast("❌ Popup diblokir browser"); return; }
  w.document.write(`<html><head><title>${judul}</title><style>
    body{font-family:Arial;padding:20px}h2{text-align:center}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #999;padding:6px;text-align:left}th{background:#e2e8f0}
  </style></head><body><h2>KOST KELINCI BUNDER</h2><p style="text-align:center">${judul}</p>${rowsHtml}
  <p style="font-size:10px">Dicetak: ${new Date().toLocaleString("id-ID")}</p></body></html>`);
  w.document.close(); setTimeout(() => w.print(), 400);
}
function cetakPembayaran() {
  const ym = bulanTagihan;
  const rows = ALL_KAMAR.filter(no => D.rooms[no].status === "terisi").map(no => {
    const r = D.rooms[no];
    return `<tr><td>${no}</td><td>${r.nama}</td><td>${rupiah(r.harga)}</td><td>${lunasBulan(no, ym) ? "LUNAS" : "BELUM"}</td></tr>`;
  }).join("");
  cetakHtml("Laporan Pembayaran — " + labelBulan(ym), `<table><tr><th>Kamar</th><th>Nama</th><th>Harga</th><th>Status</th></tr>${rows}</table>`);
}
function cetakMutasi() {
  const rows = D.mutasi.map(m => `<tr><td>${m.kamar}</td><td>${m.nama}</td><td>${m.masuk || "-"}</td><td>${m.keluar || "-"}</td><td>${m.keluar ? "KELUAR" : "AKTIF"}</td></tr>`).join("");
  cetakHtml("Laporan In/Out Penyewa", `<table><tr><th>Kamar</th><th>Nama</th><th>Masuk</th><th>Keluar</th><th>Status</th></tr>${rows}</table>`);
}

function pdfPengeluaran() {
  const ym = bulanTagihan;
  const plg = (D.pengeluaran || []).filter(x => String(x.tanggal).slice(0, 7) === ym)
    .sort((x, y) => String(x.tanggal).localeCompare(String(y.tanggal)));
  let masuk = 0;
  ALL_KAMAR.forEach(no => { const r = D.rooms[no]; if (r.status === "terisi" && lunasBulan(no, ym)) masuk += +r.harga || 0; });
  const keluar = plg.reduce((s, x) => s + (+x.jumlah || 0), 0);
  if (!cekJspdf()) return cetakPengeluaran();
  const { doc } = buatDoc();
  headerPdf(doc, "LAPORAN PENGELUARAN", labelBulan(ym));
  const rows = plg.map((x, idx) => ({ no: idx + 1, tanggal: x.tanggal, kategori: x.kategori, ket: x.ket || "-", jumlah: rupiah(x.jumlah) }));
  if (!rows.length) rows.push({ no: "-", tanggal: "-", kategori: "-", ket: "Tidak ada pengeluaran", jumlah: "-" });
  const y = tabel(doc, 30, [
    { k: "no", t: "No", w: 12, max: 4 },
    { k: "tanggal", t: "Tanggal", w: 26, max: 10 },
    { k: "kategori", t: "Kategori", w: 34, max: 14 },
    { k: "ket", t: "Keterangan", w: 56, max: 32 },
    { k: "jumlah", t: "Jumlah", w: 34, max: 14 },
  ], rows);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
  doc.text("Total Pemasukan (lunas): " + rupiah(masuk), 14, y + 8);
  doc.text("Total Pengeluaran: " + rupiah(keluar), 14, y + 14);
  doc.setFontSize(11);
  doc.text("SALDO BERSIH BULAN " + labelBulan(ym).toUpperCase() + ": " + rupiah(masuk - keluar), 14, y + 22);
  doc.save("Laporan-Pengeluaran-" + ym + ".pdf");
  toast("✓ PDF laporan pengeluaran dibuat");
}
function cetakPengeluaran() {
  const ym = bulanTagihan;
  const plg = (D.pengeluaran || []).filter(x => String(x.tanggal).slice(0, 7) === ym);
  const rows = plg.map(x => `<tr><td>${x.tanggal}</td><td>${x.kategori}</td><td>${x.ket || "-"}</td><td>${rupiah(x.jumlah)}</td></tr>`).join("");
  cetakHtml("Laporan Pengeluaran — " + labelBulan(ym), `<table><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Jumlah</th></tr>${rows || "<tr><td colspan=4>-</td></tr>"}</table>`);
}
