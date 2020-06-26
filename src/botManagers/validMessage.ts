import * as Discord from "discord.js";
import { MessageChannel } from "./messageChannel";

export class ValidMessage {
	constructor(
		public content: string,
		public guild: Discord.Guild,
		public channel: MessageChannel,
		public author: Discord.GuildMember
	) {}
}