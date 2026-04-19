import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SocialSignalService } from './social-signal.service';

@Module({
  imports: [ConfigModule],
  providers: [SocialSignalService],
  exports: [SocialSignalService],
})
export class SocialSignalModule {}
