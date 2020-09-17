import * as Discord from 'discord.js';
import { BotManager, Result } from './botManagers/botManager';
import { CreateDJBotManager } from './botManagers/djBotManager';
import { CreateHelpBotManager } from './botManagers/helpBotManager';
import { CreateImageBotManager } from './botManagers/imageBotManager';
import { CreateModBotManager } from './botManagers/modBotManager';
import { ValidMessage } from './botManagers/validMessage';
import config from './config.json';
import { MessageChannel } from './botManagers/messageChannel';
import { validate } from './validation';
import { CreateImitationBotManager } from './botManagers/imitationBotManager';


//------------------------------------------------------------------------------
// Data
//------------------------------------------------------------------------------

const client = new Discord.Client();
const token: string = config.token;
const prefix: string = config.prefix;

const modBotManager = CreateModBotManager();
const djBotManager = CreateDJBotManager(modBotManager);
const imageBotManager = CreateImageBotManager(modBotManager);
const imitationBotManager = CreateImitationBotManager(modBotManager);
const helpBotManager = CreateHelpBotManager([djBotManager, imageBotManager, modBotManager, imitationBotManager], modBotManager);
const botManagers: BotManager[] = [
	djBotManager,
	imageBotManager,
	helpBotManager,
	modBotManager,
	imitationBotManager
];

//------------------------------------------------------------------------------
// Behaviour
//------------------------------------------------------------------------------

client.on('ready', () => {
	console.log('Ready!');
});

// client.on('debug', (info: string) => {
// 	console.log(`debug: ${info}`);
// });

client.on('disconnect', () => {
	console.log('Disconnect!');
});

client.on('message', async (message: Discord.Message) => {
	logMessage(message);

	//Discard invalid and irrelevant messages
	const validMessage: ValidMessage|null = validateMessage(message);
	if(validMessage === null) return;

	//Run the associated command
	const results: Promise<Result>[] = botManagers.map(
		(botManager: BotManager) => botManager.giveMessage(validMessage)
	);
	
	//Check success
	Promise.all(results)
		.then(evaluateSuccess)
		.then(printSuccess(validMessage));
});

if(validate(botManagers)) {
	client.login(token).then(() => {
		imitationBotManager.registerGuilds(client.guilds);
	});
} else {
	console.log('-----Validation failed-----');
}

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------

function validateMessage(message: Discord.Message): ValidMessage|null {
	//Ignore messages from bots and those not beginning with the calling prefix
	if (message.author.bot) return null;
	if (!message.content.toLocaleLowerCase().startsWith(prefix)) return null;

	//Valid messages must be associated with a server (guild)
	const messageGuild: Discord.Guild|null = message.guild;
	if (messageGuild === null) {
		console.log('Error: guild is null');
		message.channel.send('null guild error');
		return null;
	}

	//Valid messages have authors who are members of the server
	const messageAuthor: Discord.GuildMember|null = message.member;
	if(messageAuthor === null) {
		console.log('Error: null member');
		message.channel.send('null member error');
		return null;
	}

	//Construct a validated message
	return new ValidMessage(
		message.content,
		messageGuild,
		message.channel,
		messageAuthor,
		message.mentions
	);
}

function evaluateSuccess(values: Result[]): Result {
	//If any bot managers returned fail, a task failed
	if(values.some((v: Result) => v === Result.Fail)) return Result.Fail;
	//If one succeeded and none failed, this is a success
	if(values.some((v: Result) => v === Result.Success)) return Result.Success;
	//If no commands succeeded or failed, but any were blocked, return blocked
	if(values.some((v: Result) => v === Result.Blocked)) return Result.Blocked;
	//Otherwise, the command was not recognised
	else return Result.NotRecognised;
}

function printSuccess(message: ValidMessage): (result: Result) => void {
	return function (result: Result): void {
		const command: string = message.content.split(' ')[0].substr(prefix.length);
		if (result === Result.Success) {
			console.log(`${command} succeeded`);
		} else if (result === Result.Fail) {
			console.log(`${command} failed`);
		} else if (result === Result.Blocked) {
			if (message.author.id === "178822613156495360" && Math.random() < 0.01) {
				message.channel.send("I'm sorry John, I'm afraid I can't do that.");
				return;
			}
			message.channel.send(`<@${message.author.id}> you do not have the required permission for the ${message.commandText} command`);
		} else {
			console.log(`${command} not recognised`);
			if (message.author.id === "178822613156495360" && Math.random() < 0.01) {
				message.channel.send("I'm sorry John, I'm afraid I can't do that.");
				return;
			}
			const responses = [
				`${command} not recognised`,
				`I don't know how to ${command}`
			];
			const choice = Math.floor(Math.random()*responses.length);
			message.channel.send(responses[choice]);
		}
	};
}

function logMessage(message: Discord.Message) {
	const username: string = message.author.username;
	const content: string = message.content;
	const guildName: string = message.guild ? `${message.guild.name}.` : '';
	const channel: MessageChannel = message.channel;
	let name: string = '';
	if(channel instanceof Discord.TextChannel) {
		name = channel.name;
	} else if (channel instanceof Discord.DMChannel) {
		name = `DM: ${channel.recipient.username}`;
	} else if (channel instanceof Discord.NewsChannel) {
		name = channel.name;
	}

	console.log(`Message from ${username} in ${guildName}${name}:\n    ${content}`);
}

