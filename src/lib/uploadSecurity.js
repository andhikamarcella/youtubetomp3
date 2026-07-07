const MAX_DIMENSION = 4096;

const parseDataUri = (value = "") => {
  const match = String(value).match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64") };
};

const readPngDimensions = (buffer) => {
  if (buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const readJpegDimensions = (buffer) => {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
};

const readWebpDimensions = (buffer) => {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = buffer.toString("ascii", 12, 16);
  if (type === "VP8X" && buffer.length >= 30) {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  return { width: 0, height: 0 };
};

export const inspectImageDataUri = (value, { maxBytes = 5 * 1024 * 1024, maxDimension = MAX_DIMENSION } = {}) => {
  const parsed = parseDataUri(value);
  if (!parsed) return { ok: false, error: "invalid_data_uri" };
  const { mime, buffer } = parsed;
  if (!buffer.length || buffer.length > maxBytes) return { ok: false, error: "image_too_large" };
  let detected = "";
  let dimensions = null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    detected = "image/png";
    dimensions = readPngDimensions(buffer);
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detected = "image/jpeg";
    dimensions = readJpegDimensions(buffer);
  } else if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    detected = "image/webp";
    dimensions = readWebpDimensions(buffer);
  } else {
    return { ok: false, error: "unsupported_image_type" };
  }
  if (mime !== detected) return { ok: false, error: "mime_mismatch" };
  if (dimensions && dimensions.width && dimensions.height && (dimensions.width > maxDimension || dimensions.height > maxDimension)) {
    return { ok: false, error: "image_dimensions_too_large" };
  }
  return { ok: true, mime: detected, bytes: buffer.length, width: dimensions?.width || null, height: dimensions?.height || null };
};
