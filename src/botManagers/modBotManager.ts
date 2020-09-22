import * as Discord from 'discord.js';
import fs from 'fs';
import { CreateModBot, ModBot } from '../bots/modBot';
import { Config } from '../config';
import { GuildModSaveData, ModBotSaveData } from '../persistence/modBotSave';
import { GuildSaveData, ModBotSave, Save } from '../persistence/save';
import { BotManager, BotManagerImpl, InitialiseBotManager } from './botManager';
import { Command, CommandPrototype, PermissionLevel } from './command';
import { MessageChannel } from './messageChannel';
import { ModGate } from './modGate';
import { ValidMessage } from './validMessage';
import { assert } from 'console';

export function CreateModBotManager(): ModBotManager {
	const modBotManager: ModBotManager = new ModBotManager();
	InitialiseBotManager(modBotManager, modBotManager);
	return modBotManager;
}

export class ModBotManager extends BotManagerImpl<ModBot> implements ModGate {
	//--------------------------------------------------------------------------
	// Modgate
	//--------------------------------------------------------------------------

	getPermissionLevel(guildId: string, command: CommandPrototype): PermissionLevel {
		const bot: ModBot = this.getOrCreateModBot(guildId);
		return bot.getPermissionLevel(command);
	}
	hasPermissionLevel(guildId: string, p: PermissionLevel, botManagers: BotManager[]): boolean {
		const bot: ModBot = this.getOrCreateModBot(guildId);
		return botManagers.some((botManager: BotManager): boolean => (
			botManager.getCommandPrototypes().some((c: CommandPrototype): boolean => (
				bot.getPermissionLevel(c) === p
			))
		));
	}
	registerBotManager(b: BotManager): void {
		if(!this.botManagers.includes(b)) {
			this.botManagers.push(b);
		}
	}
	check(message: ValidMessage, command: CommandPrototype, botName: string|null): boolean {
		const p: PermissionLevel = this.getPermissionLevel(message.guild.id, command);

		console.log(`Permission level ${p}`);
		console.log(`user is mod ${this.isMod(message.author)}`);
		console.log(`user is admin ${this.isOwner(message.author)}`);

		if(botName && this.getRestrictedBots(message).includes(botName)) {
			console.log(`Checking restricted command (botName: ${botName}`);
			return (
				this.isOwner(message.author) ||
				(
					(p === PermissionLevel.Mod || p === PermissionLevel.Anyone) &&
					this.isMod(message.author)
				)
			);
		} else {
			return (
				(p === PermissionLevel.Anyone) ||
				this.isOwner(message.author) ||
				(p === PermissionLevel.Mod && this.isMod(message.author))
			);
		}
	}

	//--------------------------------------------------------------------------
	// BotManager
	//--------------------------------------------------------------------------
	
	public loadPersistentData(): boolean {
		try {
			const save: Save = JSON.parse(fs.readFileSync(this.saveLocation, 'utf8'));
			save.Mod.guildModSettings
				.forEach((s: GuildSaveData<GuildModSaveData>): void => {
					this.getOrCreateModBot(s.guildId).loadData(s.data);
				});
			return true;
		} catch(e) {
			console.log(e);
			return false;
		}
	}
	protected savePersistentData(): void {
		ModBotSave(
			new ModBotSaveData(
				[...this.modBots.entries()]
					.map(([guildId, modBot]: [string, ModBot]): GuildSaveData<GuildModSaveData> => {
						return new GuildSaveData<GuildModSaveData>(
							guildId,
							modBot.saveData()
						);
					})
			)
		);
	}
	constructor() {
		super('Mod', '⚔️', Config.GetSaveFilePath());
		this.botManagers = [this];
	}
	
	protected getBot(message: ValidMessage): ModBot {
		return this.getOrCreateModBot(message.guild.id);
	}

	protected getCommands(): Command<ModBot>[] {
		return [
			new Command<ModBot>(['setpermission'], setPermission(this.botManagers), ['command', 'anyone|mod|owner'], 2, Infinity, PermissionLevel.Mod),
			new Command<ModBot>(['addmodrole'], addModRole, ['roleName'], 0, Infinity, PermissionLevel.Owner),
			new Command<ModBot>(['removemodrole'], removeModRole, ['roleName'], 0, Infinity, PermissionLevel.Owner),
			new Command<ModBot>(['listmodroles'], listModRoles, [], 0, Infinity, PermissionLevel.Anyone),
			new Command<ModBot>(['restrictmusic'], restrictMusic, [], 0, Infinity, PermissionLevel.Mod),
			new Command<ModBot>(['derestrictmusic'], derestrictMusic, [], 0, Infinity, PermissionLevel.Mod)
		];
	}

	protected getPrefix(): string {
		return Config.GetCommandPrefix();
	}

	private getOrCreateModBot(guildId: string): ModBot {
		const b: ModBot|undefined = this.modBots.get(guildId);
		if (b === undefined) {
			console.log(`Creating mod bot for guild ${guildId}`);
			const newBot: ModBot = CreateModBot();
			this.modBots.set(guildId, newBot);
			return newBot;
		}
		return b;
	}

	private isMod(author: Discord.GuildMember): boolean {
		const bot: ModBot = this.getOrCreateModBot(author.guild.id);
		const modRoles: string[] = bot.getModRoles();
		console.log('checking mod status');
		console.log(author.roles.cache.entries());
		const isMod: boolean = author.roles.cache.some((r: Discord.Role) => modRoles.includes(r.name));
		console.log(`${author.displayName}  isMod:${isMod}`);
		return isMod;
	}
	
	private isOwner(author: Discord.GuildMember): boolean {
		const isOwner: boolean = author.id === author.guild.ownerID;
		console.log(`${author.displayName}  isOwner:${isOwner}`);
		return isOwner;
	}

	private getRestrictedBots(message: ValidMessage): string[] {
		return this.getOrCreateModBot(message.guild.id).getRestrictedBots();
	}

	private botManagers: BotManager[];
	private modBots: Map<string, ModBot> = new Map<string, ModBot>();
}

function setPermission(botManagers: BotManager[]): (message: ValidMessage, modBot: ModBot) => Promise<boolean> {
	return async (m: ValidMessage, b: ModBot): Promise<boolean> => {
		console.log('Running set permission');
		const args: string[] = m.args;
		console.log(`args: ${args}`);
		assert(args.length >= 2);
		const permissionLevel: PermissionLevel|null = toPermissionLevel(args[1]);
		console.log(`p: ${permissionLevel}`);
		if (permissionLevel === null) {
			m.channel.send(`${args[1]} is not a valid permission level. Options are "anyone", "mod", and "owner"`);
			return true;
		}

		const commands: CommandPrototype[] = botManagers
			.map((botManager: BotManager): CommandPrototype[] => {
				return botManager
					.getCommandPrototypes()
					.filter((c: CommandPrototype): boolean => {
						return c.names.includes(args[0].toLocaleLowerCase());
					});
			})
			.flat();

		console.log(`Matching commands: ${commands}`);

		if(commands.length === 0) {
			m.channel.send('No matching command found');
			return true;
		} else if(commands.length === 1) {
			b.setPermissionLevel(commands[0], permissionLevel);
			m.channel.send(`Set permission level for ${commands[0].aliasString} to ${args[1]}`);
			return true;
		} else {
			const responseHeader: string = `Multiple commands match ${args[0]}:`;
			const matchingCommandList: string = commands
				.map((c: CommandPrototype, i: number): string => {
					return `${i+1}. ${c.fullDescription}`;
				})
				.join('\n');
			const responseEnd: string = `Which number command were you referring to, ${m.author.toString()}?`;
			m.channel.send(`${responseHeader}\n${matchingCommandList}\n${responseEnd}`);

			const filter = (message: Discord.Message) => message.author.id === m.author.id;
			const choice: number|null = await m.channel.awaitMessages(filter, {max: 1, time: 30000})
				.then((collected: Discord.Collection<string, Discord.Message>) => {
					const response: Discord.Message|undefined = collected.first();
					if(response === undefined) {
						m.channel.send('Failed to catch response');
						return null;
					}
					const choice: number = parseInt(response.content);
					if (!isNaN(choice)) {
						if(choice < 1 || choice > commands.length) {
							m.channel.send(`${choice} was not one of the available options`);
							return null;
						}
						return choice;
					} else {
						return null;
					}
				})
				.catch(() => {
					return null;
				});
			if(choice === null) {
				return true;
			}
			b.setPermissionLevel(commands[choice-1], permissionLevel);
			return true;
		}
	};
}

function toPermissionLevel(s: string): PermissionLevel|null {
	s = s.toLocaleLowerCase();
	if (s === 'anyone') {
		return PermissionLevel.Anyone;
	} else if (s === 'mod') {
		return PermissionLevel.Mod;
	} else if (s === 'owner') {
		return PermissionLevel.Owner;
	} else {
		return null;
	}
}

async function addModRole(message: ValidMessage, modBot: ModBot): Promise<boolean> {
	const args: string[] = message.args;
	const channel: MessageChannel = message.channel;
	const validRole: boolean = message.guild.roles.cache.some((r: Discord.Role) => args[0] === r.name);
	if(!validRole) {
		channel.send(`Warning: ${args[0]} is not an existing role name in this server`);
	}
	modBot.addModRole(args[0]);
	listModRoles(message, modBot);
	return true;
}

async function removeModRole(message: ValidMessage, modBot: ModBot): Promise<boolean> {
	const args: string[] = message.args;
	const success: boolean = modBot.removeModRole(args[0], message.channel);
	listModRoles(message, modBot);
	return success;
}

async function listModRoles(message: ValidMessage, modBot: ModBot): Promise<boolean> {
	const roles: string[] = modBot.getModRoles();
	message.channel.send(`Mod roles: ${roles.join(', ')}`);
	return true;
}

async function restrictMusic(message: ValidMessage, modBot: ModBot): Promise<boolean> {
	console.log(`Restricted bots before: ${modBot.getRestrictedBots()}`);
	if(modBot.getRestrictedBots().includes('DJ')) {
		message.channel.send('Music is already restricted in this server');
	} else {
		modBot.addRestrictedBot('DJ');
		message.channel.send('Music is now restricted to mods only');
	}
	console.log(`Restricted bots after: ${modBot.getRestrictedBots()}`);
	return true;
}

async function derestrictMusic(message: ValidMessage, modBot: ModBot): Promise<boolean> {
	if(modBot.getRestrictedBots().includes('DJ')) {
		modBot.removeRestrictedBot('DJ');
		message.channel.send('Music is now unrestricted in this server');
		return true;
	} else {
		message.channel.send('Music was not restricted in this server');
		return true;
	}
}