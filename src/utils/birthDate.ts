/** Terima DD-MM-YYYY atau DD/MM/YYYY; return null jika tidak valid. */
export const parseBirthDate = (raw: string): string | null => {
  const s = raw.trim().replace(/\//g, "-");
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (y < 1900 || y > new Date().getFullYear()) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${String(d).padStart(2, "0")}-${String(mo).padStart(2, "0")}-${y}`;
};
