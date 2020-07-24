import fs from 'fs';
import { CreateImageBot, ImageBot } from '../bots/imageBot';
import * as Config from '../config.json';
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
		super('Image', Config.saveFile);
		this.imBot = CreateImageBot();
	}

	protected getBot(): ImageBot {
		return this.imBot;
	}

	protected getCommands(): Command<ImageBot>[] {
		return imBotCommands;
	}

	protected getPrefix(): string {
		return prefix;
	}

	private imBot: ImageBot;
}

const prefix = Config.prefix;

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
	new Command(['wind'], getFromLocal('yall_hear_sumn')),
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
