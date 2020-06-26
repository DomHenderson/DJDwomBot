export class ImageBotSaveData {
	constructor(
		public cache: SubredditCache[]
	) {}
}

export class SubredditCache {
	constructor(
		public name: string,
		public links: string[]
	) {}
}