export const getCasRoleMarker = (user) =>
  user?.role === "Presidente" ? "P" : user?.isSecretary ? "S" : "";

export const formatCasUserLabel = (user) => {
  const marker = getCasRoleMarker(user);
  return `${marker ? `${marker} - ` : ""}${user?.username || ""}`;
};

export const CasRoleBadge = ({ user }) => {
  const marker = getCasRoleMarker(user);
  if (!marker) return null;
  const label = marker === "P" ? "Presidente" : "Segretario";
  return <span className="cas-role-badge" aria-label={label} title={label}>{marker}</span>;
};
