import axios from 'axios';
import * as Discord from 'discord.js';
import ytsr from 'ytsr';

import config from './config.json';
import { DJ, CreateDJ } from './interfaces/dj';
import { DJQueue } from './interfaces/djqueue';
import { Song } from './interfaces/song';
import { RedditRetriever, CreateRedditRetriever } from './interfaces/redditRetriever';
import { checkServerIdentity } from 'tls';


//------------------------------------------------------------------------------
// Interfaces
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Data
//------------------------------------------------------------------------------

const client = new Discord.Client();
const token: string = config.token;
const prefix: string = config.prefix;
const redditRetrievers = new Map<string, RedditRetriever>();

const DJs = new Map<string, DJ>();

//------------------------------------------------------------------------------
// Behaviour
//------------------------------------------------------------------------------

client.once("ready", () => {
	console.log("Ready!");
});

client.once("disconnect", () => {
	console.log("Disconnect!");
});

client.on("message", async (message: Discord.Message) => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	const command: string = message.content.split(" ")[0].substr(prefix.length);
	if (message.guild !== null) {
		const guildDJ = getOrCreateDJ(message.guild.id);
		if (command === 'help') {
			printHelp(message);
		} else if (command === 'getIn' || command === 'getInLad') {
			const success: boolean = await getIn(message, guildDJ);
			console.log(success ? 'successfully got in' : 'failed to get in');
		} else if (command === 'getOut' || command === 'getOutLad') {
			const success: boolean = getOut(message, guildDJ);
			console.log(success ? 'successfully got out' : 'failed to get out');
		} else if (command === 'nowPlaying') {
			const success: boolean = printStatus(message, guildDJ);
			console.log(success ? 'successfully printed status' : 'failed to print status');
		} else if (command === 'add') {
			const success: boolean = await add(message, guildDJ);
			console.log(success ? 'successfully added a song' : 'failed to add a song');
		} else if (command === 'play') {
			const success: boolean = await play(message, guildDJ);
			console.log(success ? 'successfully playing' : 'failed to play');
		} else if (command === 'pause') {
			const success: boolean = pause(message, guildDJ);
			console.log(success ? 'successfully paused' : 'failed to pause');
		} else if (command === 'stop') {
			const success: boolean = stop(message, guildDJ);
			console.log(success ? 'successfully stopped' : 'failed to stop');
		} else if (command === 'skip') {
			const success: boolean = skip(message, guildDJ);
			console.log(success ? 'successfully skipped' : 'failed to skip');
		} else if (command === 'volume') {
			const volumeBefore: number = guildDJ.getVolume();
			const volumeAfter: number = setVolume(message, guildDJ);
			console.log(`volume: ${volumeBefore} -> ${volumeAfter}`);
		} else if (command === 'maxVolume') {
			const maxVolumeBefore: number = guildDJ.getVolumeLimit();
			const maxVolumeAfter: number = limitVolume(message, guildDJ);
			console.log(`volume: ${maxVolumeBefore} -> ${maxVolumeAfter}`);
		} else if (command === 'queue') {
			printQueue(message, guildDJ);
			console.log('printed queue');
		} else if (command === 'horse') {
			horse(message);
		} else if (command === 'pokemon') {
			pokemon(message);
		} else if (command === 'mushroom') {
			mushroom(message);
		} else if (command === 'cat') {
			cat(message);
		} else if (command === 'cheese') {
			cheese(message);
		} else if (command === 'cheetah') {
			cheetah(message);
		} else {
			message.channel.send(`Unrecognised command: ${command}`);
		}
	} else {
		console.log('Error: guild is null');
		message.channel.send('null guild error');
	}
});

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------

function printHelp(message: Discord.Message): void {
	message.channel.send(`DJ prefex:\n  ${prefix}\nAvailable commands are:\n  ${[
		"help",
		"getIn",
		"getOut",
		"add <song>",
		"play",
		"play <song>",
		"pause",
		"stop",
		"skip",
		"nowPlaying",
		"volume",
		"volume <newVolume>",
		"maxVolume",
		"maxVolume <newMaxVolume>",
		"queue",
		"horse",
		"pokemon",
		"mushroom",
		"cat",
		"cheese",
		"cheetah"
	].join("\n  ")}`);
}

function getOrCreateDJ(guildId: string): DJ {
	let guildDJ = DJs.get(guildId);
	if (guildDJ === undefined) {
		const dj = CreateDJ(guildId);
		DJs.set(guildId, dj);
		return dj;
	}
	return guildDJ;
}

async function getIn(message: Discord.Message, dj: DJ): Promise<boolean> {
	if (
		message.content !== `${prefix}getIn` &&
		message.content !== `${prefix}getInLad`
	) {
		message.channel.send('ERROR: incorrectly was about to get in');
		return false;
	}
	
	if (message.member === null) {
		message.channel.send('Unable to determine who said to get in');
		return false;
	}
	const sender: Discord.GuildMember = message.member;
	if (sender.voice.channel === null ) {
		message.channel.send('Please do not tell me to get in when you yourself are not in');
		return false;
	}
	return dj.getIn(sender.voice.channel);
}

function getOut(message: Discord.Message, dj: DJ): boolean {
	if (
		message.content !== `${prefix}getOut` &&
		message.content !== `${prefix}getOutLad`
	) {
		message.channel.send('ERROR: incorrectly was about to get out');
		return false;
	}
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

async function chooseSong(message: Discord.Message, options: Song[]): Promise<Song|null> {
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

async function add(message: Discord.Message, dj:DJ): Promise<boolean> {
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

async function play(message: Discord.Message, dj: DJ) {
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
		const voiceChannel: Discord.VoiceChannel | null = message.member?.voice.channel || null;
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

function pause(message: Discord.Message, dj:DJ): boolean {
	return dj.pause(message.channel);
}

function stop(message: Discord.Message, dj:DJ): boolean {
	return dj.stop(message.channel);
}

function skip(message: Discord.Message, dj: DJ): boolean {
	return dj.voteSkip(message.author.id, message.channel);
}

function printStatus(message: Discord.Message, dj: DJ): boolean {
	return dj.printStatus(message.channel);
}

function setVolume(message: Discord.Message, dj: DJ): number {
	const args: string[] = message.content.split(" ").slice(1);
	if (args.length === 0) {
		const v = dj.getVolume();
		message.channel.send(`Current volume: ${v}`);
		return v;
	} else if (args.length === 1) {
		const v: number = parseInt(args[0]);
		dj.setVolume(v, message.channel);
		return dj.getVolume();
	} else {
		message.channel.send('Too many arguments');
		return dj.getVolume();
	}
}

function limitVolume(message: Discord.Message, dj: DJ): number {
	const args: string[] = message.content.split(" ").slice(1);
	if (args.length === 0) {
		const v = dj.getVolumeLimit();
		message.channel.send(`Max volume: ${v}`);
		return v;
	} else if (args.length === 1) {
		const v: number = parseInt(args[0]);
		dj.setVolumeLimit(v, message.channel);
		return dj.getVolumeLimit();
	} else {
		message.channel.send('Too many arguments');
		return dj.getVolume();
	}
}

function printQueue(message: Discord.Message, dj: DJ): void {
	dj.printQueue(message.channel);
}

async function getSubredditImage(subreddit: string, message: Discord.Message): Promise<boolean> {
	let r: RedditRetriever|undefined = redditRetrievers.get(subreddit);
	if(r === undefined) {
		const newR: RedditRetriever = CreateRedditRetriever(subreddit);
		redditRetrievers.set(subreddit, newR);
		r = newR;
	}
	const image: string|null = await r.getImage();
	if(image === null) {
		message.channel.send('Unable to find image');
		return false;
	}
	message.channel.send('', {files: [image]});
	return true;

}

async function cat(message: Discord.Message): Promise<boolean> {
	return getSubredditImage('cat', message);
}

async function horse(message: Discord.Message): Promise<boolean> {
	return getSubredditImage('Horses', message);
}

async function pokemon(message: Discord.Message): Promise<boolean> {
	return getSubredditImage('ImaginaryKanto', message);
}

async function mushroom(message: Discord.Message): Promise<boolean> {
	return getSubredditImage('ShroomID', message);
}

async function cheese(message: Discord.Message): Promise<boolean> {
	return getSubredditImage('cheese', message);
}

async function cheetah(message: Discord.Message): Promise<boolean> {
	return getSubredditImage('Cheetahs', message);
}

client.login(token);