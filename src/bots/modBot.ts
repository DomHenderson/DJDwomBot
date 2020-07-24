import { PermissionLevel, CommandPrototype } from '../botManagers/command';
import { MessageChannel } from '../botManagers/messageChannel';
import { GuildModSaveData } from '../persistence/modBotSave';

export interface ModBot {
	loadData(data: GuildModSaveData): void;
	saveData(): GuildModSaveData;

	getPermissionLevel(command: CommandPrototype): PermissionLevel;
	setPermissionLevel(command: CommandPrototype, p: PermissionLevel): void;
	hasPermissionLevel(p: PermissionLevel): boolean;

	addModRole(r: string): void;
	getModRoles(): string[];
	removeModRole(r: string, channel: MessageChannel): boolean;

	addRestrictedBot(name: string): void;
	getRestrictedBots(): string[];
	removeRestrictedBot(name: string): boolean;
}

class ModBotImpl implements ModBot {
	loadData(data: GuildModSaveData): void {
		this.permissions = new Map<CommandPrototype, PermissionLevel>(data.permissions);
		this.modRoles = data.modRoles;
		this.restrictedBots = data.restrictedBots;
	}
	saveData(): GuildModSaveData {
		return new GuildModSaveData(
			this.permissions,
			this.modRoles,
			this.restrictedBots
		);
	}
	getPermissionLevel(command: CommandPrototype): PermissionLevel {
		return this.permissions.get(command) ?? command.permissionLevel;
	}
	setPermissionLevel(command: CommandPrototype, p: PermissionLevel): void {
		if(command.permissionLevel === p) {
			this.permissions.delete(command);
		} else {
			this.permissions.set(command, p);
		}
	}
	hasPermissionLevel(p: PermissionLevel): boolean {
		return [...this.permissions.values()].includes(p);
	}
	addModRole(r: string): void {
		if(!this.modRoles.includes(r)) {
			this.modRoles.push(r);
		}
	}
	getModRoles(): string[] {
		return this.modRoles;
	}
	removeModRole(r: string): boolean {
		if(this.modRoles.includes(r)) {
			this.modRoles = this.modRoles.filter((s: string): boolean => s !== r);
			return true;
		} else {
			return false;
		}
	}
	addRestrictedBot(name: string): void {
		if(!this.restrictedBots.includes(name)) {
			this.restrictedBots.push(name);
		}
	}
	getRestrictedBots(): string[] {
		return this.restrictedBots;
	}
	removeRestrictedBot(name: string): boolean {
		if(this.restrictedBots.includes(name)) {
			this.restrictedBots = this.restrictedBots.filter((s: string): boolean => s !== name);
			return true;
		} else {
			return false;
		}
	}

	private permissions: Map<CommandPrototype, PermissionLevel> = new Map<CommandPrototype, PermissionLevel>();
	private modRoles: string[] = ['DJMod'];
	private restrictedBots: string[] = [];
}

export function CreateModBot(): ModBot {
	return new ModBotImpl();
}