import os from 'os';
import { CreateHelpBot, HelpBot } from '../bots/helpBot';
import { Config } from '../config';
import { BotManager, BotManagerImpl } from './botManager';
import { ModGate } from './modGate';
import { Command } from './command';
import { ValidMessage } from './validMessage';

export function CreateHelpBotManager(botManagers: BotManager[], modGate: ModGate): HelpBotManager {
	const helpBot: HelpBot = CreateHelpBot();
	const helpBotManager: HelpBotManager = new HelpBotManager(helpBot, botManagers);
	modGate.registerBotManager(helpBotManager);
	helpBotManager.registerModGate(modGate);
	return helpBotManager;
}

export class HelpBotManager extends BotManagerImpl<HelpBot> {
	public loadPersistentData(): boolean {
		return true;
	}
	protected savePersistentData(): void {
		return;
	}
	constructor(helpBot: HelpBot, botManagers: BotManager[]) {
		super('Help', Config.GetSaveFilePath());
		this.helpBot = helpBot;
		this.botManagers = [this, ...botManagers];
	}

	protected getBot(message: ValidMessage): HelpBot {
		return this.helpBot;
	}

	protected getCommands(): Command<HelpBot>[] {
		const globalHelp: Command<HelpBot> = new Command(['help'], listCommands(this.botManagers, this.modGate));
		const specificHelpCommands: Command<HelpBot>[] = this.botManagers
			.map((botManager: BotManager): Command<HelpBot> => {
				return new Command(
					[`help${botManager.getBotName().toLocaleLowerCase()}`],
					listCommands([botManager], this.modGate)
				);
			});
		return [
			globalHelp,
			...specificHelpCommands
		];
	}

	protected getPrefix(): string {
		return Config.GetCommandPrefix();
	}

	private helpBot: HelpBot;
	private botManagers: BotManager[];
}

function listCommands(botManagers: BotManager[], modGate: ModGate|null): (m: ValidMessage, helpBot: HelpBot) => Promise<boolean> {
	return async (m: ValidMessage, helpBot: HelpBot) => helpBot.listCommands(botManagers, m, modGate);
}
