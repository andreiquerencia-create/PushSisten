/**
 * FASE 7 — Motor de Backup Lógico por Empresa (ETAPA 2)
 *
 * Exporta TODOS os dados de UMA empresa em JSON estruturado, com:
 *  - isolamento estrito por companyId (nunca toca outras empresas);
 *  - leitura PAGINADA por cursor de id (respeita o statement timeout de 5s do banco);
 *  - STREAMING direto para o S3 (memória limitada — suporta empresas grandes);
 *  - registro de metadados em BackupRecord (data, autor, contagens, tamanho).
 *
 * PRESERVAÇÃO: este motor é SOMENTE-LEITURA sobre os dados de negócio.
 * Não altera Motor Financeiro, Ledger, Auditoria, IA nem nenhuma rota existente.
 */
import { Readable, PassThrough } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { createS3Client, getBucketConfig } from './aws-config';
import { prisma } from './db';
import { BACKUP_MODELS, BACKUP_VERSION, buildWhere, BackupModelDef } from './backup-registry';

const PAGE_SIZE = 1000; // mantém cada query bem abaixo do timeout de 5s

export interface BackupResult {
  cloudStoragePath: string;
  fileSizeBytes: number;
  recordCounts: Record<string, number>;
  totalRecords: number;
  durationMs: number;
}

/** Lê uma página de um model usando cursor por id (ordem estável). */
async function fetchPage(def: BackupModelDef, where: any, cursorId: string | null): Promise<any[]> {
  const delegate = (prisma as any)[def.delegate];
  const args: any = {
    where,
    take: PAGE_SIZE,
    orderBy: { id: 'asc' },
  };
  if (cursorId) {
    args.cursor = { id: cursorId };
    args.skip = 1;
  }
  return delegate.findMany(args);
}

/**
 * Gera o backup de uma empresa e envia para o S3 via streaming.
 * Retorna metadados (sem carregar o JSON inteiro em memória).
 */
export async function exportCompanyBackup(params: {
  companyId: string;
  companyName: string;
  cloudStoragePath: string;
  createdById?: string | null;
  createdByName?: string | null;
  appCheckpoint?: string | null;
}): Promise<BackupResult> {
  const { companyId, companyName, cloudStoragePath } = params;
  const startedAt = Date.now();
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;
  let fileSizeBytes = 0;

  const { bucketName } = getBucketConfig();
  const s3 = createS3Client();

  // Stream de saída: vamos empurrar o JSON em pedaços à medida que paginamos.
  const pass = new PassThrough();

  // mede o tamanho total trafegado
  pass.on('data', (chunk: Buffer) => { fileSizeBytes += chunk.length; });

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucketName,
      Key: cloudStoragePath,
      Body: pass as unknown as Readable,
      ContentType: 'application/json',
      ContentDisposition: 'attachment',
    },
  });

  const uploadPromise = upload.done();

  const write = (s: string) => new Promise<void>((resolve, reject) => {
    pass.write(s, (err) => (err ? reject(err) : resolve()));
  });

  try {
    // Cabeçalho do envelope
    const header = {
      version: BACKUP_VERSION,
      companyId,
      companyName,
      createdAt: new Date().toISOString(),
      createdBy: params.createdByName ?? null,
      appCheckpoint: params.appCheckpoint ?? null,
    };
    await write('{\n');
    await write('"version":' + JSON.stringify(header.version) + ',\n');
    await write('"companyId":' + JSON.stringify(header.companyId) + ',\n');
    await write('"companyName":' + JSON.stringify(header.companyName) + ',\n');
    await write('"createdAt":' + JSON.stringify(header.createdAt) + ',\n');
    await write('"createdBy":' + JSON.stringify(header.createdBy) + ',\n');
    await write('"appCheckpoint":' + JSON.stringify(header.appCheckpoint) + ',\n');
    await write('"datasets":{\n');

    // Percorre cada model em ordem topológica, paginando e fazendo stream.
    for (let m = 0; m < BACKUP_MODELS.length; m++) {
      const def = BACKUP_MODELS[m];
      const where = buildWhere(def, companyId);
      await write(JSON.stringify(def.key) + ':[');

      let count = 0;
      let cursorId: string | null = null;
      let first = true;

      if (def.scope === 'root') {
        const rows = await (prisma as any)[def.delegate].findMany({ where });
        for (const row of rows) {
          await write((first ? '' : ',') + JSON.stringify(row));
          first = false; count++;
        }
      } else {
        // paginação por cursor
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const page: any[] = await fetchPage(def, where, cursorId);
          if (page.length === 0) break;
          for (const row of page) {
            await write((first ? '' : ',') + JSON.stringify(row));
            first = false; count++;
          }
          cursorId = page[page.length - 1].id;
          if (page.length < PAGE_SIZE) break;
        }
      }

      recordCounts[def.key] = count;
      totalRecords += count;
      const isLast = m === BACKUP_MODELS.length - 1;
      await write(']' + (isLast ? '\n' : ',\n'));
    }

    // metadata final (contagens) + fecho
    await write('},\n');
    await write('"metadata":' + JSON.stringify({ recordCounts, totalRecords }) + '\n');
    await write('}\n');

    pass.end();
    await uploadPromise;
  } catch (err) {
    pass.destroy();
    try { await upload.abort(); } catch { /* ignore */ }
    throw err;
  }

  return {
    cloudStoragePath,
    fileSizeBytes,
    recordCounts,
    totalRecords,
    durationMs: Date.now() - startedAt,
  };
}

/** Caminho canônico do backup no S3. */
export function buildBackupKey(companyId: string, backupId: string): string {
  const { folderPrefix } = getBucketConfig();
  return `${folderPrefix}backups/${companyId}/${backupId}.json`;
}
