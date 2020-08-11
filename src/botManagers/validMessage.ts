import * as Discord from 'discord.js';
import { prefix } from '../config.json';
import { MessageChannel } from './messageChannel';

export class ValidMessage {
	constructor(
		public content: string,
		public guild: Discord.Guild,
		public channel: MessageChannel,
		public author: Discord.GuildMember,
		public mentions: Discord.MessageMentions
	) {}

	get commandText(): string {
		return this.content
			.split(' ')[0]
			.substr(prefix.length)
			.toLocaleLowerCase();
	}

	get numArgs(): number {
		return this.content
			.split(' ')
			.length - 1;
	}

	get args(): string[] {
		return this.content
			.split(' ')
			.slice(1);
	}
}