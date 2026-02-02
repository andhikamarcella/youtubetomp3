import { v2 as cloudinary } from "cloudinary";
import admin from "firebase-admin";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return JSON.parse(raw);

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

  return null;
}

function toDocId(publicId) {
  return Buffer.from(publicId, "utf8").toString("base64url");
}

async function listCloudinaryResources({ folder, maxResults }) {
  const all = [];
  let nextCursor = undefined;

  try {
    while (true) {
      const search = cloudinary.search
        .expression(`folder:${folder}`)
        .sort_by("public_id", "asc")
        .max_results(maxResults);

      if (nextCursor) search.next_cursor(nextCursor);

      const res = await search.execute();
      const resources = Array.isArray(res?.resources) ? res.resources : [];
      all.push(...resources);

      if (!res?.next_cursor) break;
      nextCursor = res.next_cursor;
    }
  } catch (e) {
    nextCursor = undefined;
  }

  if (all.length > 0) return all;

  const prefix = folder.endsWith("/") ? folder : `${folder}/`;
  while (true) {
    const res = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix,
      max_results: maxResults,
      next_cursor: nextCursor,
    });

    const resources = Array.isArray(res?.resources) ? res.resources : [];
    all.push(...resources);

    if (!res?.next_cursor) break;
    nextCursor = res.next_cursor;
  }

  return all;
}

async function main() {
  const folder = process.env.STICKERS_FOLDER || "stickers/umum";
  const category = process.env.STICKERS_CATEGORY || "umum";
  const maxResults = Number(process.env.CLOUDINARY_PAGE_SIZE || "500");
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
  } else {
    cloudinary.config({
      cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
      api_key: requireEnv("CLOUDINARY_API_KEY"),
      api_secret: requireEnv("CLOUDINARY_API_SECRET"),
      secure: true,
    });
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64");
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  }

  const db = admin.firestore();
  const resources = await listCloudinaryResources({ folder, maxResults });

  const stickersCol = db.collection("stickers");
  let upserted = 0;

  for (const file of resources) {
    const publicId = file.public_id;
    const url = file.secure_url;
    if (!publicId || !url) continue;

    const name = publicId.split("/").pop();
    const docId = toDocId(publicId);

    const payload = {
      name,
      category,
      url,
      publicId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (dryRun) {
      upserted += 1;
      continue;
    }

    await stickersCol.doc(docId).set(payload, { merge: true });
    upserted += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        folder,
        category,
        totalFound: resources.length,
        upserted,
        dryRun,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
