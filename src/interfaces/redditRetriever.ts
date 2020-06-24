import axios from 'axios';

let horseCache: string[]|null = null;
let shownHorses: Set<number>;

export interface RedditRetriever {
	getImage(): Promise<string|null>;
}

class RedditRetrieverImpl implements RedditRetriever {
	async getImage(): Promise<string|null> {
		if(this.cache === null) {
			const response: any = await axios.get(`https://www.reddit.com/r/${this.subredditName}/top.json?t=all&limit=500`);
			this.cache = response
				.data
				.data
				.children
				.map((child: any) => child.data.url)
				.filter(
					(link: string) => link.endsWith('.jpg') ||
						link.endsWith('.jpeg') ||
						link.endsWith('.png') ||
						link.endsWith('gif')
				);
			if(this.cache === null) {
				return null;
			}
		}
		console.log(`cache size: ${this.cache.length}`)
		return this.cache[Math.floor(Math.random() * this.cache.length)];
	}

	setSubredditName(s: string): void {
		this.subredditName = s;
	}

	private subredditName: string = "";
	private cache: string[]|null = null;
}

export function CreateRedditRetriever(subreddit: string) {
	const r = new RedditRetrieverImpl();
	r.setSubredditName(subreddit);
	return r;
}

