import { GuildSaveData } from './save';
import { PermissionLevel, CommandPrototype } from '../botManagers/command';

export class ModBotSaveData {
	constructor(
		public guildModSettings: GuildSaveData<GuildModSaveData>[]
	) {}
}

export class GuildModSaveData {
	constructor(
		public permissions: [CommandPrototype,PermissionLevel][],
		public modRoles: string[],
		public restrictedBots: string[]
	) {}
}