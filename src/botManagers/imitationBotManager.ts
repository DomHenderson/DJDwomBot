import * as Discord from 'discord.js';
import * as Config from '../config.json';
import { BotManagerImpl, InitialiseBotManager } from './botManager';
import { ValidMessage } from './validMessage';
import { Command } from './command';
import { ImitationBot } from '../bots/imitationBot';
import { ModGate } from './modGate';

export function CreateImitationBotManager(modGate: ModGate): ImitationBotManager {
	const imitationBotManager: ImitationBotManager = new ImitationBotManager();
	InitialiseBotManager(imitationBotManager, modGate);
	return imitationBotManager;
}

export class ImitationBotManager extends BotManagerImpl<ImitationBot> {
	loadPersistentData(): boolean {
		// try {
		// 	const save: Save = JSON.parse(fs.readFileSync(this.saveLocation, 'utf8'));
		// 	save.DJ.guildDJs.map((guildDJRecord: GuildSaveData<GuildDJSaveData>): void => {
		// 		this.getOrCreateDJ(guildDJRecord.guildId).loadData(guildDJRecord.data);
		// 	});
		// 	return true;
		// } catch(e) {
		// 	console.log(e);
		// 	return false;
        // }
        return true;
	}
	savePersistentData(): void {
		// DJSave(
		// 	new DJSaveData(
		// 		[...this.djMap.entries()].map(([guildId, dj]: [string, DJ]) => {
		// 			console.log(`saving ${guildId}`);
		// 			return new GuildSaveData<GuildDJSaveData>(
		// 				guildId,
		// 				dj.saveData()
		// 			);
		// 		})
		// 	)
		// );
	}
	constructor() {
        super('Imitation', Config.saveFile);
		this.bot = new ImitationBot([]);
	}

	registerGuilds(guilds: Discord.GuildManager): void {
		console.log(`Guild count: ${guilds.cache.size}`);
		this.bot = new ImitationBot([...guilds.cache.values()])
	}

	protected getBot(message: ValidMessage): ImitationBot {
		return this.bot;
	}

	protected getCommands(): Command<ImitationBot>[] {
		return this.commands;;
	}

	protected getPrefix(): string {
		return Config.prefix;
	}

    private bot: ImitationBot;
    private commands: Command<ImitationBot>[] = [
        new Command(['imitate'], imitate)
    ];
}

async function imitate(message: ValidMessage, bot: ImitationBot): Promise<boolean> {
	const generatedMessage: string = await bot.imitate(message.author.user);
	message.channel.send(`My impressions of ${message.author.user.toString()}:\n${generatedMessage}`);
	return true;
}