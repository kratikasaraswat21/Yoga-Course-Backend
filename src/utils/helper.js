export function encodeMetadata(metadata) {
  return Object.entries(metadata)
    .map(([key, value]) => {
      const encodedValue = Buffer.from(value, "utf8").toString("base64");

      return `${key} ${encodedValue}`;
    })
    .join(",");
}
