import * as Discord from 'discord.js';
import fs from 'fs';
import ytsr from 'ytsr';

import { BotManagerImpl, Command } from "./botManager";
import { DJ, CreateDJ, Song, parseDuration, isValidDuration } from "../bots/dj";
import * as Config  from '../config.json';
import { ValidMessage } from './validMessage';
import { DJSaveData, GuildDJRecord } from '../persistence/djSave';
import { Save, DJSave } from '../persistence/save';

export function CreateDJBotManager(): DJBotManager {
	return new DJBotManager();
}

export class DJBotManager extends BotManagerImpl<DJ> {
	loadPersistentData(): boolean {
		try {
			const save: Save = JSON.parse(fs.readFileSync(this.saveLocation, 'utf8'));
			save.dj.guildDJs
				.map((guildDJRecord: GuildDJRecord) => {
					this.getOrCreateDJ(guildDJRecord.name).loadData(guildDJRecord.data)
				});
			return true;
		} catch(e) {
			console.log(e);
			return false;
		}
	}
	protected savePersistentData(): void {
		DJSave(
			new DJSaveData(
				[...this.djMap.entries()].map(([guildId, dj]: [string, DJ]) => {
					return new GuildDJRecord(
						guildId,
						dj.saveData()
					)
				})
			),
			Config.saveFile
		);
		
	}
	constructor() {
		super('DJ', Config.saveFile);
		this.loadPersistentData();
	}

	protected getBot(message: ValidMessage): DJ {
		return this.getOrCreateDJ(message.guild.id);
	}

	protected getCommands(): Map<string, Command<DJ>[]> {
		return djCommands;
	}

	protected getPrefix(): string {
		return prefix;
	}

	private getOrCreateDJ(guildId: string): DJ {
		let guildDJ: DJ|undefined = this.djMap.get(guildId);
		if (guildDJ === undefined) {
			const dj = CreateDJ();
			this.djMap.set(guildId, dj);
			return dj;
		}
		return guildDJ;
	}

	private djMap: Map<string,DJ> = new Map<string,DJ>();
	private save: DJSaveData = new DJSaveData();
}

const prefix = Config.prefix;

async function getIn(message: ValidMessage, dj: DJ): Promise<boolean> {
	if (message.author === null) {
		message.channel.send('Unable to determine who said to get in');
		return false;
	}
	const sender: Discord.GuildMember = message.author;
	if (sender.voice.channel === null ) {
		message.channel.send('Please do not tell me to get in when you yourself are not in');
		return false;
	}
	return dj.getIn(sender.voice.channel);
}

async function getOut(message: ValidMessage, dj: DJ): Promise<boolean> {
	if(!dj.getCurrentVoiceChannel()) {
		message.channel.send("I'm not currently in");
		return true;
	}
	return dj.getOut();
}

async function findSongChoices(args: string[]): Promise<Song[]|null> {
	const result: ytsr.result = await ytsr(args.join(" "));
	console.log(`Searching for ${args.join(" ")} produced:`)
	console.log(result);
	if(result.items.length === 0) {
		console.log('No results were found');
		return null;
	} else {
		return result.items
			.filter(item => item.type === 'video')
			.slice(0,5)
			.map(item => {
				return {
					title: item.title,
					url: item.link,
					length: item.duration,
					artist: item.author.name
				};
			});
	}
}

async function chooseSong(message: ValidMessage, options: Song[]): Promise<Song|null> {
	const songList: string = options
		.map((song: Song, i: number) => `${i+1}. ${song.title} (${song.length}) by ${song.artist}`)
		.join('\n');
	const tag: string = `<@${message.author.id}>`;
	message.channel.send(`${tag} Please choose a song (1-5):\n${songList}`);
	const filter = (m: Discord.Message) => m.author.id === message.author.id;
	return message.channel.awaitMessages(filter, {max: 1, time: 30000})
		.then((collected: Discord.Collection<string, Discord.Message>) => {
			const response: Discord.Message|undefined = collected.first();
			if(response === undefined) {
				message.channel.send('Failed to catch response')
				return null;
			}
			const choice: number = parseInt(response.content);
			if (choice !== NaN) {
				if(choice < 1 || choice > 5) {
					message.channel.send(`${choice} is not in the range 1-5`);
					return null;
				}
				return options[choice-1];
			} else {
				return null;
			}
		})
		.catch(() => {
			return null;
		});
}

async function add(message: ValidMessage, dj:DJ): Promise<boolean> {
	const args: string[] = message.content.split(" ").slice(1);
	if(args.length === 0) {
		message.channel.send('Add what?');
		return false;
	} else  {
		const songChoices: Song[] | null = await findSongChoices(args);
		if(songChoices === null) {
			message.channel.send('Failed to find song');
			return false;
		}
		const song: Song|null = await chooseSong(message, songChoices);
		if(song === null) {
			return false;
		}
		dj.addSong(song, message.channel);
		return true;
	}
}

async function play(message: ValidMessage, dj: DJ) {
	const args: string[] = message.content.split(" ").slice(1);
	if(args.length > 0) {
		const songChoices: Song[]|null = await findSongChoices(args);
		if(songChoices === null) {
			message.channel.send('Failed to find song');
			return false;
		}
		const song: Song|null = await chooseSong(message, songChoices);
		if(song === null) {
			return false;
		}
		dj.addSong(song, message.channel);
	}
	if(dj.getCurrentVoiceChannel() === null) {
		console.log('current voice channel is null');
		const voiceChannel: Discord.VoiceChannel | null = message.author.voice.channel;
		if(voiceChannel !== null) {
			console.log('user voice channel is not null');
			const success = await dj.getIn(voiceChannel);
			if (!success) {
				message.channel.send(`Failed to get in voice channel: ${voiceChannel.name}`);
				return false;
			}
		}
	}
	console.log('attempting to start playback');
	return dj.play(message.channel);
}

async function pause(message: ValidMessage, dj:DJ): Promise<boolean> {
	return dj.pause(message.channel);
}

async function stop(message: ValidMessage, dj:DJ): Promise<boolean> {
	return dj.stop(message.channel);
}

async function skip(message: ValidMessage, dj: DJ): Promise<boolean> {
	return dj.voteSkip(message.author.id, message.channel);
}

async function printStatus(message: ValidMessage, dj: DJ): Promise<boolean> {
	return dj.printStatus(message.channel);
}

async function volume(message: ValidMessage, dj: DJ): Promise<boolean> {
	const args: string[] = message.content.split(" ").slice(1);
	if (args.length === 0) {
		const v = dj.getVolume();
		message.channel.send(`Current volume: ${v}`);
		return true;
	} else {
		const v: number = parseInt(args[0]);
		dj.setVolume(v, message.channel);
		return dj.getVolume() === v;
	}
}

async function maxVolume(message: ValidMessage, dj: DJ): Promise<boolean> {
	const args: string[] = message.content.split(" ").slice(1);
	if (args.length === 0) {
		const v = dj.getVolumeLimit();
		message.channel.send(`Max volume: ${v}`);
		return true;
	} else {
		const v: number = parseInt(args[0]);
		dj.setVolumeLimit(v, message.channel);
		return dj.getVolumeLimit() === v;
	}
}

async function printQueue(message: ValidMessage, dj: DJ): Promise<boolean> {
	return dj.printQueue(message.channel);
}

function durationToString(d: number): string {
	const hours: number = Math.floor(d/3600);
	const minutes: number = Math.floor((d-hours*3600)/60);
	const seconds: number = d - hours*3600 - minutes*60;
	return `${hours}:${minutes}:${seconds}`;
}

async function maxDuration(message: ValidMessage, dj: DJ): Promise<boolean> {
	const args: string[] = message.content.split(" ").slice(1);
	if (args.length === 0) {
		const m = dj.getMaxSongLength();
		if(m === null) {
			message.channel.send('No max song length set');
		} else {
			message.channel.send(`Max song length: ${durationToString(m)}`);
		}
		return true;
	} else {
		if(args[0] === 'none') {
			dj.setMaxSongLength(null);
			message.channel.send('Removed max song length');
			return true;
		} else if (isValidDuration(args[0])) {
			dj.setMaxSongLength(parseDuration(args[0]));
			message.channel.send('max length updated');
			console.log(`max length now ${dj.getMaxSongLength()}`);
			return true;
		} else {
			message.channel.send('max length should be either hh:mm:ss or "none"');
			return false;
		}
	}
}

const djCommands: Map<string, Command<DJ>[]> = new Map<string,Command<DJ>[]>([
	['getin', [new Command('getIn', getIn)]],
	['getinlad', [new Command('getInLad', getIn)]],
	['getout', [new Command('getOut', getOut)]],
	['getoutLad', [new Command('getOutLad', getOut)]],
	['add', [new Command('add', add, 1)]],
	['play', [
		new Command('play', play, 0, 0),
		new Command('play <song>', play, 1)
	]],
	['pause', [new Command('pause', pause)]],
	['stop', [new Command('stop', stop)]],
	['skip', [new Command('skip', skip)]],
	['printstatus', [new Command('printStatus', printStatus)]],
	['volume', [
		new Command('volume', volume, 0, 0),
		new Command('volume <newVolume>', volume, 1)
	]],
	['maxvolume', [
		new Command('maxVolume', maxVolume, 0, 0),
		new Command('maxVolume <newMaxVolume>', maxVolume, 1)
	]],
	['queue', [new Command('queue', printQueue)]],
	['maxlength', [
		new Command('maxLength', maxDuration, 0, 0),
		new Command('maxLength <duration or "none">', maxDuration, 1)
	]]
]);