import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { MyHttpService } from '../../../common/utils-service/http.service';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { MysteryBoxEntity } from '../../../database/entities/mystery-boxs.entity';
import { GrabMysteryBoxEntity } from '../../../database/entities/grab-mystery-boxs.entity';
import Decimal from 'decimal.js';
import { MysteryBoxDbService } from '../mystery-boxs.service';
import { BlinkShortCode } from '../../../common/interface/bot.response';
import { encodeBase58, lamportsToSol, shortenAddress } from '../../../common/utils/tools';

@Injectable()
export class BotNotifyService {
    constructor(private readonly logger: AppLoggerService, private readonly myHttpService: MyHttpService, private readonly appConfig: AppConfigService, private readonly mysteryBoxDbService: MysteryBoxDbService) {
        this.logger.setContext(BotNotifyService.name);
    }
    async getBlinkShortCode(entities: MysteryBoxEntity[]): Promise<BlinkShortCode[]> {
            const blinks = entities.map((entity) => ({
                blink: `${this.appConfig.actionInfo.hostname}/box/actions/open/${entity.id}`,
                id: entity.id,
            }));
            let domain = new URL(this.appConfig.actionInfo.hostname).host;
            let body = { blinks, domain };
            let url = `${this.appConfig.actionInfo.botService}/solagram/api/v1/blink/shortcode/query`;
            let data = await this.myHttpService.httpPost(url, body);
            return data ? data.data : null;
        }
    async sendBotNotifyApi(address: string, message: string): Promise<void> {
            let source = new URL(this.appConfig.actionInfo.hostname).host;
            let url = `${this.appConfig.actionInfo.botService}/solagram/api/v1/bot/notify`;
            let body = {
                source,
                address,
                message,
            };
            await this.myHttpService.httpPost(url, body);
        }
    async getDirectLink(mysteryBox: MysteryBoxEntity): Promise<string> {
            let blinkShortCodes = await this.getBlinkShortCode([mysteryBox]);
            let directLink = null;
            if (blinkShortCodes.length > 0) {
                let base58Str = encodeBase58(JSON.stringify({ short_code: blinkShortCodes[0].shortCode }));
                directLink = `${this.appConfig.actionInfo.blinkWindowDirectLink}?startapp=${base58Str}`;
            }
            return directLink;
        }
    getCreateDirectLink() {
            return `${this.appConfig.actionInfo.blinkWindowDirectLink}?startapp=${this.appConfig.actionInfo.crateBlinkParameter}`;
        }
    createBoxMessage(distribute: any) {
            return distribute
                ? `Create a [Bomb Box](${this.getCreateDirectLink()})🎁\n\n---------------\n🌐 [Website](${this.appConfig.actionInfo.hostname}) · 📜 [Rules](${this.appConfig.actionInfo.hostname}/rule)`
                : `---------------\nCreate a [Bomb Box](${this.getCreateDirectLink()})🎁\n🌐 [Website](${this.appConfig.actionInfo.hostname}) · 📜 [Rules](${this.appConfig.actionInfo.hostname}/rule)`;
        }
    async createBoxSuccessNotify(mysteryBox: MysteryBoxEntity): Promise<void> {
            let address = shortenAddress(mysteryBox.senderAddress);
            const amount = lamportsToSol(mysteryBox.amount);
            let directLink = await this.getDirectLink(mysteryBox);
            let message = `📣 *[Bomb Fun Calling] ${address} created a bomb box with ${amount} SOL.* 📣\n🐶 Guess who is the lucky dog today?\n🤡 Open the box and you will know!\n👉 [Open now](${directLink})\n\n${this.createBoxMessage(false)}`;
            await this.sendBotNotifyApi(mysteryBox.senderAddress, message);
        }
    async grabBoxSuccessNotify(grabMysteryBox: GrabMysteryBoxEntity, mysteryBox: MysteryBoxEntity): Promise<void> {
            let directLink = await this.getDirectLink(mysteryBox);
            let message = `🎲 *Congrats! You are in the game* 🎲\n\n🙏 All we have to do is wait and pray.\n[Check details](${directLink})\n\n ${this.createBoxMessage(false)}`;
            await this.sendBotNotifyApi(grabMysteryBox.senderAddress, message);
        }
    async distributeSuccessNotify(id: number): Promise<void> {
            const mysteryBox = await this.mysteryBoxDbService.findOne({ id } as any, { grabMysteryBoxs: true });
            if (!mysteryBox) {
                this.logger.warn(`[distributeSuccessNotify] mysteryBox not find by id ${id}`);
                return;
            }
            let directLink = await this.getDirectLink(mysteryBox);
            let bounty = lamportsToSol(Number(mysteryBox.lotteryDrawAmount) - Number(mysteryBox.amount));
            const loseAmount = lamportsToSol(mysteryBox.amount).mul(new Decimal(1.8));
            let creatorMessage;
            if (bounty.greaterThan(new Decimal(0))) {
                creatorMessage = this.creatorVictoryMessage(bounty, directLink);
            }
            else {
                creatorMessage = this.creatorFailedMessage(bounty, directLink);
            }
            await Promise.all(mysteryBox.grabMysteryBoxs.map(async (grab) => {
                let message;
                if (grab.isBomb) {
                    message = this.participantBombedMessage(directLink, loseAmount);
                }
                else if (Number(grab.lotteryDrawAmount) > 0) {
                    message = this.participantNotBombedMessge(directLink, lamportsToSol(grab.lotteryDrawAmount));
                }
                else {
                    message = this.participantRefundMessage();
                }
                await this.sendBotNotifyApi(grab.senderAddress, message);
            }));
            await this.sendBotNotifyApi(mysteryBox.senderAddress, creatorMessage);
        }
    creatorVictoryMessage(bounty: Decimal, directLink: string): string {
            let message = `💥 *Congrats! You win the game, bomber!* 💥\n\nYou won ${bounty.toFixed(3)} SOL in this game.\n[Check details](${directLink})\n\nWanna play the next round? 😈\n${this.createBoxMessage(true)}`;
            return message;
        }
    creatorFailedMessage(bounty: Decimal, directLink: string): string {
            let message = `💣 *Too bad! You lose the game, bomber!* 💣\n\nYou lose ${bounty.abs().toFixed(3)} SOL in this game\n[Check details](${directLink})\n\nWanna play the next round? 😈\n${this.createBoxMessage(true)}`;
            return message;
        }
    participantBombedMessage(directLink: string, amount: Decimal): string {
            let message = `🤡 *So sad! You got bombed ! That’s 1 out of 10 odds. Who can say that you are not lucky?* 🤡\n\nYou lose ${amount.abs().toFixed(3)} SOL in this game.\n[Check details](${directLink})\n\nWanna play the next round? 😈\n${this.createBoxMessage(true)}`;
            return message;
        }
    participantNotBombedMessge(directLink: string, amount: Decimal): string {
            let message = `🍀 *Congrats! You escaped from the bomb! Lucky dog, huh?* 🍀\n\nYou won ${amount.toFixed(3)} SOL in this game.\n[Check details](${directLink})\n\nWanna play the next round? 😈\n${this.createBoxMessage(true)}`;
            return message;
        }
    participantRefundMessage(): string {
            let message = `😭 *Too bad, the box hasn’t been opened by 6 people within the time limits.* 😭.\n\nDeposit has been refunded.\n\nLet’s play the next round or create your own box.\n${this.createBoxMessage(true)}`;
            return message;
        }
}
