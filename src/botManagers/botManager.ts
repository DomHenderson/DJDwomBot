import { Command, PermissionLevel, CommandPrototype } from './command';
import { ModGate } from './modGate';
import { ValidMessage } from './validMessage';

export enum Result {
	Success,
	Fail,
	NotRecognised,
	Blocked
}

export interface BotManager {
	giveMessage(m: ValidMessage): Promise<Result>;
	getCommandPrototypes(): CommandPrototype[];
	getBotName(): string;
	registerModGate(modGate: ModGate): void;
	loadPersistentData(): boolean;
	getMatchingCommandPrototype(message: ValidMessage): CommandPrototype|null;
}

export function InitialiseBotManager<T extends BotManager>(
	manager: T,
	modGate: ModGate
): T {
	modGate.registerBotManager(manager);
	manager.registerModGate(modGate);
	manager.loadPersistentData();
	return manager;
}

export abstract class BotManagerImpl<Bot> implements BotManager {
	constructor(
		botName: string,
		saveLocation: string,
	) {
		this.botName = botName;
		this.saveLocation = saveLocation;
	}
	registerModGate(modGate: ModGate): void {
		this.modGate = modGate;
	}
	getBotName(): string {
		return this.botName;
	}
	getCommandPrototypes(): CommandPrototype[] {
		return this.getCommands();
	}
	async giveMessage(message: ValidMessage): Promise<Result> {
		//Find a command associated with the given text and number of arguments
		const command: Command<Bot>|null = this.getMatchingCommand(message);

		//If no such command could be found, return NotRecognised
		if (command === null) {
			return Result.NotRecognised;
		}

		//If a mod gate has been registered, check if the user is allowed to call this command
		const allowed: boolean = this.modGate?.check(message, command, this.getBotName()) ?? true;
		
		if (allowed) {
			const bot: Bot = this.getBot(message);
			const result = await command.func(message, bot);
			this.savePersistentData();
			return result ? Result.Success : Result.Fail;
		} else {
			return Result.Blocked;
		}
	}

	getMatchingCommandPrototype(message: ValidMessage): CommandPrototype|null {
		return this.getMatchingCommand(message);
	}

	public abstract loadPersistentData(): boolean;
	protected abstract savePersistentData(): void

	protected abstract getBot(message: ValidMessage): Bot;
	protected abstract getCommands(): Command<Bot>[];

	private getMatchingCommand(message: ValidMessage): Command<Bot>|null {
		//First match based on command text
		const commandText: string = message.commandText;
		const potentialCommands: Command<Bot>[] = this.matchCommandText(commandText);
		if (potentialCommands.length === 0) {
			return null;
		}

		//Next match based on the number of arguments
		const numArgs = message.numArgs;
		const matchingCommand: Command<Bot>|undefined = potentialCommands.find(
			(command: Command<Bot>) => command.minArgs <= numArgs && numArgs <= command.maxArgs
		);
		if(matchingCommand === undefined) {
			return null;
		}

		return matchingCommand;
	}

	private matchCommandText(s: string): Command<Bot>[] {
		return this.getCommands()
			.filter((c: Command<Bot>) => c.names.includes(s));
	}

	private botName: string;
	protected saveLocation: string;
	protected modGate: ModGate|null = null;
}