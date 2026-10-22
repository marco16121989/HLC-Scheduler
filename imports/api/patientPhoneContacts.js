export const removesPatientPhoneNumber = (details = {}, changes = {}) => {
  if (["patientPhone", "elderPhone"].some(key => changes[key] !== undefined && String(details[key] || "").trim() && !String(changes[key]).trim())) return true;
  if (!Array.isArray(changes.phoneContacts)) return false;
  const key = contact => contact.id || JSON.stringify([contact.name, contact.phone]);
  const retained = new Set(changes.phoneContacts.map(key));
  return (Array.isArray(details.phoneContacts) ? details.phoneContacts : []).some(contact => !retained.has(key(contact)));
};

export const preparePatientPhoneContacts = (value) => {
  const contacts = (Array.isArray(value) ? value : []).map(contact => ({
    id: String(contact?.id || ""),
    name: String(contact?.name || "").trim(),
    phone: String(contact?.phone || "").trim(),
  })).filter(contact => contact.name || contact.phone);
  return { contacts, valid: contacts.every(contact => contact.name && contact.phone) };
};
