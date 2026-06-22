const PW_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function genPassword(): string {
  let pw = "";
  while (pw.length < 8) pw += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
  return pw;
}

export function uniqueUsername(base: string, taken: Set<string>): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  if (!taken.has(clean)) { taken.add(clean); return clean; }
  let n = 2;
  while (taken.has(`${clean}${n}`)) n++;
  const un = `${clean}${n}`;
  taken.add(un);
  return un;
}
