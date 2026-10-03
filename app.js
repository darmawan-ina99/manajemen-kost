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
  return { pin: "0021", rooms };
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
    return d;
  } catch { return dataAwal(); }
}
function simpan() { localStorage.setItem(KEY, JSON.stringify(D)); }
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add("hidden"), 2200);
}
const rupiah = n => "Rp" + (Number(n) || 0).toLocaleString("id-ID");
const stLabel = { kosong: "Kosong", terisi: "Terisi", booking: "Booking", perbaikan: "Perbaikan", gudang: "Gudang" };
const lunasBulan = (no, ym) => (D.rooms[no].bayar || []).includes(ym);

// ===== LOGIN =====
function login() {
  const v = document.getElementById("pin-input").value.trim();
  if (v === D.pin) {
    document.getElementById("pin-gate").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    render();
  } else document.getElementById("pin-err").textContent = "❌ PIN salah";
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
  if (status !== "terisi") r.nama = "";
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
      <button class="btn ${ok ? "gray" : ""}" onclick="bayarDariList(${no})">${ok ? "↩ Batal" : "✓ Lunas"}</button>
    </div>`;
  }).join("") : `<p class="empty">Tidak ada kamar terisi.</p>`;
}
function bayarDariList(no) { toggleBayar(no); }

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
  r.nama = nama;
  r.harga = harga;
  r.wa = document.getElementById("in-wa").value.trim();
  r.masuk = document.getElementById("in-masuk").value;
  r.tempo = document.getElementById("in-tempo").value;
  r.catatan = document.getElementById("in-catatan").value.trim();
  if (r.status === "kosong") r.status = "terisi";
  if (r.status === "gudang") { hint.className = "input-hint err"; hint.textContent = "❌ Kamar " + no + " adalah gudang, tidak bisa diisi"; return; }
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
  D.pin = baru; simpan(); toast("✓ PIN berhasil diganti");
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
