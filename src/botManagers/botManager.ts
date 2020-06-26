import { prefix } from "../config.json";
import { ValidMessage } from "./validMessage";

export class Command<BotType> {
	constructor(
		public name: string,
		public func: (m: ValidMessage, b: BotType) => Promise<boolean>,
		public minArgs: number = 0,
		public maxArgs: number = Infinity,
		public modOnly: boolean = false
	) {}
}

export interface BotManager {
	giveMessage(m: ValidMessage): Promise<boolean|null>;
	getCommandNames(): string[];
	getBotName(): string;
}

export abstract class BotManagerImpl<Bot> implements BotManager {
	constructor(botName: string, saveLocation: string) {
		this.botName = botName;
		this.saveLocation = saveLocation;
	}
	getBotName(): string {
		return this.botName;
	}
	getCommandNames(): string[] {
		return [...this.getCommands().values()]
			.reduce((a: Command<Bot>[], v: Command<Bot>[]) => a.concat(v), [])
			.map((c: Command<Bot>) => c.name);
	}
	async giveMessage(message: ValidMessage): Promise<boolean|null> {
		const bot: Bot = this.getBot(message);
		const commands: Map<string, Command<Bot>[]> = this.getCommands();
		const commandText: string = message.content.split(" ")[0].substr(prefix.length);
		const potentialCommands: Command<Bot>[]|undefined = commands.get(commandText);

		if(potentialCommands === undefined || potentialCommands.length === 0) {
			return null;
		} else {
			const numArgs: number = message.content.split(" ").length - 1;
			const matchingCommand: Command<Bot>|undefined = potentialCommands.find(
				(command: Command<Bot>) => command.minArgs <= numArgs && numArgs <= command.maxArgs
			);
			if(matchingCommand === undefined) {
				return null;
			} else {
				const result = await matchingCommand.func(message, bot);
				this.savePersistentData();
				return result;
			}
		}
	}

	public getCommandList(): string {
		return [...this.getCommands().values()]
			.reduce((a, v) => a.concat(v), [])
			.map((c: Command<Bot>) => c.name)
			.join('\n');
	}

	public abstract loadPersistentData(): boolean;
	protected abstract savePersistentData(): void

	protected abstract getBot(message: ValidMessage): Bot;
	protected abstract getCommands(): Map<string, Command<Bot>[]>;

	private botName: string;
	protected saveLocation: string;
}
