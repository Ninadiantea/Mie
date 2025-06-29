# Bot Telegram Warung (Node.js)

Bot Telegram sederhana untuk transaksi penjualan warung — fitur:
- Multi pelanggan & barang
- Harga khusus per pelanggan & barang
- Menu transaksi untuk penjaga warung
- Menu admin (👑) dengan password
- Tambah/edit/hapus pelanggan & barang
- Hapus pelanggan hanya jika sudah lunas
- Notifikasi transaksi ke grup Telegram
- Data tersimpan di `database.json` (semua file di root repo)

## Cara Pakai

1. Clone repo ini
2. Isi file `.env` dengan token bot Telegram kamu (`BOT_TOKEN=...`) dan ID grup (`GROUP_ID=...`)
3. Install dependencies:
   ```
   npm install
   ```
4. Jalankan bot:
   ```
   npm start
   ```
5. Semua data otomatis disimpan di `database.json`

## Struktur File

- `bot.js` — kode utama bot
- `database.json` — seluruh data (admin, pelanggan, barang, transaksi, group_id)
- `.env` — token rahasia bot & ID grup
- `package.json` — dependensi Node.js

## Fitur

- 👑 **Admin Menu**: tambah/edit/hapus pelanggan/barang, atur harga khusus, hapus transaksi
- 🛒 **Penjaga Menu**: transaksi mudah, pilih pelanggan, pilih barang, harga otomatis sesuai setting
- 🗑️ **Hapus pelanggan**: hanya jika tidak punya hutang
- 🔔 **Notifikasi grup**: setiap transaksi masuk
- Semua data tampil informatif setiap langkah (nama, plat, alamat, dsb)
- Ikon pada setiap menu untuk kemudahan

---

**Catatan:**  
- Untuk produksi, sebaiknya pakai session/database yang lebih kuat.
- Bisa dikembangkan: laporan PDF, multi user, dsb.
