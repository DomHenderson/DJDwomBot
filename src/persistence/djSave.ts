import { Song } from '../bots/dj';
import { GuildSaveData } from './save';

export class DJSaveData {
	constructor(
		public guildDJs: GuildSaveData<GuildDJSaveData>[] 
	) {}
}

export class GuildDJSaveData {
	constructor(
		public volume: number = 20,
		public maxVolume: number = 100,
		public queue: Song[] = [],
		public maxLength: number|null = null
	) {}
}