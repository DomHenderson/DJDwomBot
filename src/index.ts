import * as Discord from 'discord.js';
import { BotManager } from './botManagers/botManager';
import { CreateDJBotManager } from './botManagers/djBotManager';
import { CreateHelpBotManager } from './botManagers/helpBotManager';
import { CreateImageBotManager } from './botManagers/imageBotManager';
import { CreateModBotManager } from './botManagers/modBotManager';
import { ValidMessage } from './botManagers/validMessage';
import config from './config.json';
import { MessageChannel } from './botManagers/messageChannel';
import { validate } from './validation';


//------------------------------------------------------------------------------
// Data
//------------------------------------------------------------------------------

const client = new Discord.Client();
const token: string = config.token;
const prefix: string = config.prefix;

const modBotManager = CreateModBotManager();
const djBotManager = CreateDJBotManager(modBotManager);
const imageBotManager = CreateImageBotManager(modBotManager);
const helpBotManager = CreateHelpBotManager([djBotManager, imageBotManager, modBotManager], modBotManager);
const botManagers: BotManager[] = [
	djBotManager,
	imageBotManager,
	helpBotManager,
	modBotManager
];

//------------------------------------------------------------------------------
// Behaviour
//------------------------------------------------------------------------------

client.on('ready', () => {
	console.log('Ready!');
});

client.on('debug', (info: string) => {
	console.log(`debug: ${info}`);
});

client.on('disconnect', () => {
	console.log('Disconnect!');
});

client.on('message', async (message: Discord.Message) => {
	logMessage(message);

	//Discard invalid and irrelevant messages
	const validMessage: ValidMessage|null = validateMessage(message);
	if(validMessage === null) return;

	//Run the associated command
	const successes: Promise<boolean|null>[] = botManagers.map(
		(botManager: BotManager) => botManager.giveMessage(validMessage)
	);
	
	//Check success
	Promise.all(successes)
		.then(evaluateSuccess)
		.then(printSuccess(validMessage));
});

if(validate(botManagers)) {
	client.login(token);
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
		messageAuthor
	);
}

function evaluateSuccess(values: (boolean|null)[]): boolean|null {
	//If any bot managers returned false, a task failed
	if(values.some((v: boolean|null) => v === false)) return false;
	//If all bot managers returned null, the command was not recognised
	else if (values.every((v: boolean|null) => v === null)) return null;
	//Otherwise, at least one succeeded, and the rest ignored the command, which is a success
	else return true;
}

function printSuccess(message: ValidMessage): (success: boolean|null) => void {
	return function (success: boolean|null): void {
		const command: string = message.content.split(' ')[0].substr(prefix.length);
		if (success) console.log(`${command} succeeded`);
		else if (success === false) console.log(`${command} failed`);
		else {
			console.log(`${command} not recognised`);
			message.channel.send(`${command} not recognised`);
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

