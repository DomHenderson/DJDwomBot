import axios from 'axios';
import fs from 'fs';

import * as Config from '../config.json';
import { Message } from 'discord.js';
import { ImageBotSaveData, SubredditCache } from '../persistence/imageBotSave';

export interface ImageBot {
	getFromLocal(name: string): Promise<string|null>;
	getFromSubreddit(subredditName: string): Promise<string|null>;
	loadData(data: ImageBotSaveData): void;
	saveData(): ImageBotSaveData;
}

class ImageBotImpl implements ImageBot {
	loadData(data: ImageBotSaveData): void {
		this.cache = new Map<string, string[]> (
			data.cache.map(
				(subredditCache: SubredditCache) => {
					return [subredditCache.name, subredditCache.links];
				}
			)
		);
	}
	saveData(): ImageBotSaveData {
		return new ImageBotSaveData(
			[...this.cache.entries()].map(
				(([name, links]: [string, string[]]) => {
					return new SubredditCache(name, links)
				})
			)
		);
	}
	async getFromLocal(name: string): Promise<string | null> {
		const imageLoc: string|undefined = ImageMap.get(name);
		if(imageLoc === undefined) {
			return null;
		} else {
			return imageLoc;
		}
	}
	async getFromSubreddit(subredditName: string): Promise<string|null> {
		const cache: string[]|undefined = this.cache.get(subredditName);
		let options: string[];
		if(cache === undefined) {
			try {
				const response: any = await axios.get(`https://www.reddit.com/r/${subredditName}/top.json?t=all&limit=500`);
				const imageLinks: string[] = response
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
				this.cache.set(subredditName, imageLinks);
				options = imageLinks;
			} catch(e) {
				return null;
			}
		} else {
			options = cache;
		}
		console.log(`cache size: ${options.length}`)
		do {
			const index: number = Math.floor(Math.random() * options.length);
			const result = options[index];
			try {
				await axios.get(result)
				return result;
			} catch(e) {
				console.log(`removed ${result}`);
				options.splice(index, 1);
			}
		} while (options.length > 0);
		return null;

	}

	private cache: Map<string,string[]> = new Map<string,string[]>();
}

export function CreateImageBot() {
	return new ImageBotImpl();
}

const ImageMap: Map<string, string> = new Map<string, string>(
	Config.imageLocations
		.map(image => [image.name, image.location])
);
