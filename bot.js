require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || 'ISI_TOKEN_BOT_ANDA';
const GROUP_ID = process.env.GROUP_ID || null; // ID grup Telegram untuk notifikasi

const DB_FILE = 'database.json';
let db = {
  admin: { username: "admin", password: "super123" },
  penjaga: [],
  pelanggan: [],
  barang: [],
  transaksi: [],
  group_id: GROUP_ID
};
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const session = {};
const bot = new Telegraf(BOT_TOKEN);

// ====== UTILITIES ======
function getPelangganButtons() {
  return db.pelanggan.map(
    (p, i) => [Markup.button.callback(`👤 ${p.nama}`, `sel_pel_${i}`)]
  );
}
function getBarangButtons(pelangganIdx) {
  const p = db.pelanggan[pelangganIdx];
  return db.barang.map((b, i) => {
    let harga = (p && p.harga_khusus && p.harga_khusus[b.nama]) || b.harga_default || 0;
    return [Markup.button.callback(`🛒 ${b.nama} (Rp${harga})`, `sel_barang_${pelangganIdx}_${i}`)];
  });
}
function getJumlahButtons(pelangganIdx, barangIdx) {
  return [
    [Markup.button.callback("1️⃣ 1", `jumlah_${pelangganIdx}_${barangIdx}_1`), Markup.button.callback("2️⃣ 2", `jumlah_${pelangganIdx}_${barangIdx}_2`)],
    [Markup.button.callback("3️⃣ 3", `jumlah_${pelangganIdx}_${barangIdx}_3`), Markup.button.callback("🔢 Lainnya", `jumlah_${pelangganIdx}_${barangIdx}_lain`)]
  ];
}
function getAdminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 Kelola Pelanggan", "admin_pelanggan")],
    [Markup.button.callback("🏷️ Atur Harga", "admin_harga")],
    [Markup.button.callback("📦 Kelola Barang", "admin_barang")],
    [Markup.button.callback("🗑️ Hapus Data", "admin_hapus")],
    [Markup.button.callback("⬅️ Kembali ke Menu", "admin_logout")]
  ]);
}
function sendGroupNotif(text) {
  const groupId = db.group_id || GROUP_ID;
  if (groupId) {
    bot.telegram.sendMessage(groupId, text).catch(() => {});
  }
}

// ====== START MENU ======
bot.start(ctx => {
  ctx.reply(
    "Selamat datang di Bot Warung! Pilih menu:",
    Markup.inlineKeyboard([
      [Markup.button.callback("🛒 Mulai Transaksi", "transaksi")],
      [Markup.button.callback("👑 Admin", "admin_login")]
    ])
  );
});

// ====== TRANSAKSI (PENJAGA) ======
bot.action("transaksi", ctx => {
  if (!db.pelanggan.length) return ctx.reply("Belum ada pelanggan. Hubungi admin.");
  ctx.reply("Pilih pelanggan:", Markup.inlineKeyboard([...getPelangganButtons()]));
});

bot.action(/^sel_pel_(\d+)/, ctx => {
  const idx = Number(ctx.match[1]);
  const p = db.pelanggan[idx];
  if (!db.barang.length) return ctx.reply("Belum ada barang. Hubungi admin.");
  ctx.reply(
    `👤 Nama: ${p.nama}\n🚗 Plat: ${p.plat}\n🏠 Alamat: ${p.alamat}`,
    Markup.inlineKeyboard([...getBarangButtons(idx)])
  );
});

bot.action(/^sel_barang_(\d+)_(\d+)/, ctx => {
  const pelIdx = Number(ctx.match[1]);
  const barIdx = Number(ctx.match[2]);
  ctx.reply(
    `Pilih jumlah barang:`,
    Markup.inlineKeyboard(getJumlahButtons(pelIdx, barIdx))
  );
  session[ctx.from.id] = { pelIdx, barIdx };
});

bot.action(/^jumlah_(\d+)_(\d+)_(\d+)/, ctx => {
  const pelIdx = Number(ctx.match[1]);
  const barIdx = Number(ctx.match[2]);
  const jumlah = Number(ctx.match[3]);
  transaksiKonfirmasi(ctx, pelIdx, barIdx, jumlah);
});
bot.action(/^jumlah_(\d+)_(\d+)_lain/, ctx => {
  ctx.reply("Masukkan jumlah barang (angka):");
  session[ctx.from.id].inputJumlah = true;
});
bot.on('text', ctx => {
  const s = session[ctx.from.id];
  if (s && s.inputJumlah) {
    const jml = parseInt(ctx.message.text);
    if (!isNaN(jml) && jml > 0) {
      transaksiKonfirmasi(ctx, s.pelIdx, s.barIdx, jml);
    } else {
      ctx.reply("Jumlah tidak valid!");
    }
    delete s.inputJumlah;
    return;
  }
  // --- ADMIN INPUTS ada di bawah
});

// ====== KONFIRMASI TRANSAKSI ======
function transaksiKonfirmasi(ctx, pelIdx, barIdx, jumlah) {
  const p = db.pelanggan[pelIdx];
  const b = db.barang[barIdx];
  const hargaSatuan = (p && p.harga_khusus && p.harga_khusus[b.nama]) || b.harga_default || 0;
  const total = hargaSatuan * jumlah;
  session[ctx.from.id].transaksi = { pelIdx, barIdx, jumlah, hargaSatuan, total };
  ctx.reply(
    `📝 Konfirmasi Pesanan\n\n` +
    `👤 Nama: ${p.nama}\n🚗 Plat: ${p.plat}\n🏠 Alamat: ${p.alamat}\n\n` +
    `🛒 Barang: ${b.nama}\n🔢 Jumlah: ${jumlah}\n💰 Harga Satuan: Rp${hargaSatuan}\n💵 Total: Rp${total}\n\n` +
    `Data sudah benar?`,
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Konfirmasi", "transaksi_ok")],
      [Markup.button.callback("❌ Batal", "transaksi_batal")]
    ])
  );
}
bot.action("transaksi_ok", ctx => {
  const s = session[ctx.from.id].transaksi;
  const p = db.pelanggan[s.pelIdx];
  const b = db.barang[s.barIdx];
  db.transaksi.push({
    pelanggan: p.nama,
    plat: p.plat,
    alamat: p.alamat,
    barang: b.nama,
    jumlah: s.jumlah,
    harga_satuan: s.hargaSatuan,
    total: s.total,
    waktu: new Date().toISOString(),
    status: "Belum Lunas"
  });
  saveDB();
  ctx.reply("Transaksi berhasil dicatat!");
  sendGroupNotif(
    `🔔 *Transaksi Baru!*\n👤 Nama: ${p.nama}\n🚗 Plat: ${p.plat}\n🏠 Alamat: ${p.alamat}\n🛒 Barang: ${b.nama}\n🔢 Jumlah: ${s.jumlah}\n💵 Total: Rp${s.total}`
  );
});
bot.action("transaksi_batal", ctx => {
  ctx.reply("Transaksi dibatalkan.");
});

// ====== ADMIN (Menu, Auth, dsb) ======
bot.action("admin_login", ctx => {
  ctx.reply("Masukkan password admin 👤🔒:");
  session[ctx.from.id] = { adminStep: "login" };
});
bot.on("text", ctx => {
  const s = session[ctx.from.id];
  if (s && s.adminStep === "login") {
    if (ctx.message.text === db.admin.password) {
      session[ctx.from.id].adminLogined = true;
      ctx.reply("👑 Selamat datang di menu admin!", getAdminMenu());
    } else {
      ctx.reply("❌ Password salah");
    }
    delete s.adminStep;
    return;
  }
  // === Tambah pelanggan, barang, harga khusus, dsb ===
  if (s && s.adminStep === "input_pelanggan_nama") {
    s.pelanggan = { nama: ctx.message.text };
    ctx.reply("Masukkan plat nomor:");
    s.adminStep = "input_pelanggan_plat";
    return;
  }
  if (s && s.adminStep === "input_pelanggan_plat") {
    s.pelanggan.plat = ctx.message.text;
    ctx.reply("Masukkan alamat:");
    s.adminStep = "input_pelanggan_alamat";
    return;
  }
  if (s && s.adminStep === "input_pelanggan_alamat") {
    s.pelanggan.alamat = ctx.message.text;
    s.pelanggan.harga_khusus = {};
    db.pelanggan.push(s.pelanggan);
    saveDB();
    ctx.reply(`✅ Pelanggan ${s.pelanggan.nama} berhasil ditambah!`);
    delete s.pelanggan;
    delete s.adminStep;
    return;
  }
  if (s && s.adminStep === "input_barang_nama") {
    s.barang = { nama: ctx.message.text };
    ctx.reply("Masukkan harga default:");
    s.adminStep = "input_barang_harga";
    return;
  }
  if (s && s.adminStep === "input_barang_harga") {
    s.barang.harga_default = parseInt(ctx.message.text) || 0;
    db.barang.push(s.barang);
    saveDB();
    ctx.reply(`✅ Barang ${s.barang.nama} berhasil ditambah!`);
    delete s.barang;
    delete s.adminStep;
    return;
  }
  if (s && s.adminStep === "input_harga_pelanggan") {
    s.hargaPelanggan = ctx.message.text;
    ctx.reply("Masukkan nama barang:");
    s.adminStep = "input_harga_barang";
    return;
  }
  if (s && s.adminStep === "input_harga_barang") {
    s.hargaBarang = ctx.message.text;
    ctx.reply("Masukkan harga khusus:");
    s.adminStep = "input_harga_value";
    return;
  }
  if (s && s.adminStep === "input_harga_value") {
    const namaP = s.hargaPelanggan;
    const namaB = s.hargaBarang;
    const harga = parseInt(ctx.message.text) || 0;
    const pel = db.pelanggan.find(p => p.nama === namaP);
    if (pel) {
      pel.harga_khusus[namaB] = harga;
      saveDB();
      ctx.reply(`✅ Harga khusus untuk ${namaP} - ${namaB} di-set Rp${harga}`);
    } else {
      ctx.reply("❌ Pelanggan tidak ditemukan.");
    }
    delete s.hargaPelanggan;
    delete s.hargaBarang;
    delete s.adminStep;
    return;
  }
});

// ====== ADMIN MENU HANDLER ======
bot.action("admin_pelanggan", ctx => {
  ctx.reply("Kelola pelanggan:",
    Markup.inlineKeyboard([
      [Markup.button.callback("➕ Tambah Pelanggan", "admin_pel_add")],
      [Markup.button.callback("🗑️ Hapus Pelanggan", "admin_pel_del")],
      [Markup.button.callback("⬅️ Kembali", "admin_logout")]
    ])
  );
});
bot.action("admin_pel_add", ctx => {
  ctx.reply("Masukkan nama pelanggan:");
  session[ctx.from.id].adminStep = "input_pelanggan_nama";
});
bot.action("admin_pel_del", ctx => {
  if (!db.pelanggan.length) return ctx.reply("Tidak ada pelanggan.");
  const buttons = db.pelanggan.map((p, i) =>
    [Markup.button.callback(`👤 ${p.nama} (${p.plat})`, `admin_pel_del_${i}`)]
  );
  ctx.reply("Pilih pelanggan yang akan dihapus:", Markup.inlineKeyboard(buttons));
});
bot.action(/^admin_pel_del_(\d+)/, ctx => {
  const idx = Number(ctx.match[1]);
  const pel = db.pelanggan[idx];
  // Cek apakah ada transaksi belum lunas
  const hutang = db.transaksi.filter(t => t.pelanggan === pel.nama && t.status !== "Lunas");
  if (hutang.length) {
    ctx.reply(`❗ Pelanggan masih punya hutang Rp${hutang.reduce((a, b) => a + b.total, 0)}\nTidak bisa dihapus sebelum lunas!`);
  } else {
    ctx.reply(`Yakin hapus pelanggan ${pel.nama}?`, Markup.inlineKeyboard([
      [Markup.button.callback("✅ Hapus", `admin_pel_hapusfix_${idx}`)],
      [Markup.button.callback("❌ Batal", "admin_pelanggan")]
    ]));
  }
});
bot.action(/^admin_pel_hapusfix_(\d+)/, ctx => {
  const idx = Number(ctx.match[1]);
  const pel = db.pelanggan[idx];
  db.pelanggan.splice(idx, 1);
  saveDB();
  ctx.reply(`Pelanggan ${pel.nama} telah dihapus!`);
});

// ====== ADMIN: KELOLA BARANG ======
bot.action("admin_barang", ctx => {
  ctx.reply("Kelola barang:",
    Markup.inlineKeyboard([
      [Markup.button.callback("➕ Tambah Barang", "admin_brg_add")],
      [Markup.button.callback("🗑️ Hapus Barang", "admin_brg_del")],
      [Markup.button.callback("⬅️ Kembali", "admin_logout")]
    ])
  );
});
bot.action("admin_brg_add", ctx => {
  ctx.reply("Masukkan nama barang:");
  session[ctx.from.id].adminStep = "input_barang_nama";
});
bot.action("admin_brg_del", ctx => {
  if (!db.barang.length) return ctx.reply("Tidak ada barang.");
  const buttons = db.barang.map((b, i) =>
    [Markup.button.callback(`🛒 ${b.nama}`, `admin_brg_del_${i}`)]
  );
  ctx.reply("Pilih barang yang akan dihapus:", Markup.inlineKeyboard(buttons));
});
bot.action(/^admin_brg_del_(\d+)/, ctx => {
  const idx = Number(ctx.match[1]);
  const brg = db.barang[idx];
  db.barang.splice(idx, 1);
  saveDB();
  ctx.reply(`Barang ${brg.nama} telah dihapus!`);
});

// ====== ADMIN: ATUR HARGA KHUSUS ======
bot.action("admin_harga", ctx => {
  ctx.reply("Atur harga khusus:\nKetik nama pelanggan:");
  session[ctx.from.id].adminStep = "input_harga_pelanggan";
});

// ====== ADMIN: HAPUS DATA (TRANSAKSI) ======
bot.action("admin_hapus", ctx => {
  ctx.reply("Pilih data yang ingin dihapus:",
    Markup.inlineKeyboard([
      [Markup.button.callback("📝 Hapus Transaksi", "admin_del_transaksi")],
      [Markup.button.callback("⬅️ Kembali", "admin_logout")]
    ])
  );
});
bot.action("admin_del_transaksi", ctx => {
  if (!db.transaksi.length) return ctx.reply("Tidak ada transaksi.");
  db.transaksi = [];
  saveDB();
  ctx.reply("Semua transaksi dihapus!");
});

// ====== LOGOUT ADMIN ======
bot.action("admin_logout", ctx => {
  session[ctx.from.id] = {};
  ctx.reply("Kembali ke menu utama.",
    Markup.inlineKeyboard([
      [Markup.button.callback("🛒 Mulai Transaksi", "transaksi")],
      [Markup.button.callback("👑 Admin", "admin_login")]
    ])
  );
});

// ====== BOT LAUNCH ======
bot.launch();
console.log("Bot berjalan...");
