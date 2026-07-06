import { promises as fs } from "node:fs";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { Readable } from "node:stream";

// Storage abstraksiyasi — local yoki r2. Kalitlar berilmagan bo'lsa `local`.

export type StoragePathKind = "public" | "private";

export interface StorageProvider {
  driver: "local" | "r2";
  putBuffer(kind: StoragePathKind, key: string, body: Buffer, contentType: string): Promise<void>;
  getBuffer(kind: StoragePathKind, key: string): Promise<Buffer>;
  getStream(kind: StoragePathKind, key: string): Promise<{ stream: Readable; size: number }>;
  delete(kind: StoragePathKind, key: string): Promise<void>;
  publicUrl(key: string): string;
  signedUrl(kind: StoragePathKind, key: string, ttlSeconds: number, downloadName?: string): Promise<string | null>;
}

class LocalStorage implements StorageProvider {
  driver = "local" as const;
  private root = path.join(process.cwd(), "storage");

  // Path traversal himoyasi — chuqurroq qatlam. `path.resolve` orqali absolute
  // yo'l qurib, uni root prefix bilan solishtiramiz. Prefiksdan chiqib ketgan
  // har qanday kalit rad etiladi (fs so'rov qilinmaydi).
  private full(kind: StoragePathKind, key: string) {
    const kindRoot = path.join(this.root, kind);
    // Null byte va Windows drive letter'ga qarshi
    if (key.includes("\0") || /^[A-Za-z]:[\\/]/.test(key)) {
      throw new Error("invalid_key");
    }
    const abs = path.resolve(kindRoot, key);
    const safePrefix = kindRoot.endsWith(path.sep) ? kindRoot : kindRoot + path.sep;
    if (abs !== kindRoot && !abs.startsWith(safePrefix)) {
      throw new Error("path_traversal_denied");
    }
    return abs;
  }

  async putBuffer(kind: StoragePathKind, key: string, body: Buffer) {
    const p = this.full(kind, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  async getBuffer(kind: StoragePathKind, key: string) {
    return fs.readFile(this.full(kind, key));
  }

  async getStream(kind: StoragePathKind, key: string) {
    const p = this.full(kind, key);
    const stat = await fs.stat(p);
    return { stream: createReadStream(p), size: stat.size };
  }

  async delete(kind: StoragePathKind, key: string) {
    const p = this.full(kind, key);
    if (existsSync(p)) await fs.unlink(p).catch(() => {});
  }

  publicUrl(key: string) {
    return `/api/storage/public/${key}`;
  }

  async signedUrl() {
    return null;
  }
}

class R2Storage implements StorageProvider {
  driver = "r2" as const;
  private privateBucket: string;
  private publicBucket: string;
  private publicCdn: string;

  constructor() {
    this.privateBucket = process.env.R2_BUCKET_PRIVATE!;
    this.publicBucket = process.env.R2_BUCKET_PUBLIC!;
    this.publicCdn = process.env.R2_PUBLIC_CDN_URL!;
  }

  private async client() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  private bucket(kind: StoragePathKind) {
    return kind === "public" ? this.publicBucket : this.privateBucket;
  }

  async putBuffer(kind: StoragePathKind, key: string, body: Buffer, contentType: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(kind),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getBuffer(kind: StoragePathKind, key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket(kind), Key: key }));
    const arr = await res.Body!.transformToByteArray();
    return Buffer.from(arr);
  }

  async getStream(kind: StoragePathKind, key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket(kind), Key: key }));
    const stream = res.Body as unknown as Readable;
    return { stream, size: Number(res.ContentLength ?? 0) };
  }

  async delete(kind: StoragePathKind, key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket(kind), Key: key }));
  }

  publicUrl(key: string) {
    return `${this.publicCdn.replace(/\/$/, "")}/${key}`;
  }

  async signedUrl(kind: StoragePathKind, key: string, ttlSeconds: number, downloadName?: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: this.bucket(kind),
        Key: key,
        ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName}"` : undefined,
      }),
      { expiresIn: ttlSeconds },
    );
  }
}

let cached: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "r2" && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
    cached = new R2Storage();
  } else {
    cached = new LocalStorage();
  }
  return cached;
}
