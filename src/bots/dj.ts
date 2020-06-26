import * as Discord from 'discord.js'
import ytdl from 'ytdl-core';

import { MessageChannel } from '../botManagers/messageChannel';
import { DJSaveData, GuildDJSaveData } from '../persistence/djSave';

export enum PlaybackStatus {
	Playing,
	Paused,
	Stopped
}

export interface Song {
	title: string;
	url: string;
	length: string;
	artist: string;
};

export function parseDuration(s: string): number {
	return s.split(':')
		.map((n: string) => parseInt(n))
		.reduce((a: number, v: number) => a*60 + v, 0);
}

export function isValidDuration(d: string): boolean {
	if(d === '') return false;
	return d.split(':').reduce(
		(a: boolean, v: string) => a && (parseInt(v) !== NaN), true
	);
}

export interface DJ {
	addSong(song: Song, outputChannel: MessageChannel): void;

	getCurrentVoiceChannel(): Discord.VoiceChannel|null;
	getIn(vc: Discord.VoiceChannel): Promise<boolean>;
	getOut(): boolean;

	play(outputChannel: MessageChannel): boolean;
	pause(outputChannel: MessageChannel): boolean;
	stop(outputChannel: MessageChannel): boolean;
	voteSkip(id: string, outputChannel: MessageChannel): boolean;
	skip(outputChannel: MessageChannel): boolean;

	printStatus(outputChannel: MessageChannel): boolean;
	printQueue(outputChannel: MessageChannel): Promise<boolean>;

	getVolume(): number;
	getVolumeLimit(): number;
	setVolume(v: number, outputChannel: MessageChannel): void;
	setVolumeLimit(v: number, outputChannel: MessageChannel): void;

	getMaxSongLength(): number|null;
	setMaxSongLength(l: number|null): void;

	loadData(data: GuildDJSaveData): void;
	saveData(): GuildDJSaveData;
}

class DJImpl implements DJ {
	loadData(data: GuildDJSaveData): void {
		this.volume = data.volume;
		this.volumeLimit = data.maxVolume;
		this.songList = data.queue;
		this.maxSongLength = data.maxLength;
	}
	saveData(): GuildDJSaveData {
		return new GuildDJSaveData(
			this.volume,
			this.volumeLimit,
			this.songList,
			this.maxSongLength
		);
	}
	addSong(song: Song, outputChannel: MessageChannel): boolean {
		if(this.maxSongLength !== null && parseDuration(song.length) > this.maxSongLength) {
			outputChannel.send('Song exceeds maximum duration');
			return false;
		}
		this.songList.push(song);
		console.log(`Added song ${song.title}`);
		console.log(this.songList);
		outputChannel.send(`Added song: **${song.title}** (${song.length}) by ${song.artist}`);
		return true;
	}
	getCurrentVoiceChannel(): Discord.VoiceChannel|null {
		if(
			this.connection === null ||
			this.connection.voice === undefined
		) {
			return null;
		} else {
			return this.connection.voice.channel;
		}
	}
	async getIn(vc: Discord.VoiceChannel): Promise<boolean> {
		this.connection = await vc.join();
		return this.connection !== null;
	}
	getOut(): boolean {
		if(this.connection !== null) {
			console.log('disconnecting');
			this.connection.disconnect();
			this.connection = null;
		} else {
			console.log('connection is already null')
		}
		return this.connection === null;
	}
	play(outputChannel: MessageChannel): boolean {
		if (this.songList.length === 0) {
			outputChannel.send('Queue is empty, cannot play');
			this.getOut();
			return false;
		} else if (this.playbackStatus === PlaybackStatus.Playing) {
			outputChannel.send('Already playing');
			return true;
		} else if (this.playbackStatus === PlaybackStatus.Paused) {
			if (this.dispatcher === null) {
				outputChannel.send('Error: lost dispatcher');
				console.log('dispatcher null while status is paused');
				return false;
			}
			this.dispatcher.resume();
			this.playbackStatus = PlaybackStatus.Playing;
			outputChannel.send(`Resuming: **${this.songList[0].title}**`);
			return true;
		} else {
			return this.streamCurrentSong(outputChannel);
		}
	}
	pause(outputChannel: MessageChannel): boolean {
		if(this.playbackStatus === PlaybackStatus.Paused) {
			outputChannel.send('Already paused');
			return true;
		} else if (this.playbackStatus === PlaybackStatus.Playing) {
			if(this.dispatcher === null) {
				outputChannel.send("I thought I was playing, but I can't find my dispatcher");
				this.playbackStatus = PlaybackStatus.Stopped;
				return false;
			}
			this.dispatcher.pause();
			this.playbackStatus = PlaybackStatus.Paused;
			return true;
		} else {
			outputChannel.send("I can't pause when I'm already stopped");
			return false;
		}
	}
	stop(outputChannel: MessageChannel): boolean {
		if(this.playbackStatus === PlaybackStatus.Stopped) {
			outputChannel.send('Already stopped');
			if(this.songList.length > 0 ) {
				outputChannel.send('Clearing queue');
				this.songList = [];
			}
			return this.getOut();
		} else {
			if(this.dispatcher) {
				this.dispatcher.end();
				this.dispatcher = null;
			} else {
				outputChannel.send('Null dispatcher when not stopped');
			}
			this.songList = [];
			this.playbackStatus = PlaybackStatus.Stopped;
			return this.getOut();
		}
	}
	voteSkip(id: string, outputChannel: MessageChannel): boolean {
		this.votedToSkip.add(id);
		if(this.connection === null) {
			outputChannel.send("Canot conduct a vote when I'm not in a voice channel");
			return false;
		}
		const IDsInCall: string[] = this.connection.channel.members.keyArray();
		this.votedToSkip = new Set(
			[...this.votedToSkip].filter((id: string) => IDsInCall.includes(id))
		);
		const totalMemberCount = this.connection.channel.members.size-1;
		console.log(`total member count ${totalMemberCount}`);
		const requiredVoteCount = Math.floor(totalMemberCount/2)+1;
		console.log(`required vote count ${requiredVoteCount}`);
		const voteCount = this.votedToSkip.size;
		console.log(`vote count: ${voteCount}`);
		outputChannel.send(`${voteCount}/${requiredVoteCount} votes for skipping`);
		if(voteCount >= requiredVoteCount) {
			console.log('vote passed');
			return this.skip(outputChannel);
		}
		return true;
	}
	skip(outputChannel: MessageChannel): boolean {
		if(this.songList.length === 0) {
			outputChannel.send('No songs to skip');
			return false;
		} else if (this.songList.length === 1) {
			if(this.dispatcher) {
				this.dispatcher.end();
				this.dispatcher = null;
			} else {
				this.songList = [];
			}
			this.playbackStatus = PlaybackStatus.Stopped;
			return this.getOut();
		} else {
			if(this.dispatcher) {
				this.dispatcher.end();
				this.dispatcher = null;
			} else {
				this.songList.shift();
			}
			return this.streamCurrentSong(outputChannel);
		}
	}
	printStatus(outputChannel: MessageChannel): boolean {
		outputChannel.send(`Current track: ${this.songList.length > 0 ? this.songList[0].title : '-'}`)
		outputChannel.send(`Current playback status: ${this.playbackStatus}`);
		outputChannel.send(`Current dispatcher status: ${this.dispatcher ? 'existant' : 'null'}`);
		if(this.dispatcher) outputChannel.send(`Total dispatcher stream time: ${this.dispatcher.totalStreamTime}`);
		return true;
	}
	async printQueue(outputChannel: MessageChannel): Promise<boolean> {
		if(this.songList.length === 0) {
			outputChannel.send('Tracklist is currently empty');
			return true;
		} else {
			const formattedQueue = this.songList
				.map((song: Song, i: number) => `${i+1}. **${song.title}** (${song.length}) by ${song.artist}`)
				.join('\n');
			await outputChannel.send(`Current tracklist:\n${formattedQueue}`);
			return true;
		}
	}

	getVolume(): number {
		return this.volume;
	}
	getVolumeLimit(): number {
		return this.volumeLimit;
	}
	setVolume(v: number, outputChannel: MessageChannel): void {
		if( v < 0 ) {
			outputChannel.send("Can't set volume to negative value");
			this.volume = 0;
		} else if ( v > this.volumeLimit) {
			outputChannel.send(`Volume limit is set at ${this.volumeLimit}`);
			this.volume = this.volumeLimit;
		} else {
			this.volume = v;
			outputChannel.send(`Volume is now ${this.volume}`);
		}
		if(this.dispatcher) {
			this.dispatcher.setVolumeLogarithmic(this.volume/this.volumeScaleFactor);
		}
	}

	setVolumeLimit(v: number, outputChannel: MessageChannel): void {
		if(v > 100) {
			outputChannel.send('WARNING: setting volume limit above 100');
			this.volumeLimit = v;
		} else if (v < 0) {
			outputChannel.send('Cannot set volume limit below 0');
			this.volumeLimit = 0;
		} else {
			this.volumeLimit = v;
		}
		outputChannel.send(`Volume limit set to ${v}`);
		if(this.volume > this.volumeLimit) {
			this.volume = this.volumeLimit;
			if(this.dispatcher) {
				this.dispatcher.setVolumeLogarithmic(this.volume/this.volumeScaleFactor);
			}
			outputChannel.send(`Volume lowered to ${v}`);
		}
	}

	getMaxSongLength(): number|null {
		return this.maxSongLength;
	}

	setMaxSongLength(length: number|null) {
		this.maxSongLength = length;
		if(length !== null) {
			this.songList = this.songList.filter((s: Song) => {
				const l: number = parseDuration(s.length);
				console.log(`${s.length} -> ${l}`);
				return l <= length;
			})
		}
	}

	private streamCurrentSong(outputChannel: MessageChannel): boolean {
		if (this.connection === null) {
			outputChannel.send('No voice connection, cannot play');
			return false;
		}

		if(this.songList.length === 0) {
			outputChannel.send('ERROR: Attempted to stream non-existant song');
			return false;
		}

		const currentSong: Song = this.songList[0];

		this.dispatcher = this.connection
			.play(ytdl(currentSong.url, {highWaterMark: 1024*1024*10}))
			.on("debug", (info: string) => {console.log(`    debug: ${info}`);})
			.on("close", () => {console.log('close');})
			.on("pipe", (src: any) => console.log('pipe'))
			.on("start", () => console.log('start'))
			.on("unpipe", (src: any) =>console.log('unpipe'))
			.on("volumeChange", (oldV: number, newV: number) => console.log(`volume change ${oldV} -> ${newV}`))
			.on("finish", () => {
				console.log('Finished song');
				console.log(`Stream time ${this.dispatcher?.streamTime}`);
				this.songList.shift();
				this.votedToSkip = new Set<string>();
				if(this.songList.length === 0) {
					console.log('No songs left');
					this.getOut();
					this.playbackStatus = PlaybackStatus.Stopped;
				} else {
					console.log('Streaming next song');
					this.streamCurrentSong(outputChannel);
				}
			})
			.on("error", error => {
				console.error(error);
				outputChannel.send('Encountered an error during playback');
				this.getOut();
				this.playbackStatus = PlaybackStatus.Stopped;
			});

		this.dispatcher.setVolumeLogarithmic(this.volume / this.volumeScaleFactor);
		outputChannel.send(`Now playing: **${currentSong.title}**`);
		this.playbackStatus = PlaybackStatus.Playing;
		return true;
	}

	private connection: Discord.VoiceConnection | null = null;
	private dispatcher: Discord.StreamDispatcher | null = null;
	private songList: Song[] = [];
	private playbackStatus: PlaybackStatus = PlaybackStatus.Stopped;
	private volume: number = 20;
	private volumeScaleFactor: number = 50;
	private volumeLimit: number = 100;
	private votedToSkip: Set<string> = new Set<string>();
	private maxSongLength: number|null = null;
}

export function CreateDJ(): DJ {
	console.log('creating new dj');
	return new DJImpl();
}
