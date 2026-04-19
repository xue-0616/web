import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { customAlphabet, nanoid } from 'nanoid';
const CryptoJS = require('crypto-js');

@Injectable()
export class UtilService {
  constructor(private readonly httpService: HttpService) {}

  getReqIP(req: FastifyRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? req.socket.remoteAddress ?? '';
    return String(raw).replace('::ffff:', '');
  }

  isLAN(ip: string): boolean {
    const normalized = ip.toLowerCase();
    if (normalized === 'localhost') {
      return true;
    }
    if (!normalized) {
      return false;
    }
    const parts = normalized.split('.');
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(Number(part)))) {
      return false;
    }
    let value = 0;
    value += Number(parts[0]) << 24;
    value += Number(parts[1]) << 16;
    value += Number(parts[2]) << 8;
    value += Number(parts[3]);
    value = (value >> 16) & 0xffff;
    return value >> 8 === 0x7f || value >> 8 === 0x0a || value === 0xc0a8 || (value >= 0xac10 && value <= 0xac1f);
  }

  async getLocation(ip: string): Promise<string> {
    if (this.isLAN(ip)) {
      return '内网IP';
    }
    let { data } = await this.httpService.axiosRef.get(
      `http://whois.pconline.com.cn/ipJson.jsp?ip=${ip}&json=true`,
      { responseType: 'arraybuffer' },
    );
    data = new TextDecoder('gbk').decode(data);
    const parsed = JSON.parse(data);
    return parsed.addr.trim().split(' ').at(0) ?? '';
  }

  aesEncrypt(msg: string, secret: string): string {
    return CryptoJS.AES.encrypt(msg, secret).toString();
  }

  aesDecrypt(encrypted: string, secret: string): string {
    return CryptoJS.AES.decrypt(encrypted, secret).toString(CryptoJS.enc.Utf8);
  }

  md5(msg: string): string {
    return CryptoJS.MD5(msg).toString();
  }

  generateUUID(): string {
    return nanoid();
  }

  generateRandomValue(length: number, placeholder = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM'): string {
    const customNanoid = customAlphabet(placeholder, length);
    return customNanoid();
  }
}
