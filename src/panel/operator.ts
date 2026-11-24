/**
 * Operatör yetkisi — OPERATOR_EMAILS ortam listesi (virgülle ayrılmış).
 * Rol sütunu yok: kiracının owner kullanıcısının e-postası listede ise operatördür.
 */
export function isOperator(email: string, operatorEmailsEnv: string | undefined): boolean {
  if (!email || !operatorEmailsEnv) return false;
  const list = operatorEmailsEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}