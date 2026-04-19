export class ImageCaptchaDto {
    width = 100;
    height = 50;
}

export class LoginInfoDto {
    username!: string;
    password!: string;
    captchaId!: string;
    verifyCode!: string;
}
