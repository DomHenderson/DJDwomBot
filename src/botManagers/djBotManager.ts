import * as Discord from 'discord.js';
import fs from 'fs';
import ytsr from 'ytsr';

import { CreateDJ, DJ, isValidDuration, parseDuration, Song } from '../bots/dj';
import { Config } from '../config';
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
		super('DJ', '🎵', Config.GetSaveFilePath());
	}

	protected getBot(message: ValidMessage): DJ {
		return this.getOrCreateDJ(message.guild.id);
	}

	protected getCommands(): Command<DJ>[] {
		return djCommands;
	}

	protected getPrefix(): string {
		return Config.GetCommandPrefix();
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

const djCommands: Command<DJ>[] = [
	new Command(['getin', 'getinlad'], getIn),
	new Command(['getout', 'getoutlad'], getOut),
	new Command(['add'], add, ['song'], 1),
	new Command(['play'], startPlayback, [], 0, 0),
	new Command(['play'], addSongAndPlay, ['song'], 1),
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
	new Command(['maxlength'], maxDuration, ['duration|"none"'], 1, Infinity, PermissionLevel.Mod)
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

async function add(message: ValidMessage, dj: DJ): Promise<boolean> {
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
		chooseSong(message, songChoices, (song: Song) => {dj.addSong(song, message.channel)});
		return true;
	}
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

async function chooseSong(message: ValidMessage, options: Song[], callback: (song: Song) => void): Promise<void> {
	const songList: string = options
		.map((song: Song, i: number) => `${i+1}. ${song.title} (${song.length}) by ${song.artist}`)
		.join('\n');
	const tag: string = `<@${message.author.id}>`;
	const sentMessage: Discord.Message = await message.channel.send(`${tag} Please react with your song choice:\n${songList}`);
	const validResponses: Map<string, Song|null> = new Map<string, Song|null>([
		['1️⃣', options[0]],
		['2️⃣', options[1]],
		['3️⃣', options[2]],
		['4️⃣', options[3]],
		['5️⃣', options[4]],
		['❌', null]
	]);
	const filter: Discord.CollectorFilter = (reaction, user) => {
		return [...validResponses.keys()].includes(reaction.emoji.name) && user.id === message.author.id;
	};

	const collector = sentMessage.createReactionCollector(filter, { time: 15000 });

	collector.on('collect', (reaction, user) => {
		const song = validResponses.get(reaction.emoji.name);
		if(song === null) {
			sentMessage.delete();
		} else if (song === undefined) {
			console.log('ERROR: Undefined song selected');
		} else {
			callback(song);
		}
	});

	collector.on('end', collected => {
		sentMessage.delete();
		console.log('collector ending')
	});

	try {
		await sentMessage.react('1️⃣');
		await sentMessage.react('2️⃣');
		await sentMessage.react('3️⃣');
		await sentMessage.react('4️⃣');
		await sentMessage.react('5️⃣');
		await sentMessage.react('❌');
	} catch (e) {
		console.log(e);
	}
}

async function addSongAndPlay(message: ValidMessage, dj: DJ) {
	const args: string[] = message.args;

	const songChoices: Song[]|null = await findSongChoices(args);
	if(songChoices === null) {
		message.channel.send('Failed to find song');
		return false;
	}
	chooseSong(
		message,
		songChoices,
		(song: Song) => {
			dj.addSong(song, message.channel);
			startPlayback(message, dj);
		}
	);
	return true;
}

async function startPlayback(message: ValidMessage, dj: DJ): Promise<boolean> {
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
