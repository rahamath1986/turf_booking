import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly configService: ConfigService) {}

  getStorageConfig() {
    return {
      provider: 'AzureBlobStorage',
      container: this.configService.get<string>(
        'azure.blobContainerName',
        'turf-media-uploads',
      ),
      resourceGroup: this.configService.get<string>(
        'azure.resourceGroup',
        'rg-sansamg-platform',
      ),
      maxUploadBytes: MAX_UPLOAD_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    };
  }

  /**
   * Uploads a turf image buffer to Azure Blob Storage and returns its public URL.
   * Requires AZURE_BLOB_STORAGE_CONNECTION_STRING to be configured.
   */
  async uploadTurfImage(
    buffer: Buffer,
    mimetype: string,
    originalName: string,
    size: number,
  ): Promise<string> {
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
    if (size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds the 10MB size limit');
    }

    const connectionString = this.configService.get<string>(
      'azure.blobConnectionString',
      '',
    );
    if (!connectionString) {
      throw new ServiceUnavailableException(
        'Image storage is not configured on the server',
      );
    }

    const { BlobServiceClient } = await import('@azure/storage-blob');
    const containerName = this.configService.get<string>(
      'azure.blobContainerName',
      'turf-media-uploads',
    );

    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const container = blobService.getContainerClient(containerName);
    await container.createIfNotExists();
    try {
      // Public read access so returned URLs are directly usable as <img> URLs.
      // Requires "Allow Blob public access" on the storage account; if the
      // policy forbids it, uploads still succeed but URLs need that toggle.
      await container.setAccessPolicy('blob');
    } catch (err) {
      this.logger.warn(
        `Could not enable public blob access on container "${containerName}": ${(err as Error)?.message}`,
      );
    }

    const ext = (originalName.split('.').pop() || 'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 5);
    const blobName = `turfs/${Date.now()}-${randomBytes(8).toString('hex')}.${ext || 'jpg'}`;
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimetype },
    });

    return blockBlob.url;
  }
}
