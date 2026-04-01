import { EmbedBuilder } from "discord.js";

/** Teks bisa kamu ubah sesuai server. Satu embed (maks ~4096 karakter di description). */
const TERMS_DESCRIPTION = `
**1. Data pribadi**
Kami memproses data yang kamu kirim lewat form pendaftaran (misalnya tanggal lahir dan nama in-game) hanya untuk keperluan organisasi komunitas di server ini, pemberian role, dan keamanan server.

**2. Penyimpanan**
Data disimpan sesuai praktik bot ini (saat ini terutama log server jika diaktifkan). Jangan kirim data sensitif yang tidak diminta.

**3. Persyaratan perilaku**
Dengan bergabung, kamu setuju mematuhi aturan server, tidak melecehkan anggota lain, dan tidak menyalahgunakan fitur bot.

**4. Usia & akurasi**
Kamu bertanggung jawab atas kebenaran data yang kamu berikan. Tanggal lahir digunakan sesuai kebijakan server (misalnya verifikasi usia jika diwajibkan mod).

**5. Perubahan**
Admin dapat mengubah syarat atau kebijakan sewaktu-waktu. Penggunaan berkelanjutan setelah perubahan berarti kamu menerima versi terbaru.

**6. Penolakan**
Jika tidak setuju, jangan klik tombol persetujuan dan jangan lanjutkan pendaftaran.
`.trim();

export const buildTermsEmbeds = (): EmbedBuilder[] => [
  new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Kebijakan privasi & syarat server")
    .setDescription(TERMS_DESCRIPTION),
];
