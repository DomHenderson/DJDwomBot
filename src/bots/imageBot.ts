import os from 'os';
import axios from 'axios';
import * as Discord from 'discord.js'
import { Config } from '../config';
import { ImageBotSaveData, SubredditCache } from '../persistence/imageBotSave';
import { RedditPost, RedditResponse } from './redditResponse';
import { stringify } from 'querystring';

export interface ImageBot {
	getFromLocal(name: string): Promise<string|null>;
	getFromSubreddit(subredditName: string): Promise<string|null>;
	getFromPins(channelName: string, client: Discord.Client): Promise<Discord.Message|null>;
	registerChannel(channelID: string, name: string): void;
	loadData(data: ImageBotSaveData): void;
	saveData(): ImageBotSaveData;
}

class ImageBotImpl implements ImageBot {
	private registeredChannels: Map<string, string> = new Map<string, string>();
	async getFromPins(channelName: string, client: Discord.Client): Promise<Discord.Message|null> {
		console.log(this.registeredChannels);
		const channelID: string|undefined = this.registeredChannels.get(channelName);
		if(channelID === undefined) return null;
		const validChannels = [...client.guilds.cache.values()]
			.flatMap((guild: Discord.Guild): [string, Discord.Channel][] => {
				return [...guild.channels.cache.entries()];
			})
			.filter(([id, channel]: [string, Discord.Channel]): boolean => {
				return id === channelID;
			})
			.map(([id, channel]: [string, Discord.Channel]): Discord.Channel => {
				return channel;
			});
		if(validChannels.length === 0) {
			console.log('No valid channels');
			return null;
		} else if (validChannels.length === 1) {
			const channel: Discord.Channel = validChannels[0];
			if(channel instanceof Discord.TextChannel) {
				const pins = await channel.messages.fetchPinned();
				const id = Math.floor(Math.random()*(pins.size));
				return [...pins.values()][id];
			} else {
				console.log('Channel is not a text channel');
				return null;
			}
		} else {
			return null;
		}
	}
	registerChannel(channelID: string, name: string): void {
		this.registeredChannels.set(name, channelID);
		console.log(this.registeredChannels);
	}
	loadData(data: ImageBotSaveData): void {
		this.cache = new Map<string, string[]> (
			data.cache.map((subredditCache: SubredditCache) => {
				return [subredditCache.name, subredditCache.links];
			})
		);
		console.log(data.namedChannels);
		this.registeredChannels = new Map<string, string>(data.namedChannels);
		console.log([...this.registeredChannels.entries()]);
		console.log(this.registeredChannels instanceof Map);
	}
	saveData(): ImageBotSaveData {
		return new ImageBotSaveData(
			[...this.cache.entries()].map(
				(([name, links]: [string, string[]]) => {
					return new SubredditCache(name, links);
				})
			),
			[...this.registeredChannels.entries()]
		);
	}
	async getFromLocal(name: string): Promise<string|null> {
		return Config.GetImageLocation(name);
	}
	async getFromSubreddit(subredditName: string): Promise<string|null> {
		const cache: string[]|undefined = this.cache.get(subredditName);
		let options: string[];
		if(cache === undefined) {
			try {
				const response: RedditResponse = await axios.get(`https://www.reddit.com/r/${subredditName}/top.json?t=all&limit=500`);
				const imageLinks: string[] = response
					.data
					.data
					.children
					.map((child: RedditPost) => child.data.url)
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
		console.log(`cache size: ${options.length}`);
		do {
			const index: number = Math.floor(Math.random() * options.length);
			const result = options[index];
			try {
				await axios.get(result);
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

export function CreateImageBot(): ImageBot {
	return new ImageBotImpl();
}
