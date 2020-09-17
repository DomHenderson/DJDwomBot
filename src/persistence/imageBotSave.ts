export class ImageBotSaveData {
	constructor(
		public cache: SubredditCache[],
		public namedChannels: [string, string][]
	) {}
}

export class SubredditCache {
	constructor(
		public name: string,
		public links: string[]
	) {}
}