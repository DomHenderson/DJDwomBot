import moment from 'moment';
import fs from 'fs';
import * as Discord from 'discord.js';
import { CreateImageBot, ImageBot } from '../bots/imageBot';
import { Config } from '../config';
import { ImageBotSave, Save } from '../persistence/save';
import { BotManagerImpl, InitialiseBotManager } from './botManager';
import { ModGate } from './modGate';
import { Command } from './command';
import { ValidMessage } from './validMessage';


export function CreateImageBotManager(modGate: ModGate): ImageBotManager {
	const imageBotManager: ImageBotManager = new ImageBotManager();
	InitialiseBotManager(imageBotManager, modGate);
	return imageBotManager;
}

export class ImageBotManager extends BotManagerImpl<ImageBot> {
	public loadPersistentData(): boolean {
		try {
			const save: Save = JSON.parse(fs.readFileSync(this.saveLocation, 'utf8'));
			console.log(save);
			this.imBot.loadData(save.Image);
			return true;
		} catch(e) {
			console.log(e);
			return false;
		}
	}
	protected savePersistentData(): void {
		ImageBotSave(this.imBot.saveData());
	}
	constructor() {
		super('Image', '📷', Config.GetSaveFilePath());
		this.imBot = CreateImageBot();
	}

	protected getBot(): ImageBot {
		return this.imBot;
	}

	protected getCommands(): Command<ImageBot>[] {
		return imBotCommands;
	}

	protected getPrefix(): string {
		return Config.GetCommandPrefix();
	}

	private imBot: ImageBot;
}

const imBotCommands: Command<ImageBot>[] = [
	new Command(['horse'], getFromSubreddit('Horses')),
	new Command(['pokemon'], getFromSubreddit('ImaginaryKanto')),
	new Command(['mushroom'], getFromSubreddit('ShroomID')),
	new Command(['cat'], getFromSubreddit('cat')),
	new Command(['cheese'], getFromSubreddit('cheese')),
	new Command(['cheetah'], getFromSubreddit('Cheetahs')),
	new Command(['wall'], getFromSubreddit('wall')),
	new Command(['awoo'], getFromSubreddit('wolves')),
	new Command(['teeth'], getFromLocal('teeth')),
	new Command(['sadteeth'], getFromLocal('sadteeth')),
	new Command(['wind'], getFromLocal('yall_hear_sumn')),
	new Command(['sir'], getFromLocal('sir')),
	new Command(['registerselfcarechannel'], registerChannel('selfCare')),
	new Command(['selfcare'], getFromPins('selfCare')),
	new Command(['gencon'], gencon)
];

function getFromLocal(imageName: string): (m: ValidMessage, imBot: ImageBot) => Promise<boolean> {
	return async (m: ValidMessage, imBot: ImageBot) => {
		const image: string|null = await imBot.getFromLocal(imageName);
		if(image === null) {
			m.channel.send(`Unable to find ${imageName}`);
			return false;
		} else {
			m.channel.send('', {files: [image]});
			return true;
		}
	};
}

function getFromSubreddit(subredditName: string): (m: ValidMessage, imBot: ImageBot) => Promise<boolean> {
	return async (m: ValidMessage, imBot: ImageBot) => {
		const image: string|null = await imBot.getFromSubreddit(subredditName);
		if (image === null) {
			m.channel.send('Unable to find image');
			return false;
		} else {
			try {
				await m.channel.send('', {files: [image]});
				return true;
			} catch(e) {
				m.channel.send('Failed to post image :\'(');
				return false;
			}
		}
	};
}

function registerChannel(channelName: string): (m: ValidMessage, imBot: ImageBot) => Promise<boolean> {
	return async (m: ValidMessage, imBot: ImageBot) => {
		const channelID = m.channel.id;
		imBot.registerChannel(channelID, channelName);
		return true;
	}
}

function getFromPins(channelName: string): (m: ValidMessage, imBot: ImageBot) => Promise<boolean> {
	return async (m: ValidMessage, imBot: ImageBot) => {
		const mentions = [...m.mentions.users.values()];
		const user = (mentions.length === 0) ? null : mentions[0];
		const message: Discord.Message|null = await imBot.getFromPins(channelName, m.channel.client);
		if(message === null) {
			m.channel.send(`Unable to retrieve from ${channelName}`);
			return false;
		} else {
			m.channel.send(`${message.content} ${(user === null) ? '' : user.toString()}`, [...message.attachments.values()]);
			return true;
		}
	};
}

async function gencon(message: ValidMessage, imageBot: ImageBot): Promise<boolean> {
	const now = moment().valueOf();
	const then = moment('2021-8-5').valueOf();
	const actualDays = (then-now)/(1000*60*60*24);
	const days = Math.floor(actualDays);
	const actualHours = (actualDays-days)*24;
	const hours = Math.floor(actualHours);
	const actualMinutes = (actualHours-hours)*60;
	const minutes = Math.floor(actualMinutes);
	const actualSeconds = (actualMinutes-minutes)*60;
	const seconds = Math.floor(actualSeconds);

	message.channel.send(`GenCon day is ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds from now`);
	return true;
}