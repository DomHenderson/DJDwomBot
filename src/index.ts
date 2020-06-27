import * as Discord from 'discord.js';

import config from './config.json';
import { DJBotManager, CreateDJBotManager } from './botManagers/djBotManager';
import { CreateImageBotManager } from './botManagers/imageBotManager';
import { BotManager } from './botManagers/botManager';
import { ValidMessage } from './botManagers/validMessage';
import { CreateHelpBotManager } from './botManagers/helpBotManager';

//------------------------------------------------------------------------------
// Data
//------------------------------------------------------------------------------

const client = new Discord.Client();
const token: string = config.token;
const prefix: string = config.prefix;

const djBotManager = CreateDJBotManager();
const imageBotManager = CreateImageBotManager();
const helpBotManager = CreateHelpBotManager([djBotManager, imageBotManager]);
const botManagers: BotManager[] = [
	djBotManager,
	imageBotManager,
	helpBotManager
];

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
	if (!message.content.toLocaleLowerCase().startsWith(prefix)) return;
	const messageGuild: Discord.Guild|null = message.guild;
	if (messageGuild === null) {
		console.log('Error: guild is null');
		message.channel.send('null guild error');
		return;
	}
	const messageAuthor: Discord.GuildMember|null = message.member;
	if(messageAuthor === null) {
		console.log('Error: null member');
		message.channel.send('null member error');
		return
	}
	const successes: Promise<boolean|null>[] = botManagers.map(
		(botManager: BotManager) => botManager.giveMessage(new ValidMessage(
			message.content,
			messageGuild,
			message.channel,
			messageAuthor
		))
	);
	const command: string = message.content.split(" ")[0].substr(prefix.length);
	Promise.all(successes)
		.then((values: (boolean|null)[]) => {
			return values.reduce((a: boolean|null, v: boolean|null) => {
				if(v) return true
				else if(v === false) return a || v
				else return a
			}, null)
		})
		.then((success: boolean|null) => {
			if (success) console.log(`${command} succeeded`)
			else if (success === false) console.log(`${command} failed`)
			else {
				console.log(`${command} not recognised`);
				message.channel.send(`${command} not recognised`);
			}
		})
});

client.login(token);