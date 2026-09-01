export const isProtectedPresidentAccount = (user) =>
  (user?.role || user?.profile?.role) === "Presidente";
