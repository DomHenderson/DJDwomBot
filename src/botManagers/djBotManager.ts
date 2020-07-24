import * as Discord from 'discord.js';
import fs from 'fs';
import ytsr from 'ytsr';
import moment from 'moment';

import { CreateDJ, DJ, isValidDuration, parseDuration, Song } from '../bots/dj';
import * as Config from '../config.json';
import { DJSaveData, GuildDJSaveData } from '../persistence/djSave';
import { DJSave, Save, GuildSaveData } from '../persistence/save';
import { BotManagerImpl, InitialiseBotManager } from './botManager';
import { ModGate } from './modGate';
import { Command, PermissionLevel } from './command';
import { ValidMessage } from './validMessage';

export function CreateDJBotManager(modGate: ModGate): DJBotManager {
	const djBotManager: DJBotManager = new DJBotManager();
	InitialiseBotManager(djBotManager, modGate);
	return djBotManager;
}

export class DJBotManager extends BotManagerImpl<DJ> {
	loadPersistentData(): boolean {
		try {
			const save: Save = JSON.parse(fs.readFileSync(this.saveLocation, 'utf8'));
			save.DJ.guildDJs.map((guildDJRecord: GuildSaveData<GuildDJSaveData>): void => {
				this.getOrCreateDJ(guildDJRecord.guildId).loadData(guildDJRecord.data);
			});
			return true;
		} catch(e) {
			console.log(e);
			return false;
		}
	}
	savePersistentData(): void {
		DJSave(
			new DJSaveData(
				[...this.djMap.entries()].map(([guildId, dj]: [string, DJ]) => {
					console.log(`saving ${guildId}`);
					return new GuildSaveData<GuildDJSaveData>(
						guildId,
						dj.saveData()
					);
				})
			)
		);
		
	}
	constructor() {
		super('DJ', Config.saveFile);
	}

	protected getBot(message: ValidMessage): DJ {
		return this.getOrCreateDJ(message.guild.id);
	}

	protected getCommands(): Command<DJ>[] {
		return djCommands;
	}

	protected getPrefix(): string {
		return prefix;
	}

	private getOrCreateDJ(guildId: string): DJ {
		const guildDJ: DJ|undefined = this.djMap.get(guildId);
		if (guildDJ === undefined) {
			const dj = CreateDJ();
			dj.registerManager(this);
			this.djMap.set(guildId, dj);
			return dj;
		}
		return guildDJ;
	}

	private djMap: Map<string,DJ> = new Map<string,DJ>();
}

const prefix = Config.prefix;
const djCommands: Command<DJ>[] = [
	new Command(['getin', 'getinlad'], getIn),
	new Command(['getout', 'getoutlad'], getOut),
	new Command(['add'], add, ['song'], 1),
	new Command(['play'], play, [], 0, 0),
	new Command(['play'], play, ['song'], 1),
	new Command(['pause'], pause),
	new Command(['stop'], stop),
	new Command(['skip'], skip),
	new Command(['clearqueue'], clearQueue, [], 0, Infinity, PermissionLevel.Mod),
	new Command(['printstatus'], printStatus),
	new Command(['volume'], volume, [], 0, 0),
	new Command(['volume'], volume, ['newVolume'], 1),
	new Command(['maxvolume'], maxVolume, [], 0, 0),
	new Command(['maxvolume'], maxVolume, ['newMaxVolume'], 1, Infinity, PermissionLevel.Mod),
	new Command(['queue'], printQueue),
	new Command(['maxlength'], maxDuration, [], 0, 0),
	new Command(['maxlength'], maxDuration, ['duration|"none"'], 1, Infinity, PermissionLevel.Mod),
	new Command(['gencon'], gencon)
];

//------------------------------------------------------------------------------

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
		message.channel.send('I\'m not currently in');
		return true;
	}
	return dj.getOut();
}

async function findSongChoices(args: string[]): Promise<Song[]|null> {
	const result: ytsr.result = await ytsr(args.join(' '));
	console.log(`Searching for ${args.join(' ')} produced:`);
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
				message.channel.send('Failed to catch response');
				return null;
			}
			const choice: number = parseInt(response.content);
			if (!isNaN(choice)) {
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
	const args: string[] = message.content.split(' ').slice(1);
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
	const args: string[] = message.content.split(' ').slice(1);
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

async function clearQueue(message: ValidMessage, dj: DJ): Promise<boolean> {
	return dj.clearQueue(message.channel);
}

async function printStatus(message: ValidMessage, dj: DJ): Promise<boolean> {
	return dj.printStatus(message.channel);
}

async function volume(message: ValidMessage, dj: DJ): Promise<boolean> {
	const args: string[] = message.content.split(' ').slice(1);
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
	const args: string[] = message.content.split(' ').slice(1);
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
	const args: string[] = message.content.split(' ').slice(1);
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

async function gencon(message: ValidMessage, dj: DJ): Promise<boolean> {
	const now = moment().valueOf();
	const then = moment('2021-8-5').valueOf();
	const actualDays = (then-now)/(1000*60*60*24);
	const days = Math.floor(actualDays);
	const actualHours = (actualDays-days)*24;
	const hours = Math.floor(actualHours);
	const actualMinutes = (actualHours-hours)*60;
	const minutes = Math.floor(actualMinutes);
	const actualSeconds = (actualMinutes-minutes)*60;
	const seconds = Math.floor(actualSeconds);

	message.channel.send(`GenCon day is ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds from now`);
	return true;
}