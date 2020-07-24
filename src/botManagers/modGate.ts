import { PermissionLevel, CommandPrototype } from './command';
import { BotManager } from './botManager';
import { ValidMessage } from './validMessage';

export interface ModGate {
	getPermissionLevel(guildId: string, command: CommandPrototype): PermissionLevel;
	hasPermissionLevel(guildId: string, p: PermissionLevel, botManagers: BotManager[]): boolean;
	registerBotManager(b: BotManager): void;
	check(message: ValidMessage, command: CommandPrototype, botName: string|null): boolean;
}