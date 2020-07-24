import { GuildSaveData } from './save';
import { PermissionLevel, CommandPrototype } from '../botManagers/command';

export class ModBotSaveData {
	constructor(
		public guildModSettings: GuildSaveData<GuildModSaveData>[]
	) {}
}

export class GuildModSaveData {
	constructor(
		public permissions: Map<CommandPrototype,PermissionLevel>,
		public modRoles: string[],
		public restrictedBots: string[]
	) {}
}