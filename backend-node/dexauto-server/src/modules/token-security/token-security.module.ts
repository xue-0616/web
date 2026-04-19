import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenSecurityService } from './token-security.service';

@Module({
  imports: [ConfigModule],
  providers: [TokenSecurityService],
  exports: [TokenSecurityService],
})
export class TokenSecurityModule {}
