import fs from 'fs';

import { BotManagerImpl, Command } from "./botManager";
import * as Config  from '../config.json';
import { ImageBot, CreateImageBot } from '../bots/imageBot';
import { ValidMessage } from './validMessage';
import { Save, ImageBotSave } from '../persistence/save';
import { SubredditCache } from '../persistence/imageBotSave';

export function CreateImageBotManager(): ImageBotManager {
	const imBot = CreateImageBot();
	return new ImageBotManager(imBot);
}

export class ImageBotManager extends BotManagerImpl<ImageBot> {
	public loadPersistentData(): boolean {
		try {
			const save: Save = JSON.parse(fs.readFileSync(this.saveLocation, 'utf8'));
			this.imBot.loadData(save.image);
			return true;
		} catch(e) {
			console.log(e);
			return false;
		}
	}
	protected savePersistentData(): void {
		ImageBotSave(
			this.imBot.saveData(),
			Config.saveFile
		);
	}
	constructor(imBot: ImageBot) {
		super('Image', Config.saveFile);
		this.imBot = imBot;
	}

	protected getBot(): ImageBot {
		return this.imBot;
	}

	protected getCommands(): Map<string, Command<ImageBot>[]> {
		return imBotCommands;
	}

	protected getPrefix(): string {
		return prefix;
	}

	private imBot: ImageBot;
}

const prefix = Config.prefix;

const imBotCommands: Map<string, Command<ImageBot>[]> = new Map<string,Command<ImageBot>[]>([
	['horse', [new Command('horse', getFromSubreddit('Horses'))]],
	['pokemon', [new Command('pokemon', getFromSubreddit('ImaginaryKanto'))]],
	['mushroom', [new Command('mushroom', getFromSubreddit('ShroomID'))]],
	['cat', [new Command('cat', getFromSubreddit('cat'))]],
	['cheese', [new Command('cheese', getFromSubreddit('cheese'))]],
	['cheetah', [new Command('cheetah', getFromSubreddit('Cheetahs'))]],
	['wall', [new Command('wall', getFromSubreddit('wall'))]],
	['awoo', [new Command('awoo', getFromSubreddit('wolves'))]],
	['teeth', [new Command('teeth', getFromLocal('teeth'))]],
	['wind', [new Command('wind', getFromLocal('yall_hear_sumn'))]],
]);

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
	}
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
				m.channel.send("Failed to post image :'(");
				return false;
			}
		}
	};
}
