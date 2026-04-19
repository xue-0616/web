import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SystemModule } from '../system/system.module';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';

@Module({
  imports: [JwtModule.register({}), SystemModule],
  controllers: [LoginController],
  providers: [LoginService],
  exports: [LoginService],
})
export class LoginModule {}
