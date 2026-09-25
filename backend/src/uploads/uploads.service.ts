import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadsService {
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
      maxUploadBytes: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    };
  }
}
