import { Song } from "../bots/dj";

export class DJSaveData {
	constructor(
		public guildDJs: GuildDJRecord[] = []
	) {}
}

export class GuildDJRecord {
	constructor(
		public name: string,
		public data: GuildDJSaveData
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