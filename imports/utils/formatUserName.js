export const formatUserName = (value = "") =>
  String(value)
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase("it-IT")}`,
    );
