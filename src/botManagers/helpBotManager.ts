
import { BotManagerImpl, Command, BotManager } from "./botManager";
import * as Config  from '../config.json';
import { CreateHelpBot, HelpBot } from '../bots/helpBot';
import { ValidMessage } from "./validMessage";

export function CreateHelpBotManager(botManagers: BotManager[]): HelpBotManager {
	const helpBot = CreateHelpBot();
	return new HelpBotManager(helpBot, botManagers);
}

export class HelpBotManager extends BotManagerImpl<HelpBot> {
	public loadPersistentData(): boolean {
		return true;
	}
	protected savePersistentData(): void {
		
	}
	constructor(helpBot: HelpBot, botManagers: BotManager[]) {
		super('Help', Config.saveFile);
		this.helpBot = helpBot;
		this.botManagers = [this, ...botManagers];
		this.helpBotCommands = new Map<string,Command<HelpBot>[]>([
			['help', [new Command('help', listCommands(this.botManagers))]],
			...(this.botManagers.map(
				(b: BotManager): [string, Command<HelpBot>[]] => [`help${b.getBotName().toLocaleLowerCase()}`, [new Command(`help${b.getBotName()}`, listCommands([b]))]]
			))
		]);
	}

	protected getBot(message: ValidMessage): HelpBot {
		return this.helpBot;
	}

	protected getCommands(): Map<string, Command<HelpBot>[]> {
		return this.helpBotCommands;
	}

	protected getPrefix(): string {
		return prefix;
	}

	private helpBot: HelpBot;
	private botManagers: BotManager[];
	private helpBotCommands: Map<string, Command<HelpBot>[]>;
}

function listCommands(botManagers: BotManager[]): (m: ValidMessage, helpBot: HelpBot) => Promise<boolean> {
	return async (m: ValidMessage, helpBot: HelpBot) => helpBot.listCommands(botManagers, m.channel);
}

const prefix = Config.prefix;

