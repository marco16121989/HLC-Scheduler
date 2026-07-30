export const normalizeDepartment = (department) =>
  typeof department === "string"
    ? { id: crypto.randomUUID(), name: department, head: "" }
    : {
        id: department.id || crypto.randomUUID(),
        name: department.name || "",
        head: department.head || "",
      };

export const normalizeHospital = (hospital) => {
  const { casAssignments: _legacyAssignments, ...hospitalData } = hospital;

  return {
    ...hospitalData,
    director: hospital.director || "",
    departments: Array.isArray(hospital.departments)
      ? hospital.departments.map(normalizeDepartment)
      : [],
  };
};
