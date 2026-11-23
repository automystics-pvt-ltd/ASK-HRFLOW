import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandingDir = path.join(__dirname, '..', '..', 'uploads', 'branding');
fs.mkdirSync(brandingDir, { recursive: true });

const upload = multer({
  dest: brandingDir,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/i.test(file.mimetype)) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

const DEFAULT_COMPANY = {
  name: 'Automystics',
  legalName: 'Automystics Technologies Private Limited',
  address: '',
  phone: '',
  email: '',
  website: '',
};

const DEFAULT_THEME = {
  primary: '#0b57f0',
  secondary: '#0a2a7a',
  accent: '#1d6bff',
  mode: 'system' as 'system' | 'light' | 'dark',
  /** Display height in rem for uploaded logos (sidebar/login/docs). Width scales with aspect ratio. */
  logoSize: 'md' as 'sm' | 'md' | 'lg' | 'xl',
};

const LOGO_SIZES = new Set(['sm', 'md', 'lg', 'xl']);

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // mysql2 may already decode JSON columns to a plain string (e.g. logo path)
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        return fallback;
      }
    }
    return trimmed as T;
  }
  return fallback;
}

async function getSetting(key: string): Promise<unknown> {
  const row = await queryOne<{ value: unknown }>(
    'SELECT value FROM organization_settings WHERE tenant_id = $1 AND `key` = $2',
    [DEFAULT_TENANT, key],
  );
  return row?.value ?? null;
}

async function setSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO organization_settings (tenant_id, \`key\`, value) VALUES ($1,$2,$3)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [DEFAULT_TENANT, key, JSON.stringify(value)],
  );
}

function resolveLogoAbs(logoPath: string) {
  return path.isAbsolute(logoPath)
    ? logoPath
    : path.join(__dirname, '..', '..', 'uploads', logoPath.replace(/^uploads[/\\]/, ''));
}

async function brandingPayload() {
  const company = { ...DEFAULT_COMPANY, ...parseJson(await getSetting('company'), {}) };
  const theme = { ...DEFAULT_THEME, ...parseJson(await getSetting('theme'), {}) };
  const logoPath = parseJson<string | null>(await getSetting('logoPath'), null);
  const logoUrl =
    logoPath && fs.existsSync(resolveLogoAbs(logoPath)) ? '/api/branding/logo-file' : null;
  return { company, theme, logoUrl };
}

/** Public + authenticated branding for CSS vars / logo */
router.get('/', async (_req, res) => {
  res.json(await brandingPayload());
});

router.put('/company', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const body = req.body || {};
  const current = parseJson(await getSetting('company'), DEFAULT_COMPANY);
  const next = {
    ...DEFAULT_COMPANY,
    ...current,
    name: body.name ?? current.name ?? DEFAULT_COMPANY.name,
    legalName: body.legalName ?? current.legalName ?? DEFAULT_COMPANY.legalName,
    address: body.address ?? current.address ?? '',
    phone: body.phone ?? current.phone ?? '',
    email: body.email ?? current.email ?? '',
    website: body.website ?? current.website ?? '',
  };
  await setSetting('company', next);
  res.json({ company: next });
});

router.put('/theme', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const body = req.body || {};
  const current = parseJson(await getSetting('theme'), DEFAULT_THEME) as typeof DEFAULT_THEME;
  const mode = body.mode === 'light' || body.mode === 'dark' || body.mode === 'system' ? body.mode : current.mode;
  const logoSizeRaw = String(body.logoSize ?? current.logoSize ?? DEFAULT_THEME.logoSize);
  const logoSize = LOGO_SIZES.has(logoSizeRaw) ? (logoSizeRaw as typeof DEFAULT_THEME.logoSize) : DEFAULT_THEME.logoSize;
  const next = {
    primary: String(body.primary ?? current.primary ?? DEFAULT_THEME.primary),
    secondary: String(body.secondary ?? current.secondary ?? DEFAULT_THEME.secondary),
    accent: String(body.accent ?? current.accent ?? DEFAULT_THEME.accent),
    mode,
    logoSize,
  };
  await setSetting('theme', next);
  res.json({ theme: next });
});

router.post(
  '/logo',
  requireAuth,
  requirePermission('settings', 'update'),
  upload.single('logo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `${uuid().slice(0, 12)}${ext}`;
    const dest = path.join(brandingDir, filename);
    fs.renameSync(req.file.path, dest);

    const prev = parseJson<string | null>(await getSetting('logoPath'), null);
    if (prev) {
      const abs = path.isAbsolute(prev) ? prev : path.join(brandingDir, path.basename(prev));
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch {
          /* ignore */
        }
      }
    }
    const relative = path.join('branding', filename);
    await setSetting('logoPath', relative);
    res.status(201).json({ logoUrl: '/api/branding/logo-file' });
  },
);

router.delete('/logo', requireAuth, requirePermission('settings', 'update'), async (_req, res) => {
  const prev = parseJson<string | null>(await getSetting('logoPath'), null);
  if (prev) {
    const abs = path.isAbsolute(prev) ? prev : path.join(brandingDir, path.basename(prev));
    if (fs.existsSync(abs)) {
      try {
        fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
  }
  await setSetting('logoPath', null);
  res.json({ ok: true, logoUrl: null });
});

router.get('/logo-file', async (_req, res) => {
  const logoPath = parseJson<string | null>(await getSetting('logoPath'), null);
  if (!logoPath) return res.status(404).json({ error: 'No logo' });
  const abs = resolveLogoAbs(logoPath);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Logo file missing' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(abs);
});

export default router;
